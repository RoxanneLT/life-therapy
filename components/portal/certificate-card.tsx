"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CertificateCardProps {
  certificateNumber: string;
  courseTitle: string;
  issuedAt: Date;
  studentName: string;
}

export function CertificateCard({
  certificateNumber,
  courseTitle,
  issuedAt,
  studentName,
}: CertificateCardProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/certificates/download?number=${encodeURIComponent(certificateNumber)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${certificateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Certificate download failed:", err);
    }
    setDownloading(false);
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-linear-to-r from-brand-50 to-amber-50 px-6 py-8 text-center dark:from-brand-950/20 dark:to-amber-950/20">
        <Award className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h3 className="font-heading text-lg font-bold">
          Certificate of Completion
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{courseTitle}</p>
      </div>
      <CardContent className="space-y-3 p-4 text-center text-sm">
        <p>
          Awarded to <strong>{studentName}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Issued: {format(new Date(issuedAt), "d MMMM yyyy")}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {certificateNumber}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Generating..." : "Download PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}
