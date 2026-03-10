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
import { reorderPackages, deletePackage } from "./actions";

interface Package {
  id: string;
  title: string;
  priceCents: number;
  credits: number;
  courseSlots: number;
  digitalProductSlots: number;
  category: string | null;
  isPublished: boolean;
}

function getPackageContents(pkg: { credits: number; courseSlots: number; digitalProductSlots: number }) {
  const parts: string[] = [];
  if (pkg.courseSlots > 0) parts.push(`${pkg.courseSlots} Course${pkg.courseSlots !== 1 ? "s" : ""}`);
  if (pkg.digitalProductSlots > 0) parts.push(`${pkg.digitalProductSlots} Product${pkg.digitalProductSlots !== 1 ? "s" : ""}`);
  if (pkg.credits > 0) parts.push(`${pkg.credits} Credit${pkg.credits !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" + ") : "Empty";
}

function SortableRow({ pkg, onDelete }: { readonly pkg: Package; readonly onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pkg.id });

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
      <td className="p-3 font-medium">{pkg.title}</td>
      <td className="p-3">
        <span className="text-xs text-muted-foreground">
          {getPackageContents(pkg)}
        </span>
      </td>
      <td className="p-3">
        {pkg.category ? (
          <Badge variant="secondary" className="text-xs">
            {pkg.category}
          </Badge>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td className="p-3 text-right">{formatPrice(pkg.priceCents)}</td>
      <td className="p-3">
        <Badge variant={pkg.isPublished ? "default" : "secondary"}>
          {pkg.isPublished ? "Published" : "Draft"}
        </Badge>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Edit package">
            <Link href={`/admin/packages/${pkg.id}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDeleteButton itemLabel="package" itemName={pkg.title} onDelete={() => onDelete(pkg.id)} />
        </div>
      </td>
    </tr>
  );
}

export function SortablePackageList({ packages: initial }: { readonly packages: Package[] }) {
  const [packages, setPackages] = useState(initial);
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

    setPackages((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
    setSaved(false);
  }

  function handleDelete(id: string) {
    setPackages((prev) => prev.filter((p) => p.id !== id));
    deletePackage(id);
  }

  async function handleSave() {
    setSaving(true);
    await reorderPackages(packages.map((p) => p.id));
    setSaving(false);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <SortableOrderBar dirty={dirty} saving={saving} saved={saved} onSave={handleSave} />

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-sm">
              <th className="w-10 p-3" />
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Contents</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium text-right">Price</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={packages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {packages.map((p) => (
                  <SortableRow key={p.id} pkg={p} onDelete={handleDelete} />
                ))}
                {packages.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No packages yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}
