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
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { SortableOrderBar } from "@/components/admin/sortable-order-bar";
import { formatPrice } from "@/lib/utils";
import { GripVertical, Pencil } from "lucide-react";
import Link from "next/link";
import { reorderCourses, deleteCourse } from "./actions";

interface Course {
  id: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  price: number;
  modulesCount: number;
  isPublished: boolean;
  isFeatured: boolean;
}

function SortableRow({
  course,
  onDelete,
}: {
  readonly course: Course;
  readonly onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b bg-background">
      <td className="w-10 p-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="p-3">
        <div>
          <p className="font-medium">{course.title}</p>
          {course.subtitle && (
            <p className="text-xs text-muted-foreground">{course.subtitle}</p>
          )}
        </div>
      </td>
      <td className="p-3 text-muted-foreground">
        {course.category?.replaceAll("_", " ") || "—"}
      </td>
      <td className="p-3">{formatPrice(course.price)}</td>
      <td className="p-3">{course.modulesCount}</td>
      <td className="p-3">
        <div className="flex gap-1">
          <Badge variant={course.isPublished ? "default" : "outline"}>
            {course.isPublished ? "Published" : "Draft"}
          </Badge>
          {course.isFeatured && <Badge variant="secondary">Featured</Badge>}
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Edit course">
            <Link href={`/admin/courses/${course.id}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDeleteButton itemLabel="course" itemName={course.title} onDelete={() => onDelete(course.id)} />
        </div>
      </td>
    </tr>
  );
}

export function SortableCourseList({ courses: initial }: { readonly courses: Course[] }) {
  const [courses, setCourses] = useState(initial);
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

    setCourses((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
    setSaved(false);
  }

  function handleDelete(id: string) {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    deleteCourse(id);
  }

  async function handleSave() {
    setSaving(true);
    await reorderCourses(courses.map((c) => c.id));
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
          items={courses.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm">
                  <th className="w-10 p-3" />
                  <th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Price</th>
                  <th className="p-3 font-medium">Modules</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <SortableRow key={c.id} course={c} onDelete={handleDelete} />
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No courses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
