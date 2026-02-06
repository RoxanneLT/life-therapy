"use client";

import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface QuizQuestion {
  id: string;
  questionType: string;
  questionText: string;
  options: unknown;
  explanation: string | null;
  sortOrder: number;
}

interface QuizEditorProps {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    questions: QuizQuestion[];
  } | null;
  onSaveQuiz: (formData: FormData) => Promise<void>;
  onDeleteQuiz: () => Promise<void>;
  onSaveQuestion: (
    quizId: string,
    questionId: string | null,
    formData: FormData
  ) => Promise<void>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
}

export function QuizEditor({
  quiz,
  onSaveQuiz,
  onDeleteQuiz,
  onSaveQuestion,
  onDeleteQuestion,
}: QuizEditorProps) {
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

  async function handleSaveQuiz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingQuiz(true);
    const formData = new FormData(e.currentTarget);
    await onSaveQuiz(formData);
    setSavingQuiz(false);
    toast.success("Quiz saved");
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Quiz settings */}
      <form onSubmit={handleSaveQuiz} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Quiz Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={quiz?.title || "Module Quiz"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passingScore">Passing Score (%)</Label>
            <Input
              id="passingScore"
              name="passingScore"
              type="number"
              defaultValue={quiz?.passingScore ?? 70}
              min={0}
              max={100}
              className="w-24"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={quiz?.description || ""}
            placeholder="Instructions for the quiz (optional)"
            rows={2}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={savingQuiz}>
            {savingQuiz && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {quiz ? "Update Quiz" : "Create Quiz"}
          </Button>
          {quiz && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Quiz
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete quiz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the quiz and all its questions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await onDeleteQuiz();
                      toast.success("Quiz deleted");
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>

      {/* Questions list */}
      {quiz && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold">
              Questions ({quiz.questions.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setEditingQuestion("new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>

          {editingQuestion === "new" && (
            <QuestionForm
              quizId={quiz.id}
              onSave={onSaveQuestion}
              onCancel={() => setEditingQuestion(null)}
            />
          )}

          {quiz.questions.map((q) => (
            <Card key={q.id}>
              {editingQuestion === q.id ? (
                <CardContent className="pt-6">
                  <QuestionForm
                    quizId={quiz.id}
                    question={q}
                    onSave={onSaveQuestion}
                    onCancel={() => setEditingQuestion(null)}
                  />
                </CardContent>
              ) : (
                <>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {q.sortOrder + 1}. {q.questionText}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {q.questionType.replace("_", " ")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingQuestion(q.id)}
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete question?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                await onDeleteQuestion(q.id);
                                toast.success("Question deleted");
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  {q.options && (
                    <CardContent className="pt-0">
                      <OptionsPreview
                        questionType={q.questionType}
                        options={q.options}
                      />
                    </CardContent>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Question Form ---

function QuestionForm({
  quizId,
  question,
  onSave,
  onCancel,
}: {
  quizId: string;
  question?: QuizQuestion;
  onSave: (
    quizId: string,
    questionId: string | null,
    formData: FormData
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [questionType, setQuestionType] = useState(
    question?.questionType || "multiple_choice"
  );
  const [options, setOptions] = useState<string[]>(() => {
    if (question?.options && Array.isArray((question.options as { choices?: string[] }).choices)) {
      return (question.options as { choices: string[]; correctIndex: number }).choices;
    }
    return ["", "", "", ""];
  });
  const [correctIndex, setCorrectIndex] = useState(() => {
    if (question?.options && typeof (question.options as { correctIndex?: number }).correctIndex === "number") {
      return (question.options as { correctIndex: number }).correctIndex;
    }
    return 0;
  });
  const [correctAnswer, setCorrectAnswer] = useState(() => {
    if (question?.questionType === "true_false" && question?.options) {
      return (question.options as { correct: boolean }).correct ? "true" : "false";
    }
    return "true";
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    formData.set("questionType", questionType);
    formData.set("sortOrder", String(question?.sortOrder ?? 0));

    // Build options JSON based on type
    if (questionType === "multiple_choice") {
      formData.set(
        "options",
        JSON.stringify({ choices: options, correctIndex })
      );
    } else if (questionType === "true_false") {
      formData.set(
        "options",
        JSON.stringify({ correct: correctAnswer === "true" })
      );
    } else {
      formData.set("options", "");
    }

    await onSave(quizId, question?.id || null, formData);
    setSaving(false);
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Question Type</Label>
          <Select value={questionType} onValueChange={setQuestionType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
              <SelectItem value="reflection">Reflection</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="questionText">Question</Label>
        <Textarea
          id="questionText"
          name="questionText"
          defaultValue={question?.questionText || ""}
          required
          rows={2}
        />
      </div>

      {questionType === "multiple_choice" && (
        <div className="space-y-3">
          <Label>Answer Choices</Label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctChoice"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="h-4 w-4 accent-brand-600"
              />
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = options.filter((_, j) => j !== i);
                    setOptions(next);
                    if (correctIndex >= next.length) setCorrectIndex(0);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOptions([...options, ""])}
            >
              <Plus className="mr-1 h-3 w-3" /> Add Option
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Select the radio button next to the correct answer.
          </p>
        </div>
      )}

      {questionType === "true_false" && (
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {questionType === "reflection" && (
        <p className="text-sm text-muted-foreground">
          Reflection questions are open-ended and not auto-graded.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="explanation">Explanation (shown after answer)</Label>
        <Textarea
          id="explanation"
          name="explanation"
          defaultValue={question?.explanation || ""}
          rows={2}
          placeholder="Optional explanation of the correct answer..."
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {question ? "Update" : "Add Question"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// --- Options Preview ---

function OptionsPreview({
  questionType,
  options,
}: {
  questionType: string;
  options: unknown;
}) {
  if (questionType === "multiple_choice") {
    const data = options as { choices: string[]; correctIndex: number };
    return (
      <ul className="space-y-1 text-sm">
        {data.choices?.map((c, i) => (
          <li
            key={i}
            className={
              i === data.correctIndex
                ? "font-medium text-brand-600"
                : "text-muted-foreground"
            }
          >
            {i === data.correctIndex ? "✓ " : "  "}
            {c}
          </li>
        ))}
      </ul>
    );
  }

  if (questionType === "true_false") {
    const data = options as { correct: boolean };
    return (
      <p className="text-sm text-brand-600">
        Correct: {data.correct ? "True" : "False"}
      </p>
    );
  }

  return null;
}
