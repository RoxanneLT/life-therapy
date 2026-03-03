"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface YearSelectorProps {
  readonly currentYear: number;
}

export function YearSelector({ currentYear }: YearSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => thisYear - 2 + i);

  return (
    <Select
      value={String(currentYear)}
      onValueChange={(val) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", val);
        router.push(`?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
