import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * The PURE half of the portal auth check — verify the user and load their student
 * row, no side effects. Wrapped in React.cache so a portal render tree (the dashboard
 * layout + the page + any data-fetching component all call requirePasswordChanged /
 * getAuthenticatedStudent) shares ONE auth.getUser() + one student lookup per request
 * instead of repeating both. Mirrors lib/auth.ts's loadAdminContext; redirects stay in
 * the wrappers below so NEXT_REDIRECT is never memoised.
 */
const loadStudentContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, student: null };
  }

  const student = await prisma.student.findUnique({
    where: { supabaseUserId: user.id },
  });

  return { user, student };
});

export async function getAuthenticatedStudent() {
  const { user, student } = await loadStudentContext();

  if (!user) {
    redirect("/login");
  }
  if (!student) {
    redirect("/login");
  }

  return { user, student };
}

/**
 * Non-redirecting version: returns the student if logged in, null otherwise.
 * Useful for public pages that optionally show student-specific features.
 */
export async function getOptionalStudent() {
  const { student } = await loadStudentContext();
  return student;
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
