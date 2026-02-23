import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: null });
  }

  // Check admin_users first
  const admin = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (admin) {
    return NextResponse.json({ role: "admin" });
  }

  // Check students
  const student = await prisma.student.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (student) {
    return NextResponse.json({ role: "student" });
  }

  return NextResponse.json({ role: null });
}
