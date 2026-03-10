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
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { SortableOrderBar } from "@/components/admin/sortable-order-bar";
import {
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { reorderLectures, deleteLecture } from "./actions";

const TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
};

interface Lecture {
  id: string;
  title: string;
  lectureType: string;
  durationSeconds?: number | null;
  isPreview: boolean;
}

function SortableLectureCard({
  lec,
  index,
  courseId,
  moduleId,
  onDelete,
}: {
  readonly lec: Lecture;
  readonly index: number;
  readonly courseId: string;
  readonly moduleId: string;
  readonly onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lec.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = TYPE_ICONS[lec.lectureType] || FileText;
  const base = `/admin/courses/${courseId}/modules/${moduleId}/lectures`;

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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {index + 1}. {lec.title}
              {lec.isPreview && (
                <Badge variant="secondary" className="text-xs">
                  <Eye className="mr-1 h-3 w-3" />
                  Preview
                </Badge>
              )}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lec.lectureType}
              {lec.durationSeconds
                ? ` · ${Math.floor(lec.durationSeconds / 60)}m`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/${lec.id}`}>Edit</Link>
          </Button>
          <ConfirmDeleteButton itemLabel="lecture" itemName={lec.title} onDelete={() => onDelete(lec.id)} />
        </div>
      </CardHeader>
    </Card>
  );
}

export function SortableLectureList({
  lectures: initial,
  courseId,
  moduleId,
}: {
  readonly lectures: Lecture[];
  readonly courseId: string;
  readonly moduleId: string;
}) {
  const [lectures, setLectures] = useState(initial);
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

    setLectures((prev) => {
      const oldIndex = prev.findIndex((l) => l.id === active.id);
      const newIndex = prev.findIndex((l) => l.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
    setSaved(false);
  }

  function handleDelete(id: string) {
    setLectures((prev) => prev.filter((l) => l.id !== id));
    deleteLecture(courseId, moduleId, id);
  }

  async function handleSave() {
    setSaving(true);
    await reorderLectures(courseId, moduleId, lectures.map((l) => l.id));
    setSaving(false);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <SortableOrderBar dirty={dirty} saving={saving} saved={saved} onSave={handleSave} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={lectures.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {lectures.map((lec, index) => (
              <SortableLectureCard
                key={lec.id}
                lec={lec}
                index={index}
                courseId={courseId}
                moduleId={moduleId}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
