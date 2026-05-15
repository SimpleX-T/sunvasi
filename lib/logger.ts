type Level = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: Level;
  msg: string;
  [k: string]: unknown;
}

const NS = "sunvasi";

function emit(payload: LogPayload): void {
  if (typeof process === "undefined") return;
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ ns: NS, ts: new Date().toISOString(), ...payload });
  if (payload.level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (payload.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug(msg: string, ctx: Record<string, unknown> = {}) {
    if (process.env.NODE_ENV !== "production") emit({ level: "debug", msg, ...ctx });
  },
  info(msg: string, ctx: Record<string, unknown> = {}) {
    emit({ level: "info", msg, ...ctx });
  },
  warn(msg: string, ctx: Record<string, unknown> = {}) {
    emit({ level: "warn", msg, ...ctx });
  },
  error(msg: string, ctx: Record<string, unknown> = {}) {
    emit({ level: "error", msg, ...ctx });
  },
};
