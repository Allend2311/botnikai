"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, EmptyState, Select, Textarea } from "@/components/ui";

interface Prediction {
  label: string;
  probability: number;
}

interface TrainResult {
  sampleCount: number;
  trainCount: number;
  testCount: number;
  accuracy: number | null;
}

export function ModelConsole({ hasModel }: { hasModel: boolean }) {
  const router = useRouter();
  const [training, setTraining] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [ready, setReady] = useState(hasModel);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TrainResult | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [error, setError] = useState("");
  const [testError, setTestError] = useState("");
  const [sampleLabel, setSampleLabel] = useState("INVITE");
  const [sampleText, setSampleText] = useState("");
  const [adding, setAdding] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");

  async function train() {
    setTraining(true);
    setError("");
    try {
      const response = await fetch("/api/owner/model/train", { method: "POST" });
      const data = (await response.json()) as TrainResult & { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "Training failed. Please try again.");
        return;
      }
      setResult(data);
      setReady(true);
      setPredictions(null);
      router.refresh();
    } catch {
      setError("Could not reach the training endpoint.");
    } finally {
      setTraining(false);
    }
  }

  async function addSample() {
    if (!sampleText.trim()) return;
    setAdding(true);
    setSampleMessage("");
    try {
      const response = await fetch("/api/owner/model/samples", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: sampleText, label: sampleLabel }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        setSampleMessage(data.error ?? "Could not save that sample.");
        return;
      }
      setSampleText("");
      setSampleMessage("Sample saved. Retrain the model to include it.");
      router.refresh();
    } catch {
      setSampleMessage("Could not reach the samples endpoint.");
    } finally {
      setAdding(false);
    }
  }

  async function classifyText() {
    if (!text.trim()) return;
    setClassifying(true);
    setTestError("");
    try {
      const response = await fetch("/api/owner/model/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        predictions?: Prediction[];
      };
      if (!response.ok || data.ok === false) {
        setTestError(data.error ?? "Could not classify that text.");
        return;
      }
      setPredictions(data.predictions ?? []);
    } catch {
      setTestError("Could not reach the classifier.");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Train the classifier"
        description="Reads the labelled samples, splits them into training and test sets, and saves the trained model. Usually finishes in a few seconds."
      >
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2.5 text-xs text-rose-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={train}
          disabled={training}
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {training ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Training…
            </>
          ) : (
            "Train model"
          )}
        </button>

        {result && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Accuracy</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {result.accuracy == null ? "—" : `${Math.round(result.accuracy * 100)}%`}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Training rows</p>
              <p className="mt-1 text-lg font-semibold text-white">{result.trainCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Test rows</p>
              <p className="mt-1 text-lg font-semibold text-white">{result.testCount}</p>
            </div>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Accuracy is measured on a held-out 20% split. It is a rough signal — with few samples it will be
          optimistic or unstable.
        </p>
      </Card>

      <Card
        title="Add a training sample"
        description="Label a removed message from a moderation case. New automod removals are captured automatically."
      >
        <div className="space-y-4">
          <Select
            name="sample-label"
            value={sampleLabel}
            options={["INVITE", "LINK", "WORD", "CAPS", "SPAM", "CLEAN"].map((label) => ({
              value: label,
              label: label.toLowerCase(),
            }))}
            onChange={(event) => setSampleLabel(event.target.value)}
          />
          <Textarea
            name="sample-text"
            value={sampleText}
            onChange={(event) => setSampleText(event.target.value)}
            placeholder="Paste the removed message text…"
            rows={3}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={addSample}
            disabled={adding || !sampleText.trim()}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Saving…" : "Save sample"}
          </button>
          {sampleMessage && <p className="text-[11px] text-slate-400">{sampleMessage}</p>}
        </div>
      </Card>

      <Card title="Test the model" description="Paste a message and see which category the stored model predicts.">
        {!ready ? (
          <EmptyState title="Train a model first" description="The classifier becomes available after the first successful training run." />
        ) : (
          <>
            <Textarea
              name="classify-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type a message to classify…"
              rows={4}
              maxLength={2000}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={classifyText}
                disabled={classifying || !text.trim()}
                className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
              >
                {classifying ? "Classifying…" : "Classify"}
              </button>
              <span className="text-[11px] text-slate-600">{text.length}/2000</span>
            </div>

            {testError && (
              <p role="alert" className="mt-4 text-xs text-rose-300">{testError}</p>
            )}

            {predictions && (
              <ul className="mt-5 space-y-3">
                {predictions.map((prediction) => (
                  <li key={prediction.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <Badge>{prediction.label.toLowerCase()}</Badge>
                      <span className="font-mono text-slate-400">
                        {(prediction.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400"
                        style={{ width: `${Math.max(1, prediction.probability * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
