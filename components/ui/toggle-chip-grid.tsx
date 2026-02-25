"use client";

import { cn } from "@/lib/utils";

export interface ToggleChipGridProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function ToggleChipGrid({
  options,
  selected,
  onChange,
  disabled = false,
}: ToggleChipGridProps) {
  function toggle(value: string) {
    if (disabled) return;
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              isSelected
                ? "border-brand-600 bg-brand-100 text-brand-800"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {opt.label}
            {isSelected && " ✓"}
          </button>
        );
      })}
    </div>
  );
}
