import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { mergeCartToDb } from "@/lib/cart";
import type { CartItemLocal } from "@/lib/cart-store";

/**
 * POST /api/cart/sync
 * Merge localStorage cart items into the student's DB cart.
 * Called after student login.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const items: CartItemLocal[] = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ synced: true, itemCount: 0 });
    }

    const cart = await mergeCartToDb(auth.student.id, items);

    return NextResponse.json({
      synced: true,
      itemCount: cart?.items.length || 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to sync cart" },
      { status: 500 }
    );
  }
}
