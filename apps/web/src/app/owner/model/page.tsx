import { OwnerChrome } from "@/components/owner-chrome";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { collectTrainingSamples, getLatestModel, LABELS } from "@/lib/moderation-model";
import { getSessionUser } from "@/lib/session";
import { ModelConsole } from "./model-console";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const LABEL_TONES: Record<string, "green" | "red" | "amber" | "blue" | "violet" | "neutral"> = {
  CLEAN: "green",
  SPAM: "amber",
  INVITE: "violet",
  LINK: "blue",
  WORD: "red",
  CAPS: "amber",
};

export default async function OwnerModelPage() {
  const [user, model, stats] = await Promise.all([
    getSessionUser(),
    getLatestModel(),
    collectTrainingSamples(),
  ]);

  return (
    <OwnerChrome displayName={user ? user.globalName ?? user.username : undefined}>
      <PageHeader
        eyebrow="Owner only"
        title={
          <>
            Moderation <span className="text-gradient-soft">model</span>
          </>
        }
        description="Train a text classifier on the messages GuardBot removed, then try it on new text. Training runs on demand and stores the model in the database."
        action={<Badge tone="violet">Owner only</Badge>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Labelled samples" value={stats.samples.length} hint="Includes clean examples" />
        <Stat label="Automod cases" value={stats.automodCaseCount} hint="Cases with matched text are reused" />
        <Stat label="Warnings" value={stats.warningCount} hint="Moderation context" />
        <Stat
          label="Last accuracy"
          value={model?.accuracy == null ? "—" : `${Math.round(model.accuracy * 100)}%`}
          hint={model ? `Trained ${dateFormat.format(model.trainedAt)}` : "No model yet"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,20rem]">
        <ModelConsole hasModel={Boolean(model)} />

        <div className="space-y-6">
          <Card title="Training data" description="Text classes currently available to the trainer.">
            <ul className="space-y-3">
              {LABELS.map((label) => (
                <li key={label} className="flex items-center justify-between gap-3 text-xs">
                  <Badge tone={LABEL_TONES[label] ?? "neutral"}>{label.toLowerCase()}</Badge>
                  <span className="font-mono text-slate-400">{stats.labelCounts[label] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-500">
              Clean examples are built in; ordinary conversations are never retained. Only removed
              messages and matched fragments from automod cases are used as positive samples.
            </p>
          </Card>

          {model ? (
            <Card title="Stored model">
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Algorithm</dt>
                  <dd className="text-slate-300">{model.algorithm}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Samples</dt>
                  <dd className="font-mono text-slate-300">{model.sampleCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Trained by</dt>
                  <dd className="text-slate-300">{model.trainedBy ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Trained at</dt>
                  <dd className="text-slate-300">{dateFormat.format(model.trainedAt)}</dd>
                </div>
              </dl>
            </Card>
          ) : (
            <Card title="Stored model">
              <EmptyState title="No model yet" description="Press Train model to create the first artifact." />
            </Card>
          )}
        </div>
      </div>
    </OwnerChrome>
  );
}
