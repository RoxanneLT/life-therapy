"use client";

import { CategoryManager as SharedCategoryManager } from "@/components/admin/category-manager";
import { renameCategory, deleteCategory } from "./actions";

interface CategoryManagerProps {
  categories: { name: string; count: number }[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  return (
    <SharedCategoryManager
      categories={categories}
      noun="product"
      onRename={renameCategory}
      onDelete={deleteCategory}
    />
  );
}
