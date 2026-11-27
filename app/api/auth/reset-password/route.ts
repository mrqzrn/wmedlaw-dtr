import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest } from '@/lib/crypto-server';
// import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

function buildResetEmailHtml(resetLink: string, email: string, origin: string = 'https://timekeeping-dtr.vercel.app'): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Reset Your Password</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" valign="top" style="padding: 12px 0;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="520">
        <tr>
        <td align="center" valign="top" width="520">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="card" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 32px 28px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="${origin}/wmedlaw_logo.jpeg?v=2" alt="WMedlaw Logo" width="56" height="56" style="display: block; margin: 0 auto 16px; width: 56px; height: 56px; border-radius: 12px; object-fit: contain; border: 1px solid #e2e8f0; background-color: #ffffff; padding: 2px;" />
                <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Reset Your Password</h1>
                <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0;">We received a request to reset the password for <strong style="color: #0f172a;">${email}</strong> on WMedlaw DTR &amp; Timekeeping.</p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetLink}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="20%" stroke="f" fillcolor="#2563eb">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Reset Password</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${resetLink}" class="btn" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">Reset Password</a>
                <!--<![endif]-->
              </div>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 12px 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              <p style="font-size: 13px; line-height: 20px; color: #64748b; margin: 12px 0;">This password reset link will expire in 24 hours.</p>
              <div style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                <p style="margin: 0 0 6px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb; font-size: 12px; margin: 0;"><a href="${resetLink}" style="color: #2563eb; text-decoration: underline;">${resetLink}</a></p>
              </div>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendResetEmail(toEmail: string, resetLink: string, origin?: string): Promise<{ sent: boolean; reason?: string }> {
  // 1. Try Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'WMedlaw DTR <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: 'Reset your WMedlaw DTR password',
          html: buildResetEmailHtml(resetLink, toEmail, origin),
        }),
      });
      if (res.ok) {
        return { sent: true };
      }
      const errJson = await res.json().catch(() => ({}));
      console.warn('Resend email delivery failed:', errJson);
    } catch (resendErr: any) {
      console.warn('Resend request failed:', resendErr?.message);
    }
  }

  // 2. Try SMTP via Nodemailer if SMTP credentials are configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const transporter = nodemailer.default ? nodemailer.default.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }) : nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      const fromAddr = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"WMedlaw DTR" <${smtpUser}>`;
      await transporter.sendMail({
        from: fromAddr,
        to: toEmail,
        subject: 'Reset your WMedlaw DTR password',
        html: buildResetEmailHtml(resetLink, toEmail, origin),
      });
      return { sent: true };
    } catch (smtpErr: any) {
      console.warn('SMTP delivery failed:', smtpErr);
      return { sent: false, reason: smtpErr?.message };
    }
  }

  return { sent: false, reason: 'NO_EMAIL_TRANSPORT_CONFIGURED' };
}

export async function POST(request: Request) {
  try {
    const body = await parseEncryptedRequest<any>(request);
    const { email, redirectTo } = body;

    if (!email) {
      return createEncryptedResponse(
        { error: 'Email address is required.' },
        400
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseServer = createServerClient();

    // Generate recovery link using Supabase Admin Auth API.
    const { data: linkData, error: linkError } = await supabaseServer.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: redirectTo || 'https://timekeeping-dtr.vercel.app',
      },
    });

    if (linkError) {
      const msg = linkError.message || 'Failed to generate recovery link';
      return createEncryptedResponse(
        {
          error:
            linkError.status === 404 || msg.toLowerCase().includes('not found')
              ? `No account found with email "${cleanEmail}". Please check your email address or register.`
              : msg,
        },
        400
      );
    }

    const actionLink = linkData?.properties?.action_link;
    const emailOtp = linkData?.properties?.email_otp;

    if (!actionLink) {
      return createEncryptedResponse(
        { error: 'Failed to generate password reset link.' },
        500
      );
    }

    // Always prefer the production origin (https://timekeeping-dtr.vercel.app) for the reset link
    let targetLink = actionLink;
    let requestOrigin = 'https://timekeeping-dtr.vercel.app';
    try {
      requestOrigin = redirectTo ? new URL(redirectTo).origin : 'https://timekeeping-dtr.vercel.app';
      if (emailOtp) {
        targetLink = `${requestOrigin}/?recovery_email=${encodeURIComponent(cleanEmail)}&recovery_token=${encodeURIComponent(emailOtp)}`;
      }
    } catch {
      targetLink = actionLink;
    }

    // Attempt server-side email dispatch (Resend / SMTP)
    const emailResult = await sendResetEmail(cleanEmail, targetLink, requestOrigin);

    if (emailResult.sent) {
      return createEncryptedResponse({
        success: true,
        email_sent: true,
        message: 'Password reset link sent! Check your inbox for instructions to set a new password.',
      });
    }

    // If no server email transport is configured, return action_link for admin or fallback
    return createEncryptedResponse({
      success: false,
      no_mailer: true,
      action_link: targetLink || actionLink,
      error: 'NO_SERVER_MAILER',
      message: 'No server email transport configured. Falling back to Supabase mailer.',
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Server error generating password reset link.' },
      500
    );
  }
}
