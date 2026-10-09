"use server";

import { redeemGift } from "@/lib/gift";
import { passwordLengthRefusal } from "@/lib/password-policy";

export async function redeemGiftAction(
  token: string,
  data?: {
    firstName: string;
    lastName: string;
    password: string;
  }
) {
  if (!token) return { error: "Invalid gift token" };
  // The form checks this too, but the form is not the boundary: until 2026-10-09 this action
  // passed any password through, so only Supabase's own floor applied.
  if (data) {
    const tooShort = passwordLengthRefusal(data.password);
    if (tooShort) return { error: tooShort };
  }

  const result = await redeemGift(token, data);
  return result;
}
