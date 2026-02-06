export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LecturePlayerClient } from "./lecture-player-client";

export default async function LecturePlayerPage({
  params,
}: {
  params: Promise<{ slug: string; lectureId: string }>;
}) {
  const { slug, lectureId } = await params;
  const { student } = await requirePasswordChanged();

  // Check if this is a quiz route (quiz-{quizId})
  const isQuiz = lectureId.startsWith("quiz-");

  if (isQuiz) {
    const quizId = lectureId.replace("quiz-", "");
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        module: {
          select: {
            courseId: true,
            course: { select: { slug: true } },
          },
        },
      },
    });

    if (!quiz || quiz.module.course.slug !== slug) notFound();

    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: quiz.module.courseId,
        },
      },
    });
    if (!enrollment) notFound();

    // Get best attempt
    const bestAttempt = await prisma.quizAttempt.findFirst({
      where: { quizId, studentId: student.id },
      orderBy: { score: "desc" },
      select: { score: true, passed: true },
    });

    // Get sidebar data
    const sidebarData = await getSidebarData(slug, student.id);

    return (
      <LecturePlayerClient
        courseSlug={slug}
        sidebarModules={sidebarData}
        currentLectureId={lectureId}
        type="quiz"
        quiz={{
          id: quiz.id,
          title: quiz.title,
          passingScore: quiz.passingScore,
          questions: quiz.questions.map((q) => ({
            id: q.id,
            questionType: q.questionType as "multiple_choice" | "true_false" | "reflection",
            questionText: q.questionText,
            options: q.options as { label: string; value: string }[] | null,
            explanation: q.explanation,
          })),
          previousBest: bestAttempt,
        }}
      />
    );
  }

  // Regular lecture
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      module: {
        select: {
          courseId: true,
          course: { select: { slug: true } },
        },
      },
      notes: {
        where: { studentId: student.id },
        select: { content: true },
        take: 1,
      },
    },
  });

  if (!lecture || lecture.module.course.slug !== slug) notFound();

  // Verify enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId: student.id,
        courseId: lecture.module.courseId,
      },
    },
  });
  if (!enrollment) notFound();

  // Get progress for this lecture
  const progress = await prisma.lectureProgress.findUnique({
    where: {
      studentId_lectureId: { studentId: student.id, lectureId },
    },
  });

  // Get sidebar data
  const sidebarData = await getSidebarData(slug, student.id);

  // Find next lecture
  const nextLecture = await getNextLecture(slug, lectureId);

  return (
    <LecturePlayerClient
      courseSlug={slug}
      sidebarModules={sidebarData}
      currentLectureId={lectureId}
      type="lecture"
      lecture={{
        id: lecture.id,
        title: lecture.title,
        lectureType: lecture.lectureType as "video" | "text" | "quiz",
        videoUrl: lecture.videoUrl,
        textContent: lecture.textContent,
        worksheetUrl: lecture.worksheetUrl,
        durationSeconds: lecture.durationSeconds,
        completed: progress?.completed || false,
        videoPosition: progress?.videoPosition || 0,
        note: lecture.notes[0]?.content || "",
      }}
      nextLectureId={nextLecture?.id}
      nextLectureTitle={nextLecture?.title}
    />
  );
}

async function getSidebarData(courseSlug: string, studentId: string) {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lectures: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              lectureType: true,
              durationSeconds: true,
            },
          },
          quiz: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!course) return [];

  const allLectureIds = course.modules.flatMap((m) =>
    m.lectures.map((l) => l.id)
  );

  const completedProgress =
    allLectureIds.length > 0
      ? await prisma.lectureProgress.findMany({
          where: {
            studentId,
            lectureId: { in: allLectureIds },
            completed: true,
          },
          select: { lectureId: true },
        })
      : [];
  const completedIds = new Set(completedProgress.map((p) => p.lectureId));

  // Get quiz pass status
  const quizIds = course.modules
    .filter((m) => m.quiz)
    .map((m) => m.quiz!.id);

  const quizAttempts =
    quizIds.length > 0
      ? await prisma.quizAttempt.findMany({
          where: {
            studentId,
            quizId: { in: quizIds },
            passed: true,
          },
          select: { quizId: true },
        })
      : [];
  const passedQuizIds = new Set(quizAttempts.map((a) => a.quizId));

  return course.modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    lectures: mod.lectures.map((l) => ({
      id: l.id,
      title: l.title,
      lectureType: l.lectureType as "video" | "text" | "quiz",
      durationSeconds: l.durationSeconds,
      completed: completedIds.has(l.id),
    })),
    quiz: mod.quiz
      ? {
          id: mod.quiz.id,
          title: mod.quiz.title,
          passed: passedQuizIds.has(mod.quiz.id),
        }
      : null,
  }));
}

async function getNextLecture(
  courseSlug: string,
  currentLectureId: string
): Promise<{ id: string; title: string } | null> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lectures: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!course) return null;

  const allLectures = course.modules.flatMap((m) => m.lectures);
  const currentIndex = allLectures.findIndex(
    (l) => l.id === currentLectureId
  );

  if (currentIndex === -1 || currentIndex === allLectures.length - 1) {
    return null;
  }

  return allLectures[currentIndex + 1];
}
