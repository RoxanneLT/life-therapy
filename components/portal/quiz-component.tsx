"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { submitQuizAction } from "@/app/(portal)/portal/(dashboard)/courses/[slug]/learn/actions";

interface QuizQuestion {
  id: string;
  questionType: "multiple_choice" | "true_false" | "reflection";
  questionText: string;
  options: { label: string; value: string }[] | null;
  explanation?: string | null;
}

interface QuizComponentProps {
  quizId: string;
  quizTitle: string;
  passingScore: number;
  questions: QuizQuestion[];
  courseSlug: string;
  previousBest?: { score: number; passed: boolean } | null;
}

export function QuizComponent({
  quizId,
  quizTitle,
  passingScore,
  questions,
  courseSlug,
  previousBest,
}: QuizComponentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    feedback: { questionId: string; correct: boolean; explanation?: string }[];
  } | null>(null);

  async function handleSubmit() {
    // Validate all answered
    const unanswered = questions.filter(
      (q) => !answers[q.id]?.trim()
    );
    if (unanswered.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const res = await submitQuizAction(quizId, courseSlug, answers);
      if ("error" in res) return;
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  if (result) {
    return (
      <div className="space-y-6">
        <Card
          className={
            result.passed
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
          }
        >
          <CardContent className="pt-6 text-center">
            {result.passed ? (
              <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="mx-auto mb-2 h-12 w-12 text-red-500" />
            )}
            <h3 className="text-lg font-semibold">
              {result.passed ? "Quiz Passed!" : "Not Quite..."}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Score: {result.score}% (need {passingScore}% to pass)
            </p>
          </CardContent>
        </Card>

        {/* Show feedback per question */}
        {result.feedback.map((fb, idx) => {
          const q = questions[idx];
          return (
            <Card
              key={fb.questionId}
              className={
                fb.correct ? "border-green-200" : "border-red-200"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {fb.correct ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  Question {idx + 1}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{q.questionText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your answer: {answers[q.id]}
                </p>
                {fb.explanation && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    {fb.explanation}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {!result.passed && (
          <Button
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">{quizTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Pass with {passingScore}% to complete this module.
          {previousBest && (
            <span>
              {" "}
              Best score: {previousBest.score}%
              {previousBest.passed ? " (passed)" : ""}
            </span>
          )}
        </p>
      </div>

      {questions.map((q, idx) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Question {idx + 1}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm">{q.questionText}</p>

            {q.questionType === "reflection" ? (
              <Textarea
                placeholder="Type your reflection..."
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                rows={4}
              />
            ) : (
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(val) => setAnswer(q.id, val)}
              >
                {(q.options || []).map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-center space-x-2"
                  >
                    <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                    <Label htmlFor={`${q.id}-${opt.value}`} className="text-sm">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={loading || questions.some((q) => !answers[q.id]?.trim())}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Submit Quiz
      </Button>
    </div>
  );
}
