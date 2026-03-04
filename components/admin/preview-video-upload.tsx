"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Video, CheckCircle2, AlertCircle } from "lucide-react";

type UploadState = "idle" | "uploading" | "done" | "error";

interface PreviewVideoUploadProps {
  value: string;
  onChange: (url: string) => void;
  id?: string;
  name?: string;
}

/**
 * Preview video URL field with optional Bunny Stream upload.
 * Supports pasting a YouTube/Vimeo/Bunny URL or uploading directly.
 */
export function PreviewVideoUpload({
  value,
  onChange,
  id = "previewVideoUrl",
  name = "previewVideoUrl",
}: PreviewVideoUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploadState("uploading");
    setProgress(0);
    setUploadMessage(`Creating video entry…`);

    try {
      // Step 1: Create video entry
      const createRes = await fetch("/api/bunny/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: file.name }),
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      const { guid } = await createRes.json();

      setUploadMessage(`Uploading "${file.name}" (${formatBytes(file.size)})…`);

      // Step 2: Upload with progress via XHR
      const form = new FormData();
      form.set("file", file);
      form.set("guid", guid);

      const responseText = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/bunny/stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
          else reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });

      const { embedUrl } = JSON.parse(responseText);

      // Delete old Bunny video if replacing
      if (value && value.includes("iframe.mediadelivery.net/embed") && value !== embedUrl) {
        fetch("/api/bunny/stream", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedUrl: value }),
        }).catch(() => {});
      }

      onChange(embedUrl);
      setUploadState("done");
      setUploadMessage("Video uploaded — encoding in progress on Bunny");
    } catch (err: unknown) {
      setUploadState("error");
      const message = err instanceof Error ? err.message : String(err);
      setUploadMessage(message || "Upload failed");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YouTube, Vimeo, or Bunny Stream embed URL"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploadState === "uploading"}
          title="Upload to Bunny Stream"
        >
          {uploadState === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Video className="h-4 w-4" />
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      {uploadState !== "idle" && uploadMessage && (
        <div className="space-y-1">
          <p
            className={`flex items-center gap-1.5 text-xs ${
              uploadState === "done"
                ? "text-green-600"
                : uploadState === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {uploadState === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : uploadState === "error" ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            )}
            {uploadMessage}
            {uploadState === "uploading" && progress > 0 && (
              <span className="font-medium">{progress}%</span>
            )}
          </p>
          {uploadState === "uploading" && progress > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Paste a URL or click the <Video className="inline h-3 w-3" /> button to
        upload directly to Bunny Stream.
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
