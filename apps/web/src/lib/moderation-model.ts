import { AUTOMOD_VIOLATIONS } from "@guardbot/shared";
import { prisma } from "./prisma";

/**
 * Tiny multinomial Naive Bayes moderator.
 *
 * Training happens on demand inside a Next.js route handler (a few thousand
 * short messages is well under a serverless timeout). The resulting artifact is
 * plain JSON in Postgres, so no Python runtime or external ML service is
 * needed. It is a helper/ranking signal, not an automatic ban system.
 */

export const LABELS = ["CLEAN", ...AUTOMOD_VIOLATIONS] as const;
export type ModelLabel = (typeof LABELS)[number];

const ALPHA = 0.5; // Laplace smoothing
const MAX_VOCAB = 4000;
const MAX_DB_SAMPLES = 6000;

interface TrainingSample {
  label: string;
  content: string;
}

export interface ModelArtifact {
  vocabulary: string[];
  tokenCounts: Record<string, Record<string, number>>;
  totals: Record<string, number>;
  docs: Record<string, number>;
  totalDocs: number;
}

export interface TrainedModel {
  id: string;
  algorithm: string;
  labels: string[];
  artifact: ModelArtifact;
  sampleCount: number;
  accuracy: number | null;
  trainedBy: string | null;
  trainedAt: Date;
}

/**
 * Benign examples. Real clean messages are deliberately not harvested from
 * chat; these give the classifier a negative class without retaining ordinary
 * user conversations.
 */
const BENIGN_SAMPLES: string[] = [
  "hey everyone how is it going",
  "good morning, hope you all have a great day",
  "thanks for the help, that worked perfectly",
  "can someone explain how this command works",
  "just joined the server, hello everybody",
  "that is really cool, nice work",
  "does anyone know when the event starts",
  "i will be there in a few minutes",
  "welcome back, we missed you",
  "the new update looks amazing",
  "what time works best for you all",
  "sounds good to me, lets do it",
  "i am working on it right now",
  "appreciate the quick response",
  "has anyone tried the new feature yet",
  "no worries, happens to all of us",
  "see you all tomorrow then",
  "this is exactly what i was looking for",
  "could you share the link again please",
  "happy birthday to our moderator",
  "the stream was really fun last night",
  "i finally finished the project",
  "let me check and get back to you",
  "great job on the tournament everyone",
  "which channel should i post this in",
  "i think that is a good idea",
  "thanks, that makes sense now",
  "sorry for the late reply, i was asleep",
  "who wants to play a game later",
  "the weather is nice today",
  "just testing my microphone, sorry",
  "guys look at this cool screenshot",
  "i need help with my account settings",
  "is the bot still online",
  "congratulations on the promotion",
  "that was a great match, well played",
  "please ignore my previous message",
  "we are almost at our member goal",
  "i will send the details in a moment",
  "this server is really welcoming",
  "what is your favorite game",
  "i have been busy with school work",
  "thanks for keeping the server safe",
  "lets plan the meeting for friday",
  "much love to everyone here",
  "the new role colors look great",
  "can we get a quick recap of the news",
  "i fixed the issue, it was a typo",
  "anyone up for a chill voice chat",
  "have a wonderful weekend everyone",
  "not sure i understand, can you elaborate",
  "this playlist is perfect for studying",
];

/**
 * Normalizes URLs, mentions and long numbers before splitting into tokens.
 * Invite domains and other domains get separate markers so an unseen invite
 * code still looks like an invite. Case and repetition are added as explicit
 * features because lowercasing would otherwise erase the CAPS/SPAM signal.
 */
