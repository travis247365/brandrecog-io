// server/domain/waitlistConfirm.ts
// Customer-facing "you're on the waitlist" confirmation, sent to the lead via Resend.
// Sender is configurable (RESEND_CONFIRM_FROM_EMAIL) so it can move to
// hello@brandrecog.io once that domain is registered + verified in Resend.
// Until then, set the env to a verified address, e.g.:
//   RESEND_CONFIRM_FROM_EMAIL="BrandRecog.io <hello@travispaulconsulting.co>"

import type { Lead } from "../ports/leadStore";
import { createEmailPort } from "../ports/email";

const email = createEmailPort();
const CONFIRM_FROM = process.env.RESEND_CONFIRM_FROM_EMAIL ?? "BrandRecog.io <hello@brandrecog.io>";
const SITE = process.env.PUBLIC_SITE_URL ?? "https://brandcog-io.fly.dev";

function confirmHtml(lead: Lead): string {
  const hi = lead.name && lead.name.trim() ? lead.name.trim().split(/\s+/)[0] : "there";
  return `<!doctype html><html><body style="margin:0;background:#f5f7f8;padding:0">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#2C2C2C;border-top:6px solid #00BCD4;padding:26px 30px">
    <div style="font:800 24px Montserrat,Arial,sans-serif;color:#fff">BrandRecog<span style="color:#00BCD4">.io</span></div>
    <div style="font:600 11px Inter,Arial;color:#9aa0a7;letter-spacing:1.5px;margin-top:3px">A BRANDCOG.AI PLATFORM</div>
  </div>
  <div style="padding:30px">
    <h1 style="font:800 26px Montserrat,Arial;color:#2C2C2C;margin:0 0 6px">You're on the list 🎉</h1>
    <p style="font:400 15px Inter,Arial;color:#3A3A3A;line-height:1.65;margin:14px 0">
      Hi ${hi}, thanks for joining the <b>BrandRecog.io</b> waitlist. You're in early on
      photo-verified out-of-home (OOH) brand intelligence — <i>measuring the unmeasured medium</i>.
    </p>
    <p style="font:400 15px Inter,Arial;color:#3A3A3A;line-height:1.65;margin:14px 0">
      We turn a billboard photo into proof: Share of Voice, Share of Space, Brand Health and
      market sizing across Zambia &amp; South Africa — every figure labelled measured, modelled or assumed.
    </p>
    <div style="background:#E7F7FA;border-left:4px solid #00BCD4;border-radius:6px;padding:14px 16px;margin:20px 0">
      <div style="font:700 12px Inter,Arial;color:#0097A7;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">What happens next</div>
      <div style="font:500 14px Inter,Arial;color:#23262A;line-height:1.55">We'll be in touch before launch with early access. In the meantime, the live demo is real — take it for a spin.</div>
    </div>
    <div style="margin:24px 0">
      <a href="${SITE}/signup" style="display:inline-block;background:#00BCD4;color:#06343b;font:800 14px Montserrat,Arial;text-decoration:none;padding:13px 22px;border-radius:9px;margin-right:8px">▶ Try the live demo</a>
      <a href="${SITE}/marketing" style="display:inline-block;background:#fff;color:#3A3A3A;border:1px solid #d9dee3;font:700 14px Montserrat,Arial;text-decoration:none;padding:13px 22px;border-radius:9px">Learn more</a>
    </div>
  </div>
  <div style="background:#2C2C2C;padding:18px 30px;font:400 11px Inter,Arial;color:#9aa0a7">
    <b style="color:#cfd3d8">Equanamity</b> — the ethical Big Data company, powered by AI · A Travis Paul Holdings company<br/>
    You received this because you joined the BrandRecog.io waitlist at ${SITE}.
  </div>
</div></body></html>`;
}

function confirmText(lead: Lead): string {
  const hi = lead.name && lead.name.trim() ? lead.name.trim().split(/\s+/)[0] : "there";
  return [
    `You're on the BrandRecog.io waitlist 🎉`,
    ``,
    `Hi ${hi}, thanks for joining. You're in early on photo-verified out-of-home (OOH)`,
    `brand intelligence — measuring the unmeasured medium.`,
    ``,
    `We turn a billboard photo into proof: Share of Voice, Share of Space, Brand Health`,
    `and market sizing across Zambia & South Africa.`,
    ``,
    `What happens next: we'll be in touch before launch with early access.`,
    `Try the live demo: ${SITE}/signup`,
    `Learn more: ${SITE}/marketing`,
    ``,
    `Equanamity — the ethical Big Data company, powered by AI · A Travis Paul Holdings company`,
    `You received this because you joined the BrandRecog.io waitlist.`,
  ].join("\n");
}

export function sendWaitlistConfirmation(lead: Lead): void {
  // fire-and-forget — never blocks or breaks the capture response
  void (async () => {
    try {
      const result = await email.send({
        from: CONFIRM_FROM,
        to: lead.email,
        subject: "You're on the BrandRecog.io waitlist 🎉",
        html: confirmHtml(lead),
        text: confirmText(lead),
      });
      if (result.success) {
        console.log(`[waitlistConfirm] ${result.mocked ? "MOCK " : ""}confirmation to ${lead.email} from ${CONFIRM_FROM}${result.messageId ? ` [${result.messageId}]` : ""}`);
      } else {
        console.error(`[waitlistConfirm] send failed for ${lead.email}: ${result.error}`);
      }
    } catch (e) {
      console.error(`[waitlistConfirm] error for ${lead.email}:`, e instanceof Error ? e.message : e);
    }
  })();
}
