"use client";

import { useActionState } from "react";
import {
  approveRoleRequest,
  denyRoleRequest,
  type RoleRequestActionState,
} from "@/app/actions";
import { RoleSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";

const EMPTY_STATE: RoleRequestActionState = { status: "idle", message: "" };

export function RoleRequestActions({
  guildId,
  requestId,
  options,
  defaultRoleId,
  blockedReason,
}: {
  guildId: string;
  requestId: string;
  options: Array<{ value: string; label: string }>;
  defaultRoleId: string | null;
  blockedReason: string | null;
}) {
  const [approveState, approveAction] = useActionState(
    approveRoleRequest.bind(null, guildId, requestId),
    EMPTY_STATE,
  );
  const [denyState, denyAction] = useActionState(
    denyRoleRequest.bind(null, guildId, requestId),
    EMPTY_STATE,
  );

  const state =
    approveState.status !== "idle"
      ? approveState
      : denyState.status !== "idle"
        ? denyState
        : null;

  return (
    <div className="border-t border-white/5 bg-white/[0.02] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <form
          action={approveAction}
          className="flex w-full flex-col gap-3 sm:w-auto sm:flex-1 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <RoleSelect
              name="roleId"
              label="Role to grant"
              options={options}
              defaultValue={defaultRoleId}
              required
            />
          </div>
          <SubmitButton
            tone="success"
            className="w-full sm:w-auto"
            disabled={options.length === 0}
          >
            Approve & assign
          </SubmitButton>
        </form>
        <form action={denyAction} className="w-full sm:w-auto">
          <SubmitButton tone="danger" className="w-full sm:w-auto">
            Deny
          </SubmitButton>
        </form>
      </div>

      {blockedReason && (
        <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-xs leading-relaxed text-amber-200">
          {blockedReason}
        </p>
      )}

      {options.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-amber-200">
          The bot has no assignable roles in this server right now. Move its role higher in
          Server Settings → Roles, then reload this page.
        </p>
      )}

      {state?.message && (
        <p
          role="status"
          className={`mt-3 text-sm ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
