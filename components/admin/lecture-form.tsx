"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  FileText,
} from "lucide-react";

const LECTURE_TYPES = [
  { value: "video", label: "Video" },
  { value: "text", label: "Text / Reading" },
  { value: "quiz", label: "Quiz" },
];

const CONTEXT_OPTIONS = [
  { value: "both", label: "Both (Course & Standalone)" },
  { value: "course_only", label: "Course Only" },
  { value: "standalone_only", label: "Standalone Only" },
];

interface LectureFormProps {
  initialData?: {
    id: string;
    title: string;
    lectureType: string;
    videoUrl?: string | null;
    textContent?: string | null;
    worksheetUrl?: string | null;
    durationSeconds?: number | null;
    isPreview: boolean;
    context: string;
    sortOrder: number;
  };
  courseSlug?: string;
  moduleSlug?: string;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function LectureForm({
  initialData,
  courseSlug = "general",
  moduleSlug = "misc",
  onSubmit,
}: LectureFormProps) {
  const [lectureType, setLectureType] = useState(
    initialData?.lectureType || "video"
  );
  const [isPreview, setIsPreview] = useState(initialData?.isPreview ?? false);
  const [context, setContext] = useState(initialData?.context || "both");
  const [submitting, setSubmitting] = useState(false);

  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || "");
  const [videoState, setVideoState] = useState<UploadState>("idle");
  const [videoMessage, setVideoMessage] = useState("");
  const [videoProgress, setVideoProgress] = useState(0);

  const [worksheetUrl, setWorksheetUrl] = useState(
    initialData?.worksheetUrl || ""
  );
  const [worksheetState, setWorksheetState] = useState<UploadState>("idle");
  const [worksheetMessage, setWorksheetMessage] = useState("");
  const [worksheetProgress, setWorksheetProgress] = useState(0);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const worksheetFileRef = useRef<HTMLInputElement>(null);

