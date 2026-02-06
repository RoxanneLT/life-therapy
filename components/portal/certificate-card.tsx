"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";
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
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-gradient-to-r from-brand-50 to-amber-50 px-6 py-8 text-center dark:from-brand-950/20 dark:to-amber-950/20">
        <Award className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h3 className="font-heading text-lg font-bold">
          Certificate of Completion
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{courseTitle}</p>
      </div>
      <CardContent className="space-y-2 p-4 text-center text-sm">
        <p>
          Awarded to <strong>{studentName}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Issued: {format(new Date(issuedAt), "d MMMM yyyy")}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {certificateNumber}
        </p>
      </CardContent>
    </Card>
  );
}
