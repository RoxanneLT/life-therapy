"use server";

import { redeemGift } from "@/lib/gift";

export async function redeemGiftAction(
  token: string,
  data?: {
    firstName: string;
    lastName: string;
    password: string;
  }
) {
  if (!token) return { error: "Invalid gift token" };

  const result = await redeemGift(token, data);
  return result;
}
