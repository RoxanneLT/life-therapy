import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * A download link that works without a login: it names one student and one product, carries its
 * own expiry, and is signed. A guest who bought through a buy-now link has no login, so the
 * thank-you page and the delivery email hand them this instead.
 *
 * It grants nothing by itself. The download route still requires a DigitalProductAccess row for
 * the pair, so revoking access kills every link already sent, and a link for a product the student
 * never owned is useless even if the signature is good.
 *
 * Stateless, so no column: the only thing to store would be the expiry, and the token holds it.
 */

export const DOWNLOAD_LINK_DAYS = 30;

function secret(): string | null {
  return env("DOWNLOAD_LINK_SECRET") ?? null;
}

/** Is the guest download feature configured? Without the secret no link can be made or checked. */
export function downloadLinksConfigured(): boolean {
  return secret() !== null;
}

function sign(payload: string, key: string): string {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

export function createDownloadToken(
  studentId: string,
  productId: string,
  now: Date = new Date(),
  days: number = DOWNLOAD_LINK_DAYS,
): string {
  const key = secret();
  if (!key) throw new Error("DOWNLOAD_LINK_SECRET is not set");
  const exp = Math.floor(now.getTime() / 1000) + days * 86_400;
  const payload = `${studentId}.${productId}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, key)}`;
}

/** The student and product a token names, or null if it is malformed, forged or expired. */
export function readDownloadToken(
  token: string,
  now: Date = new Date(),
): { studentId: string; productId: string } | null {
  const key = secret();
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = sign(payload, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const [studentId, productId, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!studentId || !productId || !Number.isInteger(exp)) return null;
  if (exp * 1000 < now.getTime()) return null;
  return { studentId, productId };
}
