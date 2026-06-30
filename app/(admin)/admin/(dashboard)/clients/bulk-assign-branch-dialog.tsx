"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getClientsForBulkAction, bulkAssignBranchAction } from "./actions";
import { getBranchOptionsAction } from "./[id]/actions";

const NONE = "__none__";

interface ClientRow {
  id: string;
  name: string;
  email: string;
  branch: string | null;
}
interface BranchOpt {
  slug: string;
  label: string;
}

export function BulkAssignBranchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [branch, setBranch] = useState<string>(NONE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getClientsForBulkAction(), getBranchOptionsAction()])
      .then(([cs, bs]) => {
        setClients(cs);
        setBranches(bs.map((b) => ({ slug: b.slug, label: b.label })));
      })
      .catch(() => toast.error("Could not load clients."))
      .finally(() => setLoading(false));
  }, [open]);

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    : clients;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function branchLabelFor(slug: string | null): string | null {
    if (!slug) return null;
    return branches.find((b) => b.slug === slug)?.label ?? slug;
  }

  async function handleAssign() {
    setSaving(true);
    const res = await bulkAssignBranchAction([...selected], branch === NONE ? null : branch);
    if (res.success) {
      toast.success(`Updated ${res.count} client${res.count === 1 ? "" : "s"}.`);
      setOpen(false);
      setSelected(new Set());
      setBranch(NONE);
      setFilter("");
      router.refresh();
    } else {
      toast.error("Could not assign the branch.");
    }
    setSaving(false);
  }

  const targetLabel = branch === NONE ? "Not assigned" : branchLabelFor(branch);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="mr-1.5 h-4 w-4" />
          Assign branches
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk assign office branch</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a branch…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not assigned (clear branch)</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter by name or email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No clients found.</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/50"
                >
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                  </div>
                  {c.branch && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {branchLabelFor(c.branch)}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button onClick={handleAssign} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {branch === NONE
              ? `Clear branch (${selected.size})`
              : `Assign ${selected.size} to ${targetLabel ?? "…"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
