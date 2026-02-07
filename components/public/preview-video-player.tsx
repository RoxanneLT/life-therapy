"use client";

interface PreviewVideoPlayerProps {
  videoUrl: string;
}

/**
 * Lightweight video embed for public pages.
 * Supports YouTube, Vimeo, and direct video URLs.
 * No position tracking or resume — purely for previews.
 */
export function PreviewVideoPlayer({ videoUrl }: PreviewVideoPlayerProps) {
  const embedUrl = getPreviewEmbedUrl(videoUrl);

  if (!embedUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video src={videoUrl} controls className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={embedUrl}
        title="Preview video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

function getPreviewEmbedUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?byline=0&portrait=0`;
  }

  return null;
}
