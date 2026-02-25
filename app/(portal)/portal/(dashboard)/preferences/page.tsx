import { redirect } from "next/navigation";

export default function PreferencesPage() {
  redirect("/portal/settings?tab=preferences");
}
