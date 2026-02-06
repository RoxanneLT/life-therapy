import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

export async function getAuthenticatedStudent() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const student = await prisma.student.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!student) {
    redirect("/portal/login");
  }

  return { user, student };
}

/**
 * Ensures the student has changed their temporary password.
 * Redirects to /portal/change-password if mustChangePassword is true.
 */
export async function requirePasswordChanged() {
  const { user, student } = await getAuthenticatedStudent();

  if (student.mustChangePassword) {
    redirect("/portal/change-password");
  }

  return { user, student };
}
