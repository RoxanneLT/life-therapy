"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PlayCircle,
  FileText,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface LectureSidebarItem {
  id: string;
  title: string;
  lectureType: "video" | "text" | "quiz";
  durationSeconds?: number | null;
  completed: boolean;
}

interface ModuleSidebarItem {
  id: string;
  title: string;
  lectures: LectureSidebarItem[];
  quiz?: {
    id: string;
    title: string;
    passed: boolean;
  } | null;
}

interface LectureSidebarProps {
  courseSlug: string;
  modules: ModuleSidebarItem[];
  currentLectureId?: string;
  className?: string;
}

export function LectureSidebar({
  courseSlug,
  modules,
  currentLectureId,
  className,
}: LectureSidebarProps) {
  // Auto-expand module that contains the current lecture
  const currentModuleId = modules.find((m) =>
    m.lectures.some((l) => l.id === currentLectureId)
  )?.id;

  return (
    <div className={cn("space-y-1", className)}>
      {modules.map((mod) => (
        <ModuleSection
          key={mod.id}
          module={mod}
          courseSlug={courseSlug}
          currentLectureId={currentLectureId}
          defaultExpanded={mod.id === currentModuleId}
        />
      ))}
    </div>
  );
}

function ModuleSection({
  module: mod,
  courseSlug,
  currentLectureId,
  defaultExpanded,
}: {
  module: ModuleSidebarItem;
  courseSlug: string;
  currentLectureId?: string;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const completedCount = mod.lectures.filter((l) => l.completed).length;
  const allComplete =
    completedCount === mod.lectures.length && mod.lectures.length > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{mod.title}</span>
        <span className="text-xs text-muted-foreground">
          {allComplete ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            `${completedCount}/${mod.lectures.length}`
          )}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-0.5 border-l pb-2 pl-2">
          {mod.lectures.map((lecture) => (
            <Link
              key={lecture.id}
              href={`/portal/courses/${courseSlug}/learn/${lecture.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                lecture.id === currentLectureId
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {lecture.completed ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
              ) : (
                <LectureIcon type={lecture.lectureType} />
              )}
              <span className="flex-1 truncate">{lecture.title}</span>
              {lecture.durationSeconds && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(lecture.durationSeconds)}
                </span>
              )}
            </Link>
          ))}
          {mod.quiz && (
            <Link
              href={`/portal/courses/${courseSlug}/learn/quiz-${mod.quiz.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                currentLectureId === `quiz-${mod.quiz.id}`
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {mod.quiz.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
              ) : (
                <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="flex-1 truncate">{mod.quiz.title}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function LectureIcon({ type }: { type: string }) {
  switch (type) {
    case "video":
      return <PlayCircle className="h-3.5 w-3.5 flex-shrink-0" />;
    case "text":
      return <FileText className="h-3.5 w-3.5 flex-shrink-0" />;
    case "quiz":
      return <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />;
    default:
      return <PlayCircle className="h-3.5 w-3.5 flex-shrink-0" />;
  }
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${hr}h ${rem}m` : `${hr}h`;
}
