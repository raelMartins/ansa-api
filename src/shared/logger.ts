import pino from "pino";

const development = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.authorization", "password", "passwordHash", "refreshToken", "accessToken"],
    censor: "[redacted]",
  },
  transport: development
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
});
