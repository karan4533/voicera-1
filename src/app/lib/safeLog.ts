/** Redact secrets and PII before any console output. */
const SECRET_KEYS = /password|token|secret|authorization|api[_-]?key|credential/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.replace(EMAIL_RE, "[email]").slice(0, 180);
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message) };
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export const safeLog = {
  error(label: string, err?: unknown) {
    console.error(label, redact(err));
  },
  warn(label: string, err?: unknown) {
    console.warn(label, redact(err));
  },
};
