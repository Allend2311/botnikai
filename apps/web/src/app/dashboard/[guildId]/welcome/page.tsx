import Link from "next/link";
import { notFound } from "next/navigation";
import { TEMPLATE_TOKENS } from "@guardbot/shared";
import { addReactionRole, removeReactionRole, saveWelcome } from "@/app/actions";
import {
  channelName,
  channelOptions,
  getGuildContext,
  parseJsonArray,
  roleName,
  roleOptions,
  textChannels,
} from "@/lib/guild";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Field, Input, Textarea, Toggle } from "@/components/ui";
import { ChannelSelect, CheckboxGrid, RoleSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploadField } from "@/components/image-upload-field";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const { settings, channels, roles } = context;

  const reactionRoles = await prisma.reactionRole.findMany({
    where: { guildId },
    orderBy: { createdAt: "asc" },
  });

  const channelSelect = channelOptions(textChannels(channels));
  const roleSelect = roleOptions(roles);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome & roles</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Greet new members, say goodbye and let people claim roles with emoji reactions.
        </p>
      </div>

      <form action={saveWelcome.bind(null, guildId)} className="space-y-6">
        <Card title="Welcome message" description="Posted when a member joins the server.">
          <div className="space-y-5">
            <Toggle
              name="welcomeEnabled"
              label="Enable welcome messages"
              defaultChecked={settings.welcomeEnabled}
            />

            <ChannelSelect
              name="welcomeChannelId"
              label="Welcome channel"
              description="Where the welcome message is posted."
              options={channelSelect}
              defaultValue={settings.welcomeChannelId}
            />

            <Field
              label="Message"
              htmlFor="welcomeMessage"
              description="Use the tokens below to personalise the message."
            >
              <Textarea
                name="welcomeMessage"
                rows={3}
                defaultValue={settings.welcomeMessage}
                placeholder="Welcome {user} to {server}!"
              />
            </Field>

            <ImageUploadField
              guildId={guildId}
              imageType="welcome"
              name="welcomeImageUrl"
              label="Welcome image or GIF"
              initialUrl={settings.welcomeImageUrl}
            />

            <div className="flex flex-wrap gap-2">
              {TEMPLATE_TOKENS.map((token) => (
                <code
                  key={token.token}
                  title={token.description}
                  className="rounded-md bg-brand-500/10 px-2 py-1 font-mono text-[11px] text-brand-300 ring-1 ring-brand-500/20"
                >
                  {token.token}
                </code>
              ))}
            </div>

            <Toggle
              name="dmOnJoin"
              label="Send a direct message"
              description="DMs the member with a personal welcome."
              defaultChecked={settings.dmOnJoin}
            />

            <Field label="Direct message" htmlFor="welcomeDmMessage">
              <Textarea
                name="welcomeDmMessage"
                rows={3}
                defaultValue={settings.welcomeDmMessage ?? ""}
                placeholder="Hey {username}, welcome to {server}!"
              />
            </Field>
          </div>
        </Card>

        <Card title="Farewell message" description="Posted when a member leaves the server.">
          <div className="space-y-5">
            <Toggle
              name="goodbyeEnabled"
              label="Enable farewell messages"
              defaultChecked={settings.goodbyeEnabled}
            />

            <ChannelSelect
              name="goodbyeChannelId"
              label="Farewell channel"
              options={channelSelect}
              defaultValue={settings.goodbyeChannelId}
            />

            <Field label="Message" htmlFor="goodbyeMessage">
              <Textarea name="goodbyeMessage" rows={2} defaultValue={settings.goodbyeMessage} />
            </Field>

            <ImageUploadField
              guildId={guildId}
              imageType="goodbye"
              name="goodbyeImageUrl"
              label="Farewell image or GIF"
              initialUrl={settings.goodbyeImageUrl}
            />
          </div>
        </Card>

        <Card
          title="Auto roles"
          description="Members automatically receive these roles when they join."
        >
          <CheckboxGrid
            name="autoRoleIds"
            options={roleSelect.filter((option) => option.value !== "")}
            defaultValues={parseJsonArray(settings.autoRoleIds)}
            emptyLabel="No roles available in this server."
          />
        </Card>

        <div className="flex items-center justify-end gap-4">
          {!context.canManage && (
            <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
          )}
          <SubmitButton disabled={!context.canManage}>Save welcome settings</SubmitButton>
        </div>
      </form>

      <Card
        title="Reaction roles"
        description="Members receive a role when they react with the given emoji."
      >
        {reactionRoles.length === 0 ? (
          <EmptyState
            title="No reaction roles yet"
            description="Add one below and post the message with the emoji in the channel you selected."
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {reactionRoles.map((rule) => (
              <li key={rule.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-lg">
                  {rule.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-200">
                    {rule.emoji} → {roleName(roles, rule.roleId)}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    in #{channelName(channels, rule.channelId)}
                  </span>
                </span>
                <form action={removeReactionRole.bind(null, guildId, rule.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addReactionRole.bind(null, guildId)} className="mt-6 space-y-4 border-t border-white/5 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <ChannelSelect
              name="channelId"
              label="Channel"
              options={channelSelect.filter((option) => option.value !== "")}
            />
            <Field label="Emoji" htmlFor="emoji" description="A unicode emoji or a custom one.">
              <Input name="emoji" placeholder="🎉" required />
            </Field>
            <RoleSelect
              name="roleId"
              label="Role"
              options={roleSelect.filter((option) => option.value !== "")}
            />
          </div>

          <div className="flex items-center justify-end gap-4">
            {!context.canManage && (
              <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
            )}
            <SubmitButton disabled={!context.canManage}>Add reaction role</SubmitButton>
          </div>
        </form>
      </Card>

      <p className="text-xs text-slate-600">
        Looking for the live and post notifications? They live on the{" "}
        <Link
          href={`/dashboard/${guildId}/notifications`}
          className="text-brand-300 hover:text-brand-200"
        >
          notifications page
        </Link>
        .
      </p>
    </div>
  );
}
