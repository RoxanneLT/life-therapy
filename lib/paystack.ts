import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

// --- Initialize Transaction ---

interface InitializeParams {
  email: string;
  amount: number; // In cents (kobo). R895.00 = 89500
  currency?: string; // Default "ZAR"
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
}

interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(
  params: InitializeParams,
): Promise<InitializeResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      currency: params.currency || "ZAR",
      reference: params.reference,
      callback_url: params.callback_url,
      metadata: params.metadata || {},
    }),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(`Paystack initialize failed: ${data.message}`);
  }
  return data.data;
}

// --- Verify Transaction ---

export async function verifyTransaction(reference: string) {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: headers() },
  );

  const data = await res.json();
  if (!data.status) {
    throw new Error(`Paystack verify failed: ${data.message}`);
  }
  return data.data;
}

// --- Webhook Signature Verification ---

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}
