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
import { Loader2, CheckCircle2, AlertCircle, Video, FileText } from "lucide-react";

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
  /** courseSlug and moduleSlug are used to build the Bunny storage path */
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
  const [durationSeconds, setDurationSeconds] = useState<string>(
    initialData?.durationSeconds != null ? String(initialData.durationSeconds) : ""
  );

  // Video URL field value (may be updated by Bunny Stream upload)
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || "");
  const [videoUploadState, setVideoUploadState] = useState<UploadState>("idle");
  const [videoUploadMessage, setVideoUploadMessage] = useState("");

  // Worksheet URL field value (may be updated by Bunny Storage upload)
  const [worksheetUrl, setWorksheetUrl] = useState(initialData?.worksheetUrl || "");
  const [worksheetUploadState, setWorksheetUploadState] = useState<UploadState>("idle");
  const [worksheetUploadMessage, setWorksheetUploadMessage] = useState("");

  const videoFileRef = useRef<HTMLInputElement>(null);
  const worksheetFileRef = useRef<HTMLInputElement>(null);

  /** Read video duration from browser metadata */
  function detectDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const dur = Math.round(video.duration);
        URL.revokeObjectURL(video.src);
        resolve(Number.isFinite(dur) ? dur : null);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
      video.src = URL.createObjectURL(file);
    });
  }

  // Upload progress (0–100)
  const [videoProgress, setVideoProgress] = useState(0);

  /** Upload with XMLHttpRequest for progress tracking */
  function uploadWithProgress(url: string, body: FormData): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
        else reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(body);
    });
  }

  // ── Video upload via Bunny Stream ───────────────────────────────────────
  async function handleVideoUpload(file: File) {
    setVideoUploadState("uploading");
    setVideoProgress(0);
    setVideoUploadMessage("Reading video metadata…");

    try {
      // Auto-detect duration
      const detected = await detectDuration(file);
      if (detected) setDurationSeconds(String(detected));

      // Step 1: Create video entry and get GUID
      setVideoUploadMessage("Creating video entry…");
      const createRes = await fetch("/api/bunny/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: file.name }),
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      const { guid } = await createRes.json();

      setVideoUploadMessage(`Uploading "${file.name}" (${formatBytes(file.size)})…`);

      // Step 2: Upload the video file with progress
      const uploadForm = new FormData();
      uploadForm.set("file", file);
      uploadForm.set("guid", guid);

      const responseText = await uploadWithProgress("/api/bunny/stream", uploadForm);
      const { embedUrl } = JSON.parse(responseText);

      // If replacing an existing Bunny Stream video, delete the old one
      if (videoUrl && videoUrl.includes("iframe.mediadelivery.net/embed") && videoUrl !== embedUrl) {
        fetch("/api/bunny/stream", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedUrl: videoUrl }),
        }).catch(() => {});
      }

      setVideoUrl(embedUrl);
      setVideoUploadState("done");
      setVideoUploadMessage("Video uploaded — encoding in progress on Bunny");
    } catch (err: unknown) {
      setVideoUploadState("error");
      const message = err instanceof Error ? err.message : String(err);
      setVideoUploadMessage(message || "Upload failed");
    }
  }

  // ── Worksheet upload via Bunny Storage ─────────────────────────────────
  async function handleWorksheetUpload(file: File) {
    setWorksheetUploadState("uploading");
    setWorksheetUploadMessage(`Uploading "${file.name}" (${formatBytes(file.size)})…`);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("courseSlug", courseSlug);
      formData.set("moduleSlug", moduleSlug);

      const res = await fetch("/api/bunny/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();

      setWorksheetUrl(url);
      setWorksheetUploadState("done");
      setWorksheetUploadMessage("✓ File uploaded to CDN");
    } catch (err: unknown) {
      setWorksheetUploadState("error");
      const message = err instanceof Error ? err.message : String(err);
      setWorksheetUploadMessage(message || "Upload failed");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lectureType", lectureType);
    formData.set("isPreview", String(isPreview));
    formData.set("context", context);
    // Ensure the Bunny URLs are included
    formData.set("videoUrl", videoUrl);
    formData.set("worksheetUrl", worksheetUrl);
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
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

      {/* ── Video URL + Bunny Stream upload ────────────────────────────── */}
      {lectureType === "video" && (
        <div className="space-y-2">
          <Label htmlFor="videoUrl">Video URL</Label>
          <div className="flex gap-2">
            <Input
              id="videoUrl"
              name="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://iframe.mediadelivery.net/embed/… or YouTube/Vimeo"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => videoFileRef.current?.click()}
              disabled={videoUploadState === "uploading"}
              title="Upload to Bunny Stream"
            >
              {videoUploadState === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={videoFileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVideoUpload(file);
                e.target.value = "";
              }}
            />
          </div>
          <UploadStatus state={videoUploadState} message={videoUploadMessage} progress={videoProgress} />
          <p className="text-xs text-muted-foreground">
            Paste a YouTube/Vimeo URL, a Bunny Stream embed URL, or click the{" "}
            <Video className="inline h-3 w-3" /> button to upload directly to Bunny Stream.
          </p>
        </div>
      )}

      {/* ── Text content ───────────────────────────────────────────────── */}
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

      {/* ── Worksheet URL + Bunny Storage upload ───────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="worksheetUrl">Worksheet / PDF URL</Label>
        <div className="flex gap-2">
          <Input
            id="worksheetUrl"
            name="worksheetUrl"
            value={worksheetUrl}
            onChange={(e) => setWorksheetUrl(e.target.value)}
            placeholder="Link to downloadable worksheet (optional)"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => worksheetFileRef.current?.click()}
            disabled={worksheetUploadState === "uploading"}
            title="Upload PDF to Bunny CDN"
          >
            {worksheetUploadState === "uploading" ? (
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
        <UploadStatus state={worksheetUploadState} message={worksheetUploadMessage} />
        <p className="text-xs text-muted-foreground">
          Paste a direct URL or click the{" "}
          <FileText className="inline h-3 w-3" /> button to upload a PDF/file to Bunny CDN.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="durationSeconds">Duration (seconds)</Label>
          <Input
            id="durationSeconds"
            name="durationSeconds"
            type="number"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            min={0}
            placeholder="Auto-filled on upload"
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
            Controls whether this lecture appears in the full course, standalone short course, or both
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-end gap-2 pb-1">
          <Switch checked={isPreview} onCheckedChange={setIsPreview} />
          <Label>Free Preview</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Lecture"}
      </Button>
    </form>
  );
}

// ── Small helper components ──────────────────────────────────────────────────

function UploadStatus({
  state,
  message,
  progress,
}: {
  state: UploadState;
  message: string;
  progress?: number;
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
    <div className="space-y-1">
      <p className={`flex items-center gap-1.5 text-xs ${color}`}>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${state === "uploading" ? "animate-spin" : ""}`} />
        {message}
        {state === "uploading" && progress != null && progress > 0 && (
          <span className="font-medium">{progress}%</span>
        )}
      </p>
      {state === "uploading" && progress != null && progress > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
