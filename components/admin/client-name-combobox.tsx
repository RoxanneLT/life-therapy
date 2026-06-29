"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export interface ClientOption {
  /** Full name — used for searching and shown in the dropdown. */
  fullName: string;
  /** Public display name placed into the field on select (e.g. "Sarah M."). */
  fillName: string;
}

interface ClientNameComboboxProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Fired when a suggestion is picked. */
  readonly onSelectClient: (client: ClientOption) => void;
  readonly clients: ClientOption[];
  readonly id?: string;
  readonly name?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
}

/**
 * Free-text input with client suggestions. Start typing to filter the client
 * list; picking a suggestion fills the public display name. Custom names not in
 * the list are still allowed.
 */
export function ClientNameCombobox({
  value,
  onChange,
  onSelectClient,
  clients,
  id,
  name,
  placeholder,
  required,
}: ClientNameComboboxProps) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => c.fullName.toLowerCase().includes(q) && c.fullName.toLowerCase() !== q)
      .slice(0, 8);
  }, [value, clients]);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion click registers before the list closes.
          setTimeout(() => setOpen(false), 120);
        }}
      />

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
          {matches.map((c) => (
            <li key={c.fullName}>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  // Prevent the input blur from firing before the click.
                  e.preventDefault();
                  onSelectClient(c);
                  setOpen(false);
                }}
              >
                {c.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
