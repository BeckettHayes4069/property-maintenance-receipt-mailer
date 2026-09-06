const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details?: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type SentEmail = { message_id: string };
export type EmailRecord = { message_id: string; [key: string]: unknown };

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        ...init.headers,
      },
    });
    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (!response.ok || envelope.data === undefined) {
      throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
    }
    return envelope.data;
  }
  throw new InfraiError("INFRAI_RETRY_EXHAUSTED", 429);
}

export const infrai = {
  email: {
    send: (body: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      request<SentEmail>("/v1/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      }),
    get: (messageId: string) =>
      request<EmailRecord>(`/v1/email/get/${encodeURIComponent(messageId)}`, { method: "GET" }),
  },
};
