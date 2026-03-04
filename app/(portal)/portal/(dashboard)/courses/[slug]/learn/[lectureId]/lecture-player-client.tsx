"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { CoursePlayerLayout } from "@/components/portal/course-player-layout";
import { LectureSidebar } from "@/components/portal/lecture-sidebar";
import { VideoPlayer } from "@/components/portal/video-player";
import { QuizComponent } from "@/components/portal/quiz-component";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Loader2,
  PartyPopper,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  markLectureCompleteAction,
  saveVideoPositionAction,
  saveNoteAction,
} from "../actions";

interface SidebarModule {
  id: string;
  title: string;
  lectures: {
    id: string;
    title: string;
    lectureType: "video" | "text" | "quiz";
    durationSeconds?: number | null;
    completed: boolean;
  }[];
  quiz?: {
    id: string;
    title: string;
    passed: boolean;
  } | null;
}

interface LectureData {
  id: string;
  title: string;
  lectureType: "video" | "text" | "quiz";
  videoUrl?: string | null;
  textContent?: string | null;
  worksheetUrl?: string | null;
  durationSeconds?: number | null;
  completed: boolean;
  videoPosition: number;
  note: string;
}

interface QuizData {
  id: string;
  title: string;
  passingScore: number;
  questions: {
    id: string;
    questionType: "multiple_choice" | "true_false" | "reflection";
    questionText: string;
    options: { label: string; value: string }[] | null;
    explanation?: string | null;
  }[];
  previousBest?: { score: number; passed: boolean } | null;
}

type LecturePlayerProps =
  | {
      courseSlug: string;
      sidebarModules: SidebarModule[];
      currentLectureId: string;
      type: "lecture";
      lecture: LectureData;
      nextLectureId?: string | null;
      nextLectureTitle?: string | null;
    }
  | {
      courseSlug: string;
      sidebarModules: SidebarModule[];
      currentLectureId: string;
      type: "quiz";
      quiz: QuizData;
    };

export function LecturePlayerClient(props: LecturePlayerProps) {
  const { courseSlug, sidebarModules, currentLectureId } = props;

  const sidebar = (
    <LectureSidebar
      courseSlug={courseSlug}
      modules={sidebarModules}
      currentLectureId={currentLectureId}
    />
  );

  return (
    <CoursePlayerLayout sidebar={sidebar}>
      {props.type === "quiz" ? (
        <QuizComponent
          quizId={props.quiz.id}
          quizTitle={props.quiz.title}
          passingScore={props.quiz.passingScore}
          questions={props.quiz.questions}
          courseSlug={courseSlug}
          previousBest={props.quiz.previousBest}
        />
      ) : (
        <LectureContent
          courseSlug={courseSlug}
          lecture={props.lecture}
          nextLectureId={props.nextLectureId}
          nextLectureTitle={props.nextLectureTitle}
          sidebarModules={sidebarModules}
          currentLectureId={currentLectureId}
        />
      )}
    </CoursePlayerLayout>
  );
}

