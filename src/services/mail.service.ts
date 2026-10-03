import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface CredentialsEmailParams {
  name: string;
  email: string;
  oneTimePassword: string;
  expiresAt: Date;
  isResend?: boolean;
}

export interface RejectionEmailParams {
  name: string;
  reason: string;
}

export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const isMailConfigured = (): boolean => {
  return Boolean(env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);
};

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

export const sendMail = async ({ to, subject, text, html }: SendMailOptions): Promise<boolean> => {
  if (!isMailConfigured()) {
    return false;
  }

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown mail error';
    console.error('Mail send failed:', msg);
    return false;
  }
};

export const buildCredentialsEmail = ({
  name,
  email,
  oneTimePassword,
  expiresAt,
  isResend = false,
}: CredentialsEmailParams): { subject: string; text: string; html: string } => {
  const formattedExpiry = expiresAt.toUTCString();
  const loginUrl = `${env.FRONTEND_URL}/login`;
  const subject = isResend
    ? 'Field Service - New Technician Credentials'
    : 'Field Service - Technician Application Approved';

  const introText = isResend
    ? 'New temporary login credentials have been issued for your technician account.'
    : 'Congratulations! Your technician application has been approved.';

  const text = `Hello ${name},

${introText}

Here are your temporary login details:
Login Email: ${email}
One-Time Password: ${oneTimePassword}

This temporary password will expire at ${formattedExpiry} (UTC).
You must set a new password upon your first login.

Log in to your account here:
${loginUrl}

Best regards,
Field Service Management Team`;

  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #2563eb;">Field Service Technician Onboarding</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>${escapeHtml(introText)}</p>
  <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #cbd5e1;">
    <p style="margin: 4px 0;"><strong>Login Email:</strong> ${escapeHtml(email)}</p>
    <p style="margin: 4px 0;"><strong>One-Time Password:</strong> <code style="font-size: 1.1em; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(oneTimePassword)}</code></p>
    <p style="margin: 4px 0; color: #64748b; font-size: 0.9em;">Expires at: <strong>${escapeHtml(formattedExpiry)}</strong> (UTC)</p>
  </div>
  <p><strong>Important:</strong> You must change your password immediately upon your first login to activate your technician dashboard and privileges.</p>
  <p style="margin: 25px 0;">
    <a href="${escapeHtml(loginUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In Now</a>
  </p>
  <p style="color: #64748b; font-size: 0.85em;">Best regards,<br/>Field Service Management Team</p>
</div>`;

  return { subject, text, html };
};

export const buildRejectionEmail = ({
  name,
  reason,
}: RejectionEmailParams): { subject: string; text: string; html: string } => {
  const subject = 'Field Service - Technician Application Status';

  const text = `Hello ${name},

Thank you for your interest in joining our service network.

We regret to inform you that your technician application was not approved for the following reason:
${reason}

Your customer account remains fully active and unaffected. You may continue to request services at any time.

Best regards,
Field Service Management Team`;

  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #475569;">Technician Application Update</h2>
  <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
  <p>Thank you for your interest in joining our service network.</p>
  <p>We regret to inform you that your technician application was not approved for the following reason:</p>
  <blockquote style="background-color: #f1f5f9; border-left: 4px solid #94a3b8; margin: 15px 0; padding: 12px 16px; color: #334155;">
    ${escapeHtml(reason)}
  </blockquote>
  <p>Please note that your customer account remains active and you are welcome to continue using all regular services.</p>
  <p style="color: #64748b; font-size: 0.85em; margin-top: 25px;">Best regards,<br/>Field Service Management Team</p>
</div>`;

  return { subject, text, html };
};
