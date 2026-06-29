"use client";

import { CategoryManager as SharedCategoryManager } from "@/components/admin/category-manager";
import { renamePackageCategory, deletePackageCategory } from "./actions";

interface PackageCategoryManagerProps {
  categories: { name: string; count: number }[];
}

export function PackageCategoryManager({ categories }: PackageCategoryManagerProps) {
  return (
    <SharedCategoryManager
      categories={categories}
      noun="package"
      onRename={renamePackageCategory}
      onDelete={deletePackageCategory}
    />
  );
}
