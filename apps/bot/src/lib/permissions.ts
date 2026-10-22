import {
  PermissionFlagsBits,
  type GuildMember,
  type PermissionResolvable,
  type PermissionsBitField,
} from "discord.js";

export const MODERATION_PERMISSIONS: PermissionResolvable[] = [
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
];

export function hasPermissions(member: GuildMember | null, permissions: PermissionResolvable[]): boolean {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return permissions.every((permission) => member.permissions.has(permission));
}

/** Turns a permission bitfield into readable names, e.g. "BanMembers". */
export function missingPermissions(
  member: GuildMember | null,
  permissions: PermissionResolvable[],
): string[] {
  if (!member) return ["member"];
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return [];

  return permissions
    .filter((permission) => !member.permissions.has(permission))
    .map((permission) => permissionName(permission));
}

export function permissionName(permission: PermissionResolvable): string {
  if (typeof permission === "string") return permission;

  if (typeof permission === "bigint") {
    const entry = Object.entries(PermissionFlagsBits).find(([, value]) => value === permission);
    return entry ? entry[0] : permission.toString();
  }

  return String(permission);
}

export function formatPermissions(bitfield: PermissionsBitField): string {
  return bitfield
    .toArray()
    .map((permission) => permissionName(permission))
    .join(", ");
}
