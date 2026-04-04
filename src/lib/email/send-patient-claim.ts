import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPatientClaimEmail(params: {
  to: string;
  patientName: string;
  hospitalName: string;
  testType: string;
  claimLink: string;
}) {
  const { error } = await resend.emails.send({
    from: "Pisgah <noreply@fusionprotocol.co>",
    to: params.to,
    subject: `${params.hospitalName} sent you a secure Pisgah link`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; background: #fff;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #999; margin: 0 0 16px;">
            Pisgah Patient Access
          </p>
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #000;">
            Your diagnostic update is now on Pisgah
          </h1>
          <p style="font-size: 14px; color: #666; margin: 0 0 16px; line-height: 1.6;">
            ${params.patientName}, ${params.hospitalName} created a secure Pisgah case for your <strong>${params.testType}</strong>.
          </p>
          <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.6;">
            Open this link on your phone in World App to access your patient dashboard and future doctor-approved updates.
          </p>
          <a href="${params.claimLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Open Secure Link
          </a>
          <p style="font-size: 12px; color: #999; margin: 24px 0 0; line-height: 1.5; word-break: break-all;">
            If the button does not work, open this link manually:<br />
            <a href="${params.claimLink}" style="color: #666;">${params.claimLink}</a>
          </p>
        </div>
        <p style="font-size: 11px; color: #ccc; text-align: center; margin: 16px 0 0;">
          Pisgah — Verified diagnostic workflows
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[sendPatientClaimEmail] Failed:", error);
  }

  return { error: error ?? null };
}
