import { redirect } from "next/navigation";

export default function CommitmentPage() {
  redirect("/portal/settings?tab=agreements");
}
