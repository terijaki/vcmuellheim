import type { z } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    reason?: string;
    details?: { path: string; message: string }[];
  };
};

export function buildApiErrorBody(
  code: string,
  message: string,
  extra?: { reason?: string; details?: { path: string; message: string }[] },
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(extra?.reason ? { reason: extra.reason } : {}),
      ...(extra?.details && extra.details.length > 0 ? { details: extra.details } : {}),
    },
  };
}

export function zodValidationDetails(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

export function zodValidationMessage(error: z.ZodError): string {
  const details = zodValidationDetails(error);
  const first = details[0];
  if (!first) return "Invalid request";
  return first.path === "(root)" ? first.message : `${first.path}: ${first.message}`;
}
