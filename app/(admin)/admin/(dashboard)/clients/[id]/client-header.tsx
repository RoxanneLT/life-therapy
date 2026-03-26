"use client";

import { useState } from "react";
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
    <div className="flex items-center gap-3">
      <h1 className="font-heading text-2xl font-bold">{clientName}</h1>
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
    </div>
  );
}
