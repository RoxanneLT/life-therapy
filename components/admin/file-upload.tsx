"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, X, Loader2, FileText } from "lucide-react";

interface FileUploadProps {
  value?: string;
  fileName?: string;
  onChange: (data: { path: string; fileName: string; fileSizeBytes: number } | null) => void;
}

export function FileUpload({ value, fileName, onChange }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        // 1. Get a signed upload URL (small JSON request, no body-size limit issues)
        const urlRes = await fetch("/api/upload-signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "products",
            fileName: file.name,
            contentType: file.type,
          }),
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok) {
          throw new Error(urlData.error || "Failed to get upload URL");
        }

        // 2. Upload directly to Supabase (bypasses Vercel's 4.5 MB limit)
        const uploadRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Upload to storage failed");
        }

        onChange({
          path: urlData.path,
          fileName: file.name,
          fileSizeBytes: file.size,
        });
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <FileText className="h-8 w-8 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName || value}</p>
          <p className="text-xs text-muted-foreground">Uploaded</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background p-6 transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      }`}
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <>
          <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            Drag & drop a file, or
          </p>
          <label>
            <Button type="button" variant="outline" size="sm" asChild>
              <span>Choose File</span>
            </Button>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Max 50MB. PDF, DOCX, XLSX, or images.
          </p>
        </>
      )}
    </div>
  );
}