export function tokenize(text: string): string[] {
  const raw = String(text ?? "");
  const features: string[] = [];

  // Automod fires on these signals regardless of the surrounding words, so
  // they must outweigh ordinary vocabulary. Emitting each marker three times
  // lets the model learn that it is the marker, not words like "join" or
  // "hello", that decides the label.
  const STRONG_REPEAT = 3;

  const letters = raw.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 20 && (letters.match(/[A-Z]/g)?.length ?? 0) / letters.length > 0.5) {
    features.push(...Array(STRONG_REPEAT).fill("capsfeature"));
  }

  const wordCounts = new Map<string, number>();
  for (const word of raw.toLowerCase().match(/[\p{L}]+/gu) ?? []) {
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  }
  if (Math.max(0, ...wordCounts.values()) >= 4) {
    features.push(...Array(STRONG_REPEAT).fill("repetitionfeature"));
  }

  const cleaned = raw
    .toLowerCase()
    .replace(/(?:https?:\/\/)?(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.me|dsc\.gg)\/[\w-]+/gi, " invitetoken invitetoken invitetoken ")
    .replace(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi, " urltoken urltoken urltoken ")
    .replace(/<@!?&?\d+>/g, " usermention ")
    .replace(/\b\d{2,}\b/g, " numbertoken ");

  const tokens = cleaned.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s]/gu) ?? [];
  return [...features, ...tokens];
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function parseMeta(meta: string | null): { kind?: string; matched?: string } {
  if (!meta) return {};
  try {
    const parsed = JSON.parse(meta) as { kind?: unknown; matched?: unknown };
    return {
      kind: typeof parsed.kind === "string" ? parsed.kind : undefined,
      matched: typeof parsed.matched === "string" ? parsed.matched : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Gathers everything with usable text: new labelled samples, older AUTOMOD
 * cases that stored only the matched fragment, and the built-in clean class.
 */
export async function collectTrainingSamples() {
  const [dbSamples, cases, caseCount, warningCount] = await Promise.all([
    prisma.moderationSample.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_DB_SAMPLES,
      select: { label: true, content: true },
    }),
    prisma.case.findMany({
      where: { type: "AUTOMOD" },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: { meta: true },
    }),
    prisma.case.count({ where: { type: "AUTOMOD" } }),
    prisma.warning.count(),
  ]);

  const candidates: TrainingSample[] = dbSamples
    .filter((row) => (LABELS as readonly string[]).includes(row.label))
    .map((row) => ({ label: row.label, content: row.content }));

  for (const record of cases) {
    const meta = parseMeta(record.meta);
    if (!meta.kind || !(LABELS as readonly string[]).includes(meta.kind)) continue;
    const matched = meta.matched?.trim();
    if (!matched) continue;
    candidates.push({ label: meta.kind, content: matched.slice(0, 2000) });
  }

  const seen = new Set<string>();
  const unique = candidates.filter((sample) => {
    const key = `${sample.label}\u0000${sample.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const samples: TrainingSample[] = [
    ...unique.slice(0, MAX_DB_SAMPLES),
    ...BENIGN_SAMPLES.map((content) => ({ label: "CLEAN", content })),
  ];

  const labelCounts: Record<string, number> = {};
  for (const sample of samples) {
    labelCounts[sample.label] = (labelCounts[sample.label] ?? 0) + 1;
  }

  return {
    samples,
    labelCounts,
    dbSampleCount: dbSamples.length,
    automodCaseCount: caseCount,
    warningCount,
  };
}

function buildArtifact(rows: TrainingSample[]): ModelArtifact {
  const rawCounts: Record<string, Map<string, number>> = {};
  const docs: Record<string, number> = {};
  const termFrequency = new Map<string, number>();

  for (const label of LABELS) {
    rawCounts[label] = new Map();
    docs[label] = 0;
  }

  for (const row of rows) {
    const label = (LABELS as readonly string[]).includes(row.label) ? row.label : "CLEAN";
    docs[label] += 1;
    const counts = rawCounts[label]!;
    const tokens = tokenize(row.content);
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }
  }

  const vocabulary = [...termFrequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_VOCAB)
    .map(([token]) => token);
  const allowed = new Set(vocabulary);

  const tokenCounts: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};

  for (const label of LABELS) {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const [token, count] of rawCounts[label]!) {
      if (!allowed.has(token)) continue;
      counts[token] = count;
      total += count;
    }
    tokenCounts[label] = counts;
    totals[label] = total;
  }

  return {
    vocabulary,
    tokenCounts,
    totals,
    docs,
    totalDocs: rows.length,
  };
}

/** Scores every label and returns a normalized probability distribution. */
export function classify(text: string, model: TrainedModel, limit = 3) {
  const { artifact, labels } = model;
  const tokens = tokenize(text);
  const vocabularySize = Math.max(1, artifact.vocabulary.length);
  // A class with no samples must not score better than one with data: without
  // this floor, `alpha / (0 + alpha * V)` beats a token seen once in a small
  // corpus and empty classes win every prediction.
  const maxTotal = Math.max(1, ...Object.values(artifact.totals));
  const scores = labels.map((label) => {
    const prior = ((artifact.docs[label] ?? 0) + 1) / (artifact.totalDocs + labels.length);
    let score = Math.log(prior);
    const counts = artifact.tokenCounts[label] ?? {};
    const ownTotal = artifact.totals[label] ?? 0;
    const total = ownTotal > 0 ? ownTotal : maxTotal;

    for (const token of tokens) {
      const count = counts[token] ?? 0;
      // Every query token contributes, even when the class never saw it:
      // multiplying by `count` would silently ignore unseen tokens and let
      // empty classes win.
      score += Math.log((count + ALPHA) / (total + ALPHA * vocabularySize));
    }
    return { label, score };
  });

  const max = Math.max(...scores.map((entry) => entry.score));
  const weights = scores.map((entry) => Math.exp(entry.score - max));
  const sum = weights.reduce((total, weight) => total + weight, 0) || 1;

  return scores
    .map((entry, index) => ({
      label: entry.label,
      probability: weights[index]! / sum,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, Math.max(1, Math.min(limit, labels.length)));
}

export async function getLatestModel(): Promise<TrainedModel | null> {
  const row = await prisma.trainedModel.findFirst({ orderBy: { trainedAt: "desc" } });
  if (!row) return null;

  return {
    id: row.id,
    algorithm: row.algorithm,
    labels: JSON.parse(row.labels) as string[],
    artifact: JSON.parse(row.artifact) as ModelArtifact,
    sampleCount: row.sampleCount,
    accuracy: row.accuracy,
    trainedBy: row.trainedBy,
    trainedAt: row.trainedAt,
  };
}

export interface TrainingResult {
  id: string;
  sampleCount: number;
  trainCount: number;
  testCount: number;
  accuracy: number | null;
  labelCounts: Record<string, number>;
  trainedAt: Date;
}

/**
 * Deterministic 80/20 split by content hash, so repeated training on the same
 * data gives comparable accuracy numbers.
 */
export async function trainAndStoreModel(trainedBy?: string): Promise<TrainingResult> {
  const { samples, labelCounts } = await collectTrainingSamples();
  if (samples.length < 2) {
    throw new Error("There is not enough labelled text yet. Let the automod collect a few messages first.");
  }

  const trainRows: TrainingSample[] = [];
  const testRows: TrainingSample[] = [];
  for (const sample of samples) {
    (hash(sample.content) % 5 === 0 ? testRows : trainRows).push(sample);
  }
  if (trainRows.length === 0) trainRows.push(...testRows.splice(0, 1));
  if (testRows.length === 0) testRows.push(trainRows[trainRows.length - 1]!);

  const artifact = buildArtifact(trainRows);
  const candidate: TrainedModel = {
    id: "training",
    algorithm: "multinomial-naive-bayes",
    labels: [...LABELS],
    artifact,
    sampleCount: trainRows.length,
    accuracy: null,
    trainedBy: trainedBy ?? null,
    trainedAt: new Date(),
  };

  let correct = 0;
  for (const row of testRows) {
    const prediction = classify(row.content, candidate, 1)[0];
    if (prediction?.label === row.label) correct += 1;
  }
  const accuracy = correct / testRows.length;

  const saved = await prisma.trainedModel.create({
    data: {
      algorithm: candidate.algorithm,
      labels: JSON.stringify(candidate.labels),
      artifact: JSON.stringify(artifact),
      sampleCount: samples.length,
      accuracy,
      trainedBy: trainedBy ?? null,
    },
  });

  return {
    id: saved.id,
    sampleCount: samples.length,
    trainCount: trainRows.length,
    testCount: testRows.length,
    accuracy,
    labelCounts,
    trainedAt: saved.trainedAt,
  };
}
