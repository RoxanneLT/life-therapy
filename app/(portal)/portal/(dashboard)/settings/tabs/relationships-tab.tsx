"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Baby,
  Mail,
  Clock,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Info,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendPartnerInviteAction,
  respondToInviteAction,
  cancelInviteAction,
  addMinorAction,
  updateMinorAction,
  removeRelationshipAction,
} from "../actions";

interface Relationship {
  readonly id: string;
  readonly type: string;
  readonly label: string | null;
  readonly relatedStudentId: string | null;
  readonly relatedFirstName: string;
  readonly relatedLastName: string;
  readonly relatedName: string;
  readonly relatedEmail: string | null;
  readonly isMinor: boolean;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
}

interface Invite {
  readonly id: string;
  readonly fromName: string;
  readonly toName: string;
  readonly toEmail: string;
  readonly relationshipType: string;
  readonly status: string;
  readonly direction: "incoming" | "outgoing";
  readonly createdAt: string;
}

interface BillingInfo {
  readonly individualBilledTo: string | null;
  readonly couplesBilledTo: string | null;
}

interface RelationshipsTabProps {
  readonly relationships: Relationship[];
  readonly invites: Invite[];
  readonly billingInfo: BillingInfo;
}

export function RelationshipsTab({ relationships, invites, billingInfo }: RelationshipsTabProps) {
  const incomingPending = invites.filter((i) => i.direction === "incoming" && i.status === "pending");
  const outgoingPending = invites.filter((i) => i.direction === "outgoing" && i.status === "pending");
  const partners = relationships.filter((r) => r.type === "partner");
  const children = relationships.filter((r) => r.type === "parent");
  const hasPartner = partners.length > 0;

  return (
    <div className="space-y-6">
      {/* Pending incoming invites */}
      {incomingPending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingPending.map((invite) => (
              <IncomingInviteRow key={invite.id} invite={invite} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Partner section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Partner
          </CardTitle>
          {!hasPartner && outgoingPending.length === 0 && (
            <AddPartnerDialog />
          )}
        </CardHeader>
        <CardContent>
          {partners.length === 0 && outgoingPending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No partner linked. Add a partner to book couples sessions together.
            </p>
          ) : (
            <div className="space-y-3">
              {partners.map((rel) => (
                <PartnerRow key={rel.id} relationship={rel} />
              ))}
              {outgoingPending.map((invite) => (
                <OutgoingInviteRow key={invite.id} invite={invite} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Children section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="h-4 w-4" />
            Children / Minors
          </CardTitle>
          <AddMinorDialog />
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No minors added. Add a child to book sessions on their behalf.
            </p>
          ) : (
            <div className="space-y-3">
              {children.map((rel) => (
                <MinorRow key={rel.id} relationship={rel} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing summary */}
      {(billingInfo.individualBilledTo || billingInfo.couplesBilledTo) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Billing
            </CardTitle>
            <CardDescription>
              Who pays for your sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {billingInfo.individualBilledTo && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Individual sessions billed to</span>
                <span className="text-sm font-medium">{billingInfo.individualBilledTo}</span>
              </div>
            )}
            {billingInfo.individualBilledTo && billingInfo.couplesBilledTo && <Separator />}
            {billingInfo.couplesBilledTo && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Couples sessions billed to</span>
                <span className="text-sm font-medium">{billingInfo.couplesBilledTo}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              Billing assignments are managed by your therapist.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Partner row with remove ─────────────────────────────────

function PartnerRow({ relationship }: { readonly relationship: Relationship }) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm("Remove this partner link? This will unlink both accounts.")) return;
    startTransition(async () => {
      const result = await removeRelationshipAction(relationship.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Partner unlinked.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{relationship.relatedName}</p>
          {relationship.relatedEmail && (
            <p className="text-xs text-muted-foreground">{relationship.relatedEmail}</p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={handleRemove}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}

// ── Minor row with edit + remove ────────────────────────────

function MinorRow({ relationship }: { readonly relationship: Relationship }) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm(`Remove ${relationship.relatedName} from your profile?`)) return;
    startTransition(async () => {
      const result = await removeRelationshipAction(relationship.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Minor removed.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Baby className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{relationship.relatedName}</p>
          {relationship.dateOfBirth && (
            <p className="text-xs text-muted-foreground">DOB: {relationship.dateOfBirth}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          No portal access
        </span>
        <EditMinorDialog relationship={relationship} />
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleRemove}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Minor dialog ─────────────────────────────────────────

function EditMinorDialog({ relationship }: { readonly relationship: Relationship }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(relationship.relatedFirstName);
  const [lastName, setLastName] = useState(relationship.relatedLastName);
  const [dateOfBirth, setDateOfBirth] = useState(relationship.dateOfBirth || "");
  const [gender, setGender] = useState(relationship.gender || "");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!relationship.relatedStudentId) return;
    startTransition(async () => {
      const result = await updateMinorAction(relationship.relatedStudentId!, {
        firstName,
        lastName,
        dateOfBirth,
        gender: gender || undefined,
      });
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Minor details updated.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Minor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="editMinorFirstName">First Name</Label>
              <Input
                id="editMinorFirstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="editMinorLastName">Last Name</Label>
              <Input
                id="editMinorLastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="editMinorDob">Date of Birth</Label>
            <Input
              id="editMinorDob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="editMinorGender">Gender (optional)</Label>
            <Input
              id="editMinorGender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={pending || !firstName.trim() || !lastName.trim() || !dateOfBirth}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Incoming invite row ──────────────────────────────────────

function IncomingInviteRow({ invite }: { readonly invite: Invite }) {
  const [pending, startTransition] = useTransition();

  function handleRespond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToInviteAction(invite.id, accept);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(accept ? "Relationship linked!" : "Invite declined.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-background">
      <div>
        <p className="text-sm font-medium">
          {invite.fromName} wants to link as your <strong>{invite.relationshipType}</strong>
        </p>
        <p className="text-xs text-muted-foreground">{invite.toEmail}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleRespond(true)}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRespond(false)}
          disabled={pending}
        >
          <X className="mr-1 h-3 w-3" />
          Decline
        </Button>
      </div>
    </div>
  );
}

// ── Outgoing invite row ──────────────────────────────────────

function OutgoingInviteRow({ invite }: { readonly invite: Invite }) {
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelInviteAction(invite.id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Invite cancelled.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-dashed p-3">
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm">
            Invite sent to <strong>{invite.toName}</strong>
          </p>
          <p className="text-xs text-muted-foreground">{invite.toEmail} — awaiting response</p>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel"}
      </Button>
    </div>
  );
}

// ── Add Partner dialog ───────────────────────────────────────

function AddPartnerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await sendPartnerInviteAction({ name, email });
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Partner invite sent!");
        setName("");
        setEmail("");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 h-3 w-3" />
          Add Partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Partner</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Enter your partner&apos;s details. They&apos;ll receive an email to confirm the link.
        </p>
        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="partnerInviteName">Name</Label>
            <Input
              id="partnerInviteName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="partnerInviteEmail">Email</Label>
            <Input
              id="partnerInviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            An invite email will be sent to your partner.
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={pending || !name.trim() || !email.includes("@")}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Minor dialog ─────────────────────────────────────────

function AddMinorDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await addMinorAction({
        firstName,
        lastName,
        dateOfBirth,
        gender: gender || undefined,
      });
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Minor added successfully!");
        setFirstName("");
        setLastName("");
        setDateOfBirth("");
        setGender("");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Baby className="mr-2 h-3 w-3" />
          Add Minor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Minor</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Add a child or minor under your profile. You&apos;ll be able to book sessions on their behalf.
        </p>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="minorFirstName">First Name</Label>
              <Input
                id="minorFirstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="minorLastName">Last Name</Label>
              <Input
                id="minorLastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="minorDob">Date of Birth</Label>
            <Input
              id="minorDob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="minorGender">Gender (optional)</Label>
            <Input
              id="minorGender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <Baby className="h-3 w-3 shrink-0" />
            You will be set as the billing contact for this minor&apos;s sessions.
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={pending || !firstName.trim() || !lastName.trim() || !dateOfBirth}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Minor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
