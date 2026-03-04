"use client";

import { useEffect, useRef, useCallback } from "react";

interface VideoPlayerProps {
  videoUrl: string;
  initialPosition?: number;
  onPositionChange?: (position: number) => void;
}

/**
 * Video embed wrapper. Supports YouTube, Vimeo, or direct URLs.
 * Saves playback position via debounced callback.
 */
export function VideoPlayer({
  videoUrl,
  initialPosition = 0,
  onPositionChange,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const positionRef = useRef(initialPosition);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const embedUrl = getEmbedUrl(videoUrl, initialPosition);
  const isDirectVideo = !embedUrl;

  // Debounced position save for direct video
  const savePosition = useCallback(
    (pos: number) => {
      positionRef.current = pos;
      onPositionChange?.(Math.floor(pos));
    },
    [onPositionChange]
  );

  useEffect(() => {
    const timer = timerRef.current;
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Keyboard shortcuts for direct video playback
  useEffect(() => {
    if (!isDirectVideo) return;
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (video.paused) { video.play(); } else { video.pause(); }
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case "m":
        case "M":
          e.preventDefault();
          video.muted = !video.muted;
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirectVideo]);

  if (isDirectVideo) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="h-full w-full"
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            if (Math.abs(video.currentTime - positionRef.current) > 10) {
              savePosition(video.currentTime);
            }
          }}
          onLoadedMetadata={(e) => {
            if (initialPosition > 0) {
              e.currentTarget.currentTime = initialPosition;
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

function getEmbedUrl(
  url: string,
  startSeconds: number
): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  if (ytMatch) {
    const start = startSeconds > 0 ? `&start=${Math.floor(startSeconds)}` : "";
    return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0${start}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    const time = startSeconds > 0 ? `#t=${Math.floor(startSeconds)}s` : "";
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?byline=0&portrait=0${time}`;
  }

  // Bunny Stream (embed URL — append resume position if available)
  if (url.includes("iframe.mediadelivery.net/embed")) {
    if (startSeconds > 0) {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}t=${Math.floor(startSeconds)}`;
    }
    return url;
  }

  // Not a known embed provider — treat as direct video
  return null;
}
