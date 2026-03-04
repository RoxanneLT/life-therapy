"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GripVertical,
  Loader2,
  Check,
  BookOpen,
  HelpCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { reorderModules, deleteModule } from "./actions";

interface Module {
  id: string;
  title: string;
  lectureCount: number;
  hasQuiz: boolean;
}

function SortableModuleCard({
  mod,
  index,
  courseId,
}: {
  mod: Module;
  index: number;
  courseId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {index + 1}
          </span>
          <div>
            <CardTitle className="text-base">{mod.title}</CardTitle>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {mod.lectureCount} lecture{mod.lectureCount !== 1 && "s"}
              </span>
              {mod.hasQuiz && (
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Quiz
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/courses/${courseId}/modules/${mod.id}/lectures`}>
              Lectures
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/courses/${courseId}/modules/${mod.id}/quiz`}>
              Quiz
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/courses/${courseId}/modules/${mod.id}`}>
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete "${mod.title}"? This will permanently delete all its lectures and quizzes.`)) {
                deleteModule(courseId, mod.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

export function SortableModuleList({
  modules: initial,
  courseId,
}: {
  modules: Module[];
  courseId: string;
}) {
  const [modules, setModules] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setModules((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await reorderModules(courseId, modules.map((m) => m.id));
    setSaving(false);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      {(dirty || saved) && (
        <div className="mb-4 flex items-center gap-3">
          {dirty && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Order
            </Button>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Order saved
            </span>
          )}
          {dirty && (
            <span className="text-sm text-muted-foreground">
              Drag modules to reorder, then save
            </span>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {modules.map((mod, index) => (
              <SortableModuleCard
                key={mod.id}
                mod={mod}
                index={index}
                courseId={courseId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
