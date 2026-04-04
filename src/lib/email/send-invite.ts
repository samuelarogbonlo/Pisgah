import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendStaffInviteEmail(params: {
  to: string;
  staffName: string;
  role: string;
  facilityName: string;
  hospitalName: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  const roleLabel = params.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const expiresLabel = params.expiresAt.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { error } = await resend.emails.send({
    from: "Pisgah <noreply@fusionprotocol.co>",
    to: params.to,
    subject: `You've been invited to ${params.hospitalName} on Pisgah`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; background: #fff;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #999; margin: 0 0 16px;">
            Pisgah Staff Invite
          </p>
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #000;">
            You've been invited to join ${params.hospitalName}
          </h1>
          <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.6;">
            ${params.staffName}, you've been assigned as <strong>${roleLabel}</strong> at <strong>${params.facilityName}</strong>.
          </p>
          <a href="${params.inviteLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Accept Invite
          </a>
          <p style="font-size: 12px; color: #999; margin: 24px 0 0; line-height: 1.5;">
            This invite expires on ${expiresLabel}. If you didn't expect this, you can ignore this email.
          </p>
        </div>
        <p style="font-size: 11px; color: #ccc; text-align: center; margin: 16px 0 0;">
          Pisgah — Verified diagnostic workflows
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[sendStaffInviteEmail] Failed:", error);
  }

  return { error: error ?? null };
}
