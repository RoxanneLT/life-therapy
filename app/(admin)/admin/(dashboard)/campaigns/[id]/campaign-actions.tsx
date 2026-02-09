"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendTestCampaignAction,
  sendCampaignAction,
  scheduleCampaignAction,
  cancelScheduleAction,
  pauseCampaignAction,
  resumeCampaignAction,
} from "../actions";
import { toast } from "sonner";
import {
  Send,
  FlaskConical,
  Calendar,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

interface CampaignActionsProps {
  campaignId: string;
  status: string;
  isMultiStep: boolean;
  startDate: string | null;
  stepCount: number;
}

export function CampaignActions({
  campaignId,
  status,
  isMultiStep,
  startDate,
  stepCount,
}: Readonly<CampaignActionsProps>) {
  const router = useRouter();
  const [sendingTest, setSendingTest] = useState(false);
  const [testStep, setTestStep] = useState(0);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

  async function handleSendTest() {
    setSendingTest(true);
    try {
      const result = await sendTestCampaignAction(
        campaignId,
        isMultiStep ? testStep : undefined
      );
      if (result.success) {
        toast.success(`Test email sent to ${result.sentTo}`);
      } else {
        toast.error("Failed to send test email.");
      }
    } catch (err) {
      toast.error("Failed to send test email.");
      console.error(err);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendCampaign() {
    setSendingCampaign(true);
    try {
      const result = await sendCampaignAction(campaignId);
      toast.success(`Campaign sent! ${result.sentCount} emails delivered.`);
      router.refresh();
    } catch (err) {
      toast.error("Campaign sending failed.");
      console.error(err);
      router.refresh();
    } finally {
      setSendingCampaign(false);
      setConfirmSend(false);
    }
  }

  async function handleSchedule() {
    if (!scheduleDate) {
      toast.error("Please select a start date.");
      return;
    }
    setScheduling(true);
    try {
      await scheduleCampaignAction(campaignId, scheduleDate);
      toast.success("Campaign scheduled successfully.");
      router.refresh();
    } catch (err) {
      toast.error("Failed to schedule campaign.");
      console.error(err);
    } finally {
      setScheduling(false);
    }
  }

  async function handleCancelSchedule() {
    setCancelling(true);
    try {
      await cancelScheduleAction(campaignId);
      toast.success("Schedule cancelled. Campaign reverted to draft.");
      router.refresh();
    } catch (err) {
      toast.error("Failed to cancel schedule.");
      console.error(err);
    } finally {
      setCancelling(false);
    }
  }

  async function handlePause() {
    setPausing(true);
    try {
      await pauseCampaignAction(campaignId);
      toast.success("Campaign paused.");
      router.refresh();
    } catch (err) {
      toast.error("Failed to pause campaign.");
      console.error(err);
    } finally {
      setPausing(false);
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      await resumeCampaignAction(campaignId);
      toast.success("Campaign resumed.");
      router.refresh();
    } catch (err) {
      toast.error("Failed to resume campaign.");
      console.error(err);
    } finally {
      setResuming(false);
    }
  }

  // Draft actions
  if (status === "draft") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isMultiStep ? "Test & Schedule" : "Send"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test email */}
          <div className="flex flex-wrap items-end gap-2">
            {isMultiStep && stepCount > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Test Step</Label>
                <select
                  value={testStep}
                  onChange={(e) => setTestStep(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {Array.from({ length: stepCount }, (_, i) => (
                    <option key={i} value={i}>
                      Step {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={sendingTest}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {sendingTest ? "Sending..." : "Send Test Email"}
            </Button>
          </div>

          {/* Single-email: Send Now */}
          {!isMultiStep && (
            <div>
              {!confirmSend ? (
                <Button onClick={() => setConfirmSend(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Campaign
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-amber-600">
                    This will send to all matching contacts.
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleSendCampaign}
                    disabled={sendingCampaign}
                  >
                    {sendingCampaign ? "Sending..." : "Yes, Send Now"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmSend(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Multi-step: Schedule */}
          {isMultiStep && (
            <div className="space-y-2">
              <Label>Schedule Start Date</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="max-w-[200px]"
                />
                <Button onClick={handleSchedule} disabled={scheduling}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {scheduling ? "Scheduling..." : "Schedule Campaign"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The first email (Day 0) will be sent on this date. Subsequent steps send based on their day offsets.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Test emails are sent to your admin email address.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Scheduled
  if (status === "scheduled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              <Calendar className="mr-1 h-3 w-3" />
              Scheduled for{" "}
              {startDate
                ? format(new Date(startDate), "d MMM yyyy")
                : "unknown date"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The cron job will activate this campaign on the scheduled date and begin sending emails.
          </p>
          <Button
            variant="outline"
            onClick={handleCancelSchedule}
            disabled={cancelling}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {cancelling ? "Cancelling..." : "Cancel Schedule"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active
  if (status === "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Active</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This campaign is actively sending emails. The cron job processes it daily.
          </p>
          <Button
            variant="outline"
            onClick={handlePause}
            disabled={pausing}
          >
            <Pause className="mr-2 h-4 w-4" />
            {pausing ? "Pausing..." : "Pause Campaign"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Paused
  if (status === "paused") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Paused</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This campaign is paused. No emails will be sent until you resume it.
          </p>
          <Button onClick={handleResume} disabled={resuming}>
            <Play className="mr-2 h-4 w-4" />
            {resuming ? "Resuming..." : "Resume Campaign"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No actions for sent/completed/failed
  return null;
}
