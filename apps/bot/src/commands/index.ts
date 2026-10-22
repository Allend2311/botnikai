import type { Command } from "../types";
import { moderationCommands } from "./moderation";
import { welcomeCommands } from "./welcome";
import { ticketCommands } from "./tickets";
import { liveCommands } from "./live";
import { postCommands } from "./posts";
import { utilityCommands } from "./utility";
import { roleRequestCommands } from "./roleRequests";
import { announcementCommands } from "./announcement";

export const commands: Command[] = [
  ...moderationCommands,
  ...welcomeCommands,
  ...ticketCommands,
  ...liveCommands,
  ...postCommands,
  ...roleRequestCommands,
  ...announcementCommands,
  ...utilityCommands,
];

export function loadCommands(): Map<string, Command> {
  const map = new Map<string, Command>();
  for (const command of commands) {
    map.set(command.data.name, command);
  }
  return map;
}