function LectureContent({
  courseSlug,
  lecture,
  nextLectureId,
  nextLectureTitle,
  sidebarModules,
  currentLectureId,
}: {
  courseSlug: string;
  lecture: LectureData;
  nextLectureId?: string | null;
  nextLectureTitle?: string | null;
  sidebarModules: SidebarModule[];
  currentLectureId: string;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(lecture.completed);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [note, setNote] = useState(lecture.note);
  const [savingNote, setSavingNote] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Module completion celebration
  const [showModuleBanner, setShowModuleBanner] = useState(false);
  const currentModule = sidebarModules.find((m) =>
    m.lectures.some((l) => l.id === currentLectureId)
  );

  // Auto-advance countdown
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startAutoAdvance(delaySec = 5) {
    if (!nextLectureId) return;
    setCountdown(delaySec);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          router.push(`/portal/courses/${courseSlug}/learn/${nextLectureId}`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function cancelAutoAdvance() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
  }

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handlePositionChange = useCallback(
    (position: number) => {
      saveVideoPositionAction(lecture.id, position);
    },
    [lecture.id]
  );

  async function handleMarkComplete() {
    setMarkingComplete(true);
    try {
      const result = await markLectureCompleteAction(lecture.id, courseSlug);
      if (!("error" in result)) {
        setCompleted(true);

        // Check if this completes the module
        const otherLectures = currentModule?.lectures.filter(
          (l) => l.id !== currentLectureId
        );
        const moduleNowComplete = otherLectures?.every((l) => l.completed);

        if (moduleNowComplete && currentModule) {
          // Module complete — celebrate!
          setShowModuleBanner(true);
          confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
          setTimeout(() => {
            confetti({ particleCount: 100, spread: 60, origin: { x: 0.2, y: 0.5 } });
          }, 300);
          setTimeout(() => {
            confetti({ particleCount: 100, spread: 60, origin: { x: 0.8, y: 0.5 } });
          }, 600);
          // Longer delay before auto-advance to enjoy the moment
          startAutoAdvance(8);
        } else {
          startAutoAdvance(5);
        }
      }
    } finally {
      setMarkingComplete(false);
    }
  }

  function handleNoteChange(value: string) {
    setNote(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSavingNote(true);
      await saveNoteAction(lecture.id, value);
      setSavingNote(false);
    }, 1500);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      switch (e.key.toLowerCase()) {
        case "n":
          if (nextLectureId) {
            e.preventDefault();
            router.push(`/portal/courses/${courseSlug}/learn/${nextLectureId}`);
          }
          break;
        case "c":
          if (!completed && !markingComplete) {
            e.preventDefault();
            handleMarkComplete();
          }
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, markingComplete, nextLectureId, courseSlug]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold">{lecture.title}</h1>

      {/* Video */}
      {lecture.lectureType === "video" && lecture.videoUrl && (
        <VideoPlayer
          videoUrl={lecture.videoUrl}
          initialPosition={lecture.videoPosition}
          onPositionChange={handlePositionChange}
        />
      )}

      {/* Text content */}
      {lecture.lectureType === "text" && lecture.textContent && (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: lecture.textContent }}
        />
      )}

      {/* Module complete banner */}
      {showModuleBanner && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <PartyPopper className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Module Complete!</p>
            <p className="text-sm text-green-600">
              You&apos;ve finished all lectures in &quot;{currentModule?.title}&quot;
            </p>
          </div>
          <button
            onClick={() => setShowModuleBanner(false)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs: Overview + Notes + Worksheet */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">My Notes</TabsTrigger>
          {lecture.worksheetUrl && (
            <TabsTrigger value="worksheet">Worksheet</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {lecture.textContent && lecture.lectureType === "video" ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: lecture.textContent }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional overview for this lecture.
            </p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Take notes here... they auto-save as you type."
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              rows={8}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {savingNote ? "Saving..." : "Auto-saved"}
            </p>
          </div>
        </TabsContent>

        {lecture.worksheetUrl && (
          <TabsContent value="worksheet" className="mt-4">
            <Button variant="outline" asChild>
              <a
                href={lecture.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Worksheet
              </a>
            </Button>
          </TabsContent>
        )}
      </Tabs>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t pt-4">
        {completed ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </div>
        ) : (
          <Button onClick={handleMarkComplete} disabled={markingComplete}>
            {markingComplete ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Mark Complete
          </Button>
        )}

        {nextLectureId && countdown === null && (
          <Button variant="outline" asChild>
            <Link href={`/portal/courses/${courseSlug}/learn/${nextLectureId}`}>
              {nextLectureTitle || "Next Lecture"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}

        {/* Auto-advance countdown */}
        {countdown !== null && nextLectureId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/portal/courses/${courseSlug}/learn/${nextLectureId}`)
              }
            >
              <ChevronRight className="mr-1 h-4 w-4" />
              Next in {countdown}s
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelAutoAdvance}>
              Stay here
            </Button>
          </div>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-muted-foreground">
        Shortcuts: <kbd className="rounded border px-1">C</kbd> complete
        {nextLectureId && (
          <>
            {" "}
            <kbd className="rounded border px-1">N</kbd> next
          </>
        )}
      </p>
    </div>
  );
}
