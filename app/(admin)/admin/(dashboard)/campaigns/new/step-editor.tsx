"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const VARIABLE_CHIPS = [
  { key: "firstName", label: "First Name" },
  { key: "unsubscribeUrl", label: "Unsubscribe URL" },
];

export interface StepData {
  dayOffset: number;
  subject: string;
  previewText: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}

interface StepEditorProps {
  index: number;
  step: StepData;
  isExpanded: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onChange: (step: StepData) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function StepEditor({
  index,
  step,
  isExpanded,
  canMoveUp,
  canMoveDown,
  canRemove,
  onToggle,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: StepEditorProps) {
  function update(field: keyof StepData, value: string | number) {
    onChange({ ...step, [field]: value });
  }

  function insertVariable(variable: string, target: "subject" | "body") {
    const text = `{{${variable}}}`;
    if (target === "subject") {
      update("subject", step.subject + text);
    } else {
      update("bodyHtml", step.bodyHtml + text);
    }
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0">
              Step {index + 1}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Day {step.dayOffset}
            </span>
            {step.subject && (
              <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                — {step.subject}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canMoveUp && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
            )}
            {canMoveDown && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            )}
            {canRemove && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remove step ${index + 1}?`)) onRemove();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Day Offset</Label>
              <Input
                type="number"
                min={0}
                value={step.dayOffset}
                onChange={(e) => update("dayOffset", Number.parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Days after campaign start to send this email
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject Line</Label>
            <Input
              value={step.subject}
              onChange={(e) => update("subject", e.target.value)}
              placeholder="e.g. Welcome back, {{firstName}}!"
            />
            <div className="flex gap-1">
              {VARIABLE_CHIPS.filter((v) => v.key === "firstName").map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-brand-50"
                  onClick={() => insertVariable(v.key, "subject")}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preview Text</Label>
            <Input
              value={step.previewText}
              onChange={(e) => update("previewText", e.target.value)}
              placeholder="Shown in inbox beside the subject..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body HTML</Label>
            <div className="mb-1 flex gap-1.5 text-xs text-muted-foreground">
              Variables:{" "}
              {VARIABLE_CHIPS.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-brand-50"
                  onClick={() => insertVariable(v.key, "body")}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
            <Textarea
              value={step.bodyHtml}
              onChange={(e) => update("bodyHtml", e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="<p>Hi {{firstName}},</p>"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>CTA Button Text (optional)</Label>
              <Input
                value={step.ctaText}
                onChange={(e) => update("ctaText", e.target.value)}
                placeholder="e.g. Explore Courses"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CTA Button URL</Label>
              <Input
                value={step.ctaUrl}
                onChange={(e) => update("ctaUrl", e.target.value)}
                placeholder="/courses or https://..."
                className="font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
