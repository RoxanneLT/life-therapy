import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-brand-50 via-cream-50 to-brand-100 px-4">
      {children}
      <Link
        href="/"
        className="mt-8 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to main site
      </Link>
    </div>
  );
}
