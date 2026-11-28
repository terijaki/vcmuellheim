export interface LambdaLogger {
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  debug(message: string, extra?: Record<string, unknown>): void;
}

function writeLog(
  level: "info" | "warn" | "error" | "debug",
  serviceName: string,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const line =
    extra === undefined
      ? JSON.stringify({ level, service: serviceName, message })
      : JSON.stringify({ level, service: serviceName, message, ...extra });
  console[level](line);
}

/** Minimal structured console logger for Lambda workers (replaces Powertools Logger). */
export function createLambdaLogger(serviceName: string): LambdaLogger {
  return {
    info: (message, extra) => writeLog("info", serviceName, message, extra),
    warn: (message, extra) => writeLog("warn", serviceName, message, extra),
    error: (message, extra) => writeLog("error", serviceName, message, extra),
    debug: (message, extra) => writeLog("debug", serviceName, message, extra),
  };
}
