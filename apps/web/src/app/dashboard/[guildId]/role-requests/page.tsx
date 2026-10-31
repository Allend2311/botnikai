import { notFound } from "next/navigation";
import { Badge, Card, EmptyState } from "@/components/ui";
import { getGuildContext, roleOptions } from "@/lib/guild";
import { getRoleAssignmentCapabilities, roleAssignmentBlocker } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RoleRequestActions } from "./role-request-actions";

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

  /**
   * Discord only lets the bot grant roles that sit below its own highest role.
   * Loading that information lets the page hide impossible choices instead of
   * letting Discord reject the request later.
   */
  const capabilities = await getRoleAssignmentCapabilities(guildId, context.roles).catch(
    (error) => {
      console.error(
        `[role-requests] Could not check the bot's role permissions in ${guildId}:`,
        error,
      );
      return null;
    },
  );

  const assignableRoles = context.roles.filter(
    (role) =>
      !role.managed &&
      (!capabilities || roleAssignmentBlocker(role, capabilities, guildId) === null),
  );
  const roleSelect = roleOptions(assignableRoles, false);
  const assignableRoleIds = new Set(assignableRoles.map((role) => role.id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Applications"
        title="Role requests"
        description="Review applications after the nominated person confirms their vouch."
      />

      {capabilities?.reason && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm leading-relaxed text-amber-200">
          {capabilities.reason}
        </p>
      )}

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
              const requestedRole = request.roleId
                ? context.roles.find((role) => role.id === request.roleId) ?? null
                : null;
              const requestedRoleBlocker =
                requestedRole && capabilities
                  ? roleAssignmentBlocker(requestedRole, capabilities, guildId)
                  : null;

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
                        <dd className="mt-1 min-w-0 text-slate-200">
                          <span className="break-words">{request.applicantName}</span>
                          <span className="mt-0.5 block break-all font-mono text-xs text-slate-500">
                            {request.applicantId}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">In-game name</dt>
                        <dd className="mt-1 text-slate-200">{request.inGameName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Vouched by</dt>
                        <dd className="mt-1 min-w-0 text-slate-200">
                          <span className="break-words">{request.voucherName}</span>
                          <span className="mt-0.5 block break-all font-mono text-xs text-slate-500">
                            {request.voucherId}
                          </span>
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
                    <RoleRequestActions
                      guildId={guildId}
                      requestId={request.id}
                      options={roleSelect}
                      defaultRoleId={
                        requestedRole && assignableRoleIds.has(requestedRole.id)
                          ? requestedRole.id
                          : null
                      }
                      blockedReason={requestedRoleBlocker}
                    />
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
