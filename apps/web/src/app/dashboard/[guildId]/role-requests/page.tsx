import { notFound } from "next/navigation";
import { approveRoleRequest, denyRoleRequest } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState } from "@/components/ui";
import { RoleSelect } from "@/components/selects";
import { getGuildContext, roleOptions } from "@/lib/guild";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<
  string,
  { label: string; tone: "neutral" | "green" | "red" | "amber" | "blue" }
> = {
  PENDING_VOUCH: { label: "Waiting for vouch", tone: "amber" },
  PENDING_REVIEW: { label: "Waiting for admin", tone: "blue" },
  APPROVING: { label: "Applying role", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  DENIED: { label: "Denied", tone: "red" },
};

export default async function RoleRequestsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  if (!context.canAdmin) {
    return (
      <Card title="Role requests">
        <p className="text-sm text-amber-200">Only server Administrators can review role requests.</p>
      </Card>
    );
  }

  const requests = await prisma.roleRequest.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const roleSelect = roleOptions(context.roles.filter((role) => !role.managed), false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Role requests</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Review applications after the nominated person confirms their vouch.
        </p>
      </div>

      <Card title="Applications" description={`${requests.length} recent request(s)`}>
        {requests.length === 0 ? (
          <EmptyState title="No role requests yet" description="Applications submitted in Discord will appear here." />
        ) : (
          <ul className="space-y-4">
            {requests.map((request) => {
              const status = STATUS_LABELS[request.status] ?? {
                label: request.status,
                tone: "neutral" as const,
              };
              const canReview = request.status === "PENDING_REVIEW";

              return (
                <li
                  key={request.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-ink-950/60"
                >
                  <div className="border-l-4 border-brand-500 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-white">Role Request</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Applicant</dt>
                        <dd className="mt-1 text-slate-200">
                          {request.applicantName} <span className="text-slate-500">({request.applicantId})</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">In-game name</dt>
                        <dd className="mt-1 text-slate-200">{request.inGameName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Vouched by</dt>
                        <dd className="mt-1 text-slate-200">
                          {request.voucherName} <span className="text-slate-500">({request.voucherId})</span>
                        </dd>
                      </div>
                      {request.roleId && (
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">
                            {request.status === "APPROVED" ? "Role granted" : "Selected role"}
                          </dt>
                          <dd className="mt-1 text-slate-200">
                            {context.roles.find((role) => role.id === request.roleId)?.name ?? "Role unavailable"}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {request.evidenceUrl && (
                      <a
                        href={request.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={request.evidenceUrl}
                          alt="Applicant-provided evidence"
                          className="max-h-72 max-w-full rounded-lg border border-white/10 object-contain"
                        />
                      </a>
                    )}
                  </div>

                  {canReview && (
                    <div className="flex flex-wrap items-end gap-3 border-t border-white/5 bg-white/[0.02] px-5 py-3">
                      <form
                        action={approveRoleRequest.bind(null, guildId, request.id)}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <RoleSelect
                          name="roleId"
                          label="Role to grant"
                          options={roleSelect}
                          defaultValue={request.roleId}
                          required
                        />
                        <SubmitButton className="bg-emerald-600 hover:bg-emerald-500">
                          Approve & assign
                        </SubmitButton>
                      </form>
                      <form action={denyRoleRequest.bind(null, guildId, request.id)}>
                        <SubmitButton className="bg-rose-700 hover:bg-rose-600">Deny</SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
