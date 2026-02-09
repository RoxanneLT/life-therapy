"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendTestCampaignAction, sendCampaignAction } from "../actions";
import { toast } from "sonner";
import { Send, FlaskConical } from "lucide-react";

export function CampaignActions({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  async function handleSendTest() {
    setSendingTest(true);
    try {
      const result = await sendTestCampaignAction(campaignId);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSendTest} disabled={sendingTest}>
            <FlaskConical className="mr-2 h-4 w-4" />
            {sendingTest ? "Sending..." : "Send Test Email"}
          </Button>

          {!confirmSend ? (
            <Button onClick={() => setConfirmSend(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send Campaign
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-600">
                Are you sure? This will send to all matching contacts.
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
        <p className="text-xs text-muted-foreground">
          Test emails are sent to your admin email address. Campaign sends go to all consented, non-unsubscribed contacts matching your audience filters.
        </p>
      </CardContent>
    </Card>
  );
}