  // ── Video: direct browser → Bunny Stream upload ──────────────────────────
  async function handleVideoUpload(file: File) {
    setVideoState("uploading");
    setVideoProgress(0);
    setVideoMessage(`Creating video entry…`);

    try {
      // Step 1: Ask our API to create the Bunny video entry
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

      setVideoMessage(`Uploading "${file.name}" (${formatBytes(file.size)}) directly to Bunny…`);

      // Step 2: PUT directly from browser to Bunny — Vercel never sees the bytes
      await xhrUpload({
        url: uploadUrl,
        file,
        headers: { AccessKey: apiKey },
        onProgress: (pct) => {
          setVideoProgress(pct);
          setVideoMessage(
            `Uploading "${file.name}" — ${pct}% (${formatBytes(file.size)})`
          );
        },
      });

      setVideoUrl(embedUrl);
      setVideoState("done");
      setVideoProgress(100);
      setVideoMessage("Uploaded ✓ — Bunny is encoding the video (takes a minute)");
    } catch (err: unknown) {
      setVideoState("error");
      setVideoMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  // ── Worksheet: direct browser → Bunny Storage upload ────────────────────
  async function handleWorksheetUpload(file: File) {
    setWorksheetState("uploading");
    setWorksheetProgress(0);
    setWorksheetMessage(`Uploading "${file.name}" (${formatBytes(file.size)})…`);

    try {
      // Step 1: Get upload credentials from our API (tiny JSON request)
      const credRes = await fetch("/api/bunny/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, courseSlug, moduleSlug }),
      });
      if (!credRes.ok) {
        const err = await credRes.json().catch(() => ({ error: credRes.statusText }));
        throw new Error(err.error || "Failed to get upload credentials");
      }
      const { uploadUrl, apiKey, cdnUrl } = await credRes.json();

      // Step 2: PUT directly from browser to Bunny Storage
      await xhrUpload({
        url: uploadUrl,
        file,
        headers: { AccessKey: apiKey },
        onProgress: (pct) => {
          setWorksheetProgress(pct);
          setWorksheetMessage(`Uploading "${file.name}" — ${pct}%`);
        },
      });

      setWorksheetUrl(cdnUrl);
      setWorksheetState("done");
      setWorksheetProgress(100);
      setWorksheetMessage("Uploaded ✓ — file is live on the CDN");
    } catch (err: unknown) {
      setWorksheetState("error");
      setWorksheetMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lectureType", lectureType);
    formData.set("isPreview", String(isPreview));
    formData.set("context", context);
    formData.set("videoUrl", videoUrl);
    formData.set("worksheetUrl", worksheetUrl);
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Title + Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Lecture Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={initialData?.title || ""}
            placeholder="e.g. Understanding Your Values"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={lectureType} onValueChange={setLectureType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LECTURE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Video URL + direct Bunny Stream upload */}
      {lectureType === "video" && (
        <div className="space-y-2">
          <Label htmlFor="videoUrl">Video URL</Label>
          <div className="flex gap-2">
            <Input
              id="videoUrl"
              name="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube/Vimeo/Bunny embed URL, or upload →"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => videoFileRef.current?.click()}
              disabled={videoState === "uploading"}
              title="Upload video directly to Bunny Stream"
            >
              {videoState === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={videoFileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVideoUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Progress bar */}
          {videoState === "uploading" && (
            <Progress value={videoProgress} className="h-2" />
          )}

          <UploadStatus state={videoState} message={videoMessage} />
          <p className="text-xs text-muted-foreground">
            Click the <Video className="inline h-3 w-3" /> button to upload any
            size video — it goes directly to Bunny, not through the server.
          </p>
        </div>
      )}

      {/* Text content */}
      {(lectureType === "text" || lectureType === "video") && (
        <div className="space-y-2">
          <Label htmlFor="textContent">
            {lectureType === "video" ? "Notes / Transcript" : "Content"}
          </Label>
          <Textarea
            id="textContent"
            name="textContent"
            defaultValue={initialData?.textContent || ""}
            placeholder="Lecture content or notes…"
            rows={8}
          />
        </div>
      )}

      {/* Worksheet URL + Bunny Storage upload */}
      <div className="space-y-2">
        <Label htmlFor="worksheetUrl">Worksheet / PDF URL</Label>
        <div className="flex gap-2">
          <Input
            id="worksheetUrl"
            name="worksheetUrl"
            value={worksheetUrl}
            onChange={(e) => setWorksheetUrl(e.target.value)}
            placeholder="Paste a URL or upload a PDF →"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => worksheetFileRef.current?.click()}
            disabled={worksheetState === "uploading"}
            title="Upload PDF to Bunny CDN"
          >
            {worksheetState === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>
          <input
            ref={worksheetFileRef}
            type="file"
            accept=".pdf,.zip,.docx,.xlsx,.png,.jpg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleWorksheetUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {worksheetState === "uploading" && (
          <Progress value={worksheetProgress} className="h-2" />
        )}

        <UploadStatus state={worksheetState} message={worksheetMessage} />
      </div>

      {/* Duration + Context */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="durationSeconds">Duration (seconds)</Label>
          <Input
            id="durationSeconds"
            name="durationSeconds"
            type="number"
            defaultValue={initialData?.durationSeconds ?? ""}
            min={0}
            placeholder="e.g. 600"
          />
        </div>
        <div className="space-y-2">
          <Label>Context</Label>
          <Select value={context} onValueChange={setContext}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTEXT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls whether this lecture appears in the full course, standalone
            module, or both.
          </p>
        </div>
      </div>

      {/* Sort + Preview */}
      <div className="flex items-end gap-6">
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={initialData?.sortOrder ?? 0}
            min={0}
            className="w-24"
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={isPreview} onCheckedChange={setIsPreview} />
          <Label>Free Preview</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting || videoState === "uploading" || worksheetState === "uploading"}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Lecture"}
      </Button>
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function UploadStatus({
  state,
  message,
}: {
  state: UploadState;
  message: string;
}) {
  if (state === "idle" || !message) return null;

  const Icon =
    state === "done"
      ? CheckCircle2
      : state === "error"
      ? AlertCircle
      : Loader2;

  const color =
    state === "done"
      ? "text-green-600"
      : state === "error"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <p className={`flex items-center gap-1.5 text-xs ${color}`}>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${state === "uploading" ? "animate-spin" : ""}`}
      />
      {message}
    </p>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * XHR-based upload with progress tracking.
 * fetch() does not expose upload progress, XHR does.
 */
function xhrUpload({
  url,
  file,
  headers = {},
  formData,
  onProgress,
  parseResponse,
}: {
  url: string;
  file: File;
  headers?: Record<string, string>;
  formData?: FormData;
  onProgress: (percent: number) => void;
  parseResponse?: (xhr: XMLHttpRequest) => Promise<void>;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          if (parseResponse) await parseResponse(xhr);
          resolve();
        } catch (err) {
          reject(err);
        }
      } else {
        // Try to extract a useful error message
        let msg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) msg = body.error;
        } catch {
          if (xhr.responseText) msg = xhr.responseText.slice(0, 200);
        }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("PUT", url);

    // Set custom headers (e.g. Bunny AccessKey)
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    // For direct Bunny PUT, send raw file bytes
    // For our API proxy (worksheets), send FormData
    if (formData) {
      xhr.open("POST", url); // reopen as POST for formData
      xhr.send(formData);
    } else {
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    }
  });
}
