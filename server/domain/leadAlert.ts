// server/domain/leadAlert.ts
// On every new lead, build an R2BL prospect profile and email an alert to the sales
// inbox. Fire-and-forget: never blocks or breaks the capture response.

import type { Lead } from "../ports/leadStore";
import { createEmailPort, emailRecipient } from "../ports/email";
import { profileLead, alertSubject, renderAlertHtml, renderAlertText } from "./r2bl";

const email = createEmailPort();

export function notifyNewLead(lead: Lead): void {
  // intentionally not awaited — the HTTP handler returns immediately
  void (async () => {
    try {
      const profile = profileLead(lead);
      const result = await email.send({
        subject: alertSubject(profile),
        html: renderAlertHtml(profile),
        text: renderAlertText(profile),
      });
      if (result.success) {
        console.log(`[leadAlert] ${result.mocked ? "MOCK " : ""}alert for ${lead.email} (${profile.band}/${profile.priority}) → ${emailRecipient}${result.messageId ? ` [${result.messageId}]` : ""}`);
      } else {
        console.error(`[leadAlert] send failed for ${lead.email}: ${result.error}`);
      }
    } catch (e) {
      console.error(`[leadAlert] error for ${lead.email}:`, e instanceof Error ? e.message : e);
    }
  })();
}
