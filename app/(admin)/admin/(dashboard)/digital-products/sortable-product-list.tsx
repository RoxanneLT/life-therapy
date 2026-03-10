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
import { reorderDigitalProducts, deleteDigitalProduct } from "./actions";

interface Product {
  id: string;
  title: string;
  priceCents: number;
  category: string | null;
  fileName: string | null;
  fileUrl: string;
  isPublished: boolean;
}

function SortableRow({ product, onDelete }: { readonly product: Product; readonly onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

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
      <td className="p-3 font-medium">{product.title}</td>
      <td className="p-3">{formatPrice(product.priceCents)}</td>
      <td className="p-3">
        {product.category ? (
          <Badge variant="secondary" className="text-xs">
            {product.category}
          </Badge>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {product.fileName || product.fileUrl.split("/").pop()}
      </td>
      <td className="p-3">
        <Badge variant={product.isPublished ? "default" : "outline"}>
          {product.isPublished ? "Published" : "Draft"}
        </Badge>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Edit product">
            <Link href={`/admin/digital-products/${product.id}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <ConfirmDeleteButton itemLabel="product" itemName={product.title} onDelete={() => onDelete(product.id)} />
        </div>
      </td>
    </tr>
  );
}

export function SortableProductList({ products: initial }: { readonly products: Product[] }) {
  const [products, setProducts] = useState(initial);
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

    setProducts((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
    setSaved(false);
  }

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    deleteDigitalProduct(id);
  }

  async function handleSave() {
    setSaving(true);
    await reorderDigitalProducts(products.map((p) => p.id));
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
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-sm">
                <th className="w-10 p-3" />
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Price (ZAR)</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">File</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <SortableContext
              items={products.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {products.map((p) => (
                  <SortableRow key={p.id} product={p} onDelete={handleDelete} />
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No digital products yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>
    </div>
  );
}
