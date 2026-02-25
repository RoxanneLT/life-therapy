"use client";

import { useState, useCallback, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addRelationshipAction,
  removeRelationshipAction,
  updateRelationshipAction,
  createBillingEntityAction,
  searchClientsAction,
} from "../actions";

// ─── Types ────────────────────────────────────────────────────

interface RelatedStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface BillingEntityData {
  id: string;
  name: string;
  email: string;
  contactPerson: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
}

interface RelationshipData {
  id: string;
  studentId: string;
  relatedStudentId: string | null;
  billingEntityId: string | null;
  relationshipType: string;
  relationshipLabel: string | null;
  relatedStudent?: RelatedStudent | null;
  billingEntity?: BillingEntityData | null;
  student?: RelatedStudent | null;
}

const RELATIONSHIP_TYPES = [
  { value: "partner", label: "Partner / Spouse" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "guardian", label: "Guardian" },
  { value: "corporate", label: "Corporate / Employer" },
  { value: "other", label: "Other" },
];

// ─── Component ────────────────────────────────────────────────

interface RelationshipsTabProps {
  client: Record<string, unknown>;
}

export function RelationshipsTab({ client }: RelationshipsTabProps) {
  const clientId = client.id as string;
  const clientName = `${client.firstName} ${client.lastName}`;
  const relationshipsFrom = (client.relationshipsFrom as RelationshipData[]) || [];
  const relationshipsTo = (client.relationshipsTo as RelationshipData[]) || [];

  const [isPending, startTransition] = useTransition();
  const [editingRel, setEditingRel] = useState<RelationshipData | null>(null);

  function handleRemove(relationshipId: string) {
    if (!confirm("Remove this relationship?")) return;
    startTransition(async () => {
      await removeRelationshipAction(relationshipId, clientId);
      toast.success("Relationship removed");
    });
  }

  // Merge both directions for display
  const allRelationships = [
    ...relationshipsFrom.map((r) => ({
      ...r,
      direction: "from" as const,
      displayName: r.relatedStudent
        ? `${r.relatedStudent.firstName} ${r.relatedStudent.lastName}`
        : r.billingEntity?.name || "Unknown",
      displayEmail: r.relatedStudent?.email || r.billingEntity?.email || "",
      isCorporate: !!r.billingEntityId,
    })),
    ...relationshipsTo.map((r) => ({
      ...r,
      direction: "to" as const,
      displayName: r.student
        ? `${r.student.firstName} ${r.student.lastName}`
        : "Unknown",
      displayEmail: r.student?.email || "",
      isCorporate: false,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Relationships</h2>
        <AddRelationshipDialog clientId={clientId} clientName={clientName} />
      </div>

      {allRelationships.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No relationships linked. Add a relationship to connect this client
            with family members, partners, or corporate billing entities.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {allRelationships.map((rel) => (
            <Card key={rel.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-lg bg-muted p-2">
                  {rel.isCorporate ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{rel.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {rel.displayEmail}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {RELATIONSHIP_TYPES.find(
                        (t) => t.value === rel.relationshipType,
                      )?.label || rel.relationshipType}
                    </Badge>
                    {rel.relationshipLabel && (
                      <Badge variant="outline" className="text-xs">
                        {rel.relationshipLabel}
                      </Badge>
                    )}
                    {rel.direction === "to" && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Linked by them
                      </Badge>
                    )}
                  </div>
                </div>
                {rel.direction === "from" && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingRel(rel)}
                      disabled={isPending}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                      onClick={() => handleRemove(rel.id)}
                      disabled={isPending}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editingRel && (
        <EditRelationshipDialog
          relationship={editingRel}
          clientId={clientId}
          onClose={() => setEditingRel(null)}
        />
      )}
    </div>
  );
}

// ─── Edit Relationship Dialog ─────────────────────────────────

function EditRelationshipDialog({
  relationship,
  clientId,
  onClose,
}: {
  relationship: RelationshipData;
  clientId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState(relationship.relationshipType);
  const [label, setLabel] = useState(relationship.relationshipLabel || "");

  function handleSave() {
    startTransition(async () => {
      try {
        await updateRelationshipAction(relationship.id, clientId, {
          relationshipType: type,
          relationshipLabel: label || undefined,
        });
        toast.success("Relationship updated");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  const displayName = relationship.relatedStudent
    ? `${relationship.relatedStudent.firstName} ${relationship.relatedStudent.lastName}`
    : relationship.billingEntity?.name || "Unknown";

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Relationship — {displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Relationship type */}
          <div className="space-y-2">
            <Label>Relationship Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Husband, HR Manager"
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Relationship Dialog ──────────────────────────────────

function AddRelationshipDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Mode: link to existing client or create corporate entity
  const [mode, setMode] = useState<"client" | "corporate">("client");

  // Client search
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RelatedStudent[]>([]);
  const [selectedClient, setSelectedClient] = useState<RelatedStudent | null>(null);

  // Relationship fields
  const [type, setType] = useState("partner");
  const [label, setLabel] = useState("");

  // Corporate entity fields
  const [entityName, setEntityName] = useState("");
  const [entityEmail, setEntityEmail] = useState("");
  const [entityContact, setEntityContact] = useState("");
  const [entityVat, setEntityVat] = useState("");

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const r = await searchClientsAction(q);
    setResults(r.filter((c) => c.id !== clientId));
  }, [clientId]);

  function handleSearchChange(value: string) {
    setSearch(value);
    // Debounce via setTimeout
    const timer = setTimeout(() => doSearch(value), 300);
    return () => clearTimeout(timer);
  }

  function reset() {
    setMode("client");
    setSearch("");
    setResults([]);
    setSelectedClient(null);
    setType("partner");
    setLabel("");
    setEntityName("");
    setEntityEmail("");
    setEntityContact("");
    setEntityVat("");
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        if (mode === "corporate") {
          // Create entity then link
          const entity = await createBillingEntityAction({
            name: entityName,
            email: entityEmail,
            contactPerson: entityContact || undefined,
            vatNumber: entityVat || undefined,
          });
          await addRelationshipAction({
            studentId: clientId,
            billingEntityId: entity.id,
            relationshipType: "corporate",
            relationshipLabel: label || undefined,
          });
        } else {
          if (!selectedClient) return;
          await addRelationshipAction({
            studentId: clientId,
            relatedStudentId: selectedClient.id,
            relationshipType: type,
            relationshipLabel: label || undefined,
          });
        }
        toast.success("Relationship added");
        reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add relationship");
      }
    });
  }

  const canSubmit =
    mode === "corporate"
      ? entityName.trim() && entityEmail.trim()
      : !!selectedClient;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Relationship
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Relationship for {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "client" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("client")}
            >
              <Users className="mr-2 h-4 w-4" />
              Link Client
            </Button>
            <Button
              type="button"
              variant={mode === "corporate" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("corporate");
                setType("corporate");
              }}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Corporate Entity
            </Button>
          </div>

          {mode === "client" && (
            <>
              {/* Client search */}
              <div className="space-y-2">
                <Label>Search Client</Label>
                <Input
                  placeholder="Type name or email..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {results.length > 0 && !selectedClient && (
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedClient(r);
                          setSearch(`${r.firstName} ${r.lastName}`);
                          setResults([]);
                        }}
                      >
                        <span className="font-medium">
                          {r.firstName} {r.lastName}
                        </span>
                        <span className="text-muted-foreground">{r.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedClient && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="font-medium">
                      {selectedClient.firstName} {selectedClient.lastName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6"
                      onClick={() => {
                        setSelectedClient(null);
                        setSearch("");
                      }}
                    >
                      &times;
                    </Button>
                  </div>
                )}
              </div>

              {/* Relationship type */}
              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </>
          )}

          {mode === "corporate" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Email *</Label>
                  <Input
                    type="email"
                    value={entityEmail}
                    onChange={(e) => setEntityEmail(e.target.value)}
                    placeholder="accounts@acme.co.za"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input
                    value={entityContact}
                    onChange={(e) => setEntityContact(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>VAT Number</Label>
                  <Input
                    value={entityVat}
                    onChange={(e) => setEntityVat(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Label (both modes) */}
          <div className="space-y-2">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Husband, HR Manager"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? "Adding..." : "Add Relationship"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
