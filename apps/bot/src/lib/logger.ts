const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
} as const;

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_COLOR: Record<Level, string> = {
  debug: COLORS.gray,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level: Level, scope: string, message: string, extra?: unknown): void {
  const line = `${COLORS.gray}${timestamp()}${COLORS.reset} ${LEVEL_COLOR[level]}${level.toUpperCase().padEnd(5)}${COLORS.reset} ${COLORS.magenta}${scope}${COLORS.reset} ${message}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (scope: string, message: string, extra?: unknown) => write("debug", scope, message, extra),
  info: (scope: string, message: string, extra?: unknown) => write("info", scope, message, extra),
  warn: (scope: string, message: string, extra?: unknown) => write("warn", scope, message, extra),
  error: (scope: string, message: string, extra?: unknown) => write("error", scope, message, extra),
};
