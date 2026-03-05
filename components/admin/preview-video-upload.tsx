"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Video, CheckCircle2, AlertCircle } from "lucide-react";

function StatusMessage({ state, message }: { readonly state: UploadState; readonly message: string }) {
  let Icon = Loader2;
  if (state === "done") Icon = CheckCircle2;
  if (state === "error") Icon = AlertCircle;

  let color = "text-muted-foreground";
  if (state === "done") color = "text-green-600";
  if (state === "error") color = "text-destructive";

  return (
    <p className={`flex items-center gap-1.5 text-xs ${color}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${state === "uploading" ? "animate-spin" : ""}`} />
      {message}
    </p>
  );
}

type UploadState = "idle" | "uploading" | "done" | "error";

interface PreviewVideoUploadProps {
  value: string;
  onChange: (url: string) => void;
  id?: string;
  name?: string;
}

/**
 * Preview video URL field with optional Bunny Stream upload.
 * Uploads directly from the browser to Bunny — bypasses Vercel's 4.5 MB limit.
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
    setUploadMessage("Creating video entry…");

    try {
      // Step 1: Create video entry — Vercel only handles this tiny JSON request
      const createRes = await fetch("/api/bunny/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: file.name }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ error: createRes.statusText }));
        throw new Error(err.error || "Failed to create video entry");
      }
      const { uploadUrl, apiKey, embedUrl } = await createRes.json();

      setUploadMessage(`Uploading "${file.name}" (${formatBytes(file.size)}) directly to Bunny…`);

      // Step 2: PUT directly from browser to Bunny — Vercel never sees the bytes
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
            setUploadMessage(`Uploading "${file.name}" — ${pct}% (${formatBytes(file.size)})`);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let msg = `Upload failed (${xhr.status})`;
            try {
              const body = JSON.parse(xhr.responseText);
              if (body?.error) msg = body.error;
            } catch {
              if (xhr.responseText) msg = xhr.responseText.slice(0, 200);
            }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("AccessKey", apiKey);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

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
      setProgress(100);
      setUploadMessage("Uploaded ✓ — Bunny is encoding the video (takes a minute)");
    } catch (err: unknown) {
      setUploadState("error");
      setUploadMessage(err instanceof Error ? err.message : "Upload failed");
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
          accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {uploadState === "uploading" && progress > 0 && (
        <Progress value={progress} className="h-2" />
      )}

      {uploadState !== "idle" && uploadMessage && (
        <StatusMessage state={uploadState} message={uploadMessage} />
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
