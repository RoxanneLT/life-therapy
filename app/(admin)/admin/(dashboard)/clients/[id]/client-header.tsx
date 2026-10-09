"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatusSelect } from "./status-select";
import { ConvertDialog } from "./convert-dialog";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface IntakeData {
  behaviours: string[];
  feelings: string[];
  symptoms: string[];
}

export function ClientHeader({
  client,
  currentStatus,
  existingIntake,
}: {
  client: ClientData;
  currentStatus: string;
  existingIntake: IntakeData | null;
}) {
  const [convertOpen, setConvertOpen] = useState(false);
  const clientName = `${client.firstName} ${client.lastName}`;

  return (
    <PageHeader
      back={{ href: "/admin/clients", to: "Clients" }}
      title={clientName}
      badges={
        <>
      <StatusSelect
        clientId={client.id}
        currentStatus={currentStatus}
        clientName={clientName}
        onOpenConvertDialog={
          currentStatus === "potential" ? () => setConvertOpen(true) : undefined
        }
      />
      {currentStatus === "potential" && (
        <ConvertDialog
          client={client}
          existingIntake={existingIntake}
          externalOpen={convertOpen}
          onExternalOpenChange={setConvertOpen}
        />
      )}
        </>
      }
    />
  );
}
