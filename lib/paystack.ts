import crypto from "crypto";
import { env } from "@/lib/env";

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = env("PAYSTACK_SECRET_KEY");
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

export interface VerifiedTransaction {
  status: string; // "success" | "failed" | "abandoned" | …
  amount: number; // minor units of `currency`
  currency: string;
  reference: string;
}

/**
 * Ask Paystack what happened to `reference`. The return from the hosted page proves nothing:
 * the reference sits in the query string, so a page that grants on it alone gives the product
 * away for an order nobody paid. Null when Paystack has no such transaction.
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.status || !data.data) return null;
  const { status, amount, currency, reference: ref } = data.data;
  return { status, amount, currency, reference: ref };
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
  // Constant-time: `===` returns at the first differing byte, which leaks how much of a forged
  // signature was right. Both sides are a fixed-length SHA-512 hex digest, so the length check
  // reveals nothing.
  const expected = Buffer.from(hash, "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
