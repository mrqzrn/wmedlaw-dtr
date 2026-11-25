export interface DisbursementEmailLine {
  id?: string;
  line_type?: string;
  description?: string;
  category?: string;
  hours?: number;
  hourly_rate?: number;
  amount: number;
}

export interface DisbursementEmailParams {
  to: string;
  employee_name: string;
  employee_no?: string;
  department?: string;
  hourly_rate?: number;
  gross_amount: number;
  total_hours?: number;
  method?: string;
  reference_no?: string;
  paid_at?: string;
  bank_name?: string;
  account_no?: string;
  pay_period_label?: string;
  lines?: DisbursementEmailLine[];
  origin?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
}

export interface SendEmailResult {
  sent: boolean;
  simulated?: boolean;
  id?: string;
  reason?: string;
  error?: string;
}

const DEFAULT_PUBLIC_APP_URL = 'https://timekeeping-dtr.vercel.app';

function isPublicUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return !(
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

/**
 * Absolute logo URL that recipients' mail clients can actually fetch.
 * Emails sent from a local/dev host would otherwise embed a localhost URL and show a broken image,
 * so we only use a host that is publicly reachable (EMAIL_ASSET_URL → request origin → APP_URL),
 * falling back to the deployed production URL.
 */
function getEmailLogoUrl(origin?: string): string {
  const base =
    [process.env.EMAIL_ASSET_URL, origin, process.env.APP_URL].find(isPublicUrl) || DEFAULT_PUBLIC_APP_URL;
  return `${base.replace(/\/+$/, '')}/wmedlaw_logo.jpeg`;
}

function formatCurrency(val: number): string {
  return `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMethodLabel(method?: string): string {
  if (!method) return 'Bank Transfer';
  switch (method) {
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'ewallet':
      return 'E-Wallet';
    case 'direct_deposit':
      return 'Direct Deposit';
    case 'check':
      return 'Paper Check';
    case 'cash':
      return 'Cash Voucher';
    default:
      return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Builds an official responsive HTML email template for individual payment disbursement receipts.
 */
export function buildDisbursementEmailHtml(params: DisbursementEmailParams): string {
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
  const logoUrl = getEmailLogoUrl(origin);
  const formattedMethod = formatMethodLabel(params.method);
  const formattedAmount = formatCurrency(params.gross_amount || 0);
  const periodLabel = params.pay_period_label || 'Current Pay Period';
  const payDate = params.paid_at || new Date().toISOString().slice(0, 10);
  const refNo = params.reference_no || 'N/A';

  const linesHtml = params.lines && params.lines.length > 0
    ? params.lines
        .map((line) => {
          let desc = line.description || line.category || 'Payment Line Item';
          if (line.line_type === 'hours' && line.hours && line.hourly_rate) {
            desc = `Base Hourly Wage (${line.hours.toFixed(2)}h @ ₱${line.hourly_rate.toFixed(2)}/hr)`;
          }
          return `
            <tr>
              <td style="padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;">
                ${desc}
              </td>
              <td style="padding: 10px 12px; font-size: 13px; font-family: monospace; font-weight: 600; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                ${formatCurrency(line.amount)}
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td style="padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;">
          Base Compensation (${params.total_hours ? `${params.total_hours.toFixed(2)}h` : 'Recorded hours'})
        </td>
        <td style="padding: 10px 12px; font-size: 13px; font-family: monospace; font-weight: 600; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
          ${formattedAmount}
        </td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Payment Disbursement Receipt - ${params.employee_name}</title>
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #064e3b !important;
      background: #064e3b linear-gradient(135deg, #064e3b 0%, #065f46 100%) !important;
      padding: 32px 24px;
      text-align: center;
      color: #ffffff !important;
    }
    .logo {
      display: inline-block;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: #ffffff;
      padding: 3px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .hero-badge {
      display: inline-block;
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 10px;
    }
    .amount-box {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #10b981;
      border-radius: 12px;
      padding: 20px;
      margin: 24px;
      text-align: center;
    }
    .amount-display {
      font-size: 32px;
      font-weight: 800;
      color: #047857;
      margin: 6px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      letter-spacing: -0.02em;
    }
    .content {
      padding: 0 24px 24px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .grid-2 {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-2 td {
      width: 50%;
      padding: 6px 8px;
      vertical-align: top;
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 3px;
      font-weight: 600;
    }
    .value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .table-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .table-title {
      background: #f1f5f9;
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0 12px;
    }
    .btn {
      display: inline-block;
      background-color: #059669;
      color: #ffffff !important;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);
    }
    .advisory {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #1e40af;
      line-height: 18px;
      margin-top: 16px;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 24px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      line-height: 18px;
    }
    .ref-tag {
      font-family: monospace;
      font-size: 13px;
      font-weight: 700;
      color: #065f46;
      background: #e6fcf5;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #c3fae8;
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Outlook-compatible Outer Wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" valign="top" style="padding: 12px 0;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="wrapper" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header (Solid #064e3b for Outlook + Gradient for modern clients) -->
          <tr>
            <td align="center" bgcolor="#064e3b" class="header" style="background-color: #064e3b; background: #064e3b linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="text-align: center;">
                    <img src="${logoUrl}" alt="WMedlaw Logo" class="logo" width="56" height="56" style="display: block; margin: 0 auto 12px; width: 56px; height: 56px; border-radius: 12px; background-color: #ffffff; padding: 3px; border: 0; outline: none; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
                    <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #ffffff !important; opacity: 0.95; font-weight: 600; margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      WMedlaw DTR &amp; Payroll Management
                    </div>
                    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 4px; color: #ffffff !important; line-height: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Payment Disbursement Receipt
                    </h1>
                    <p style="font-size: 13px; margin: 0; color: #ffffff !important; opacity: 0.95; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Official Notification of Released Funds
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Amount Hero Banner -->
          <tr>
            <td style="padding: 24px 24px 0;">
              <div class="amount-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 0;">
                <span class="hero-badge" style="display: inline-block; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                  &#10004; Disbursed &amp; Tagged as Paid
                </span>
                <div style="font-size: 12px; color: #475569; margin-top: 2px;">Total Disbursable Net Amount</div>
                <div class="amount-display" style="font-size: 32px; font-weight: 800; color: #047857; margin: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; letter-spacing: -0.02em;">
                  ${formattedAmount}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                  Released via <strong style="color: #1e293b;">${formattedMethod}</strong> on <strong style="color: #1e293b;">${payDate}</strong>
                </div>
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content" style="padding: 20px 24px 24px;">
              <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 18px;">
                Dear <strong style="color: #0f172a;">${params.employee_name}</strong>,
                <br>
                Your individual payment disbursement for <strong>${periodLabel}</strong> has been tagged as <strong>PAID</strong> by administration. Below are the disbursement details and breakdown for your records.
              </p>

              <!-- Payee & Account Details -->
              <div class="info-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 10px; letter-spacing: 0.05em;">
                  Disbursement &amp; Account Details
                </div>
                <table class="grid-2" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Employee Name</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${params.employee_name}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Department / Rate</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${params.department || 'IT'} &bull; ${formatCurrency(params.hourly_rate || 300)}/hr</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Bank / eWallet Name</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${params.bank_name || 'Bank Transfer'}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Account / Mobile No.</div>
                      <div class="value font-mono" style="font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace;">${params.account_no || 'On File'}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Payment Date</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${payDate}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Transaction Reference</div>
                      <div><span class="ref-tag" style="font-family: monospace; font-size: 13px; font-weight: 700; color: #065f46; background-color: #e6fcf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #c3fae8;">${refNo}</span></div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Payment Breakdown Table -->
              <div class="table-card" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
                <div class="table-title" style="background-color: #f1f5f9; padding: 10px 14px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                  Payment Calculation Breakdown
                </div>
                <table class="data-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse;">
                  ${linesHtml}
                  <tr>
                    <td style="padding: 12px; font-size: 13px; font-weight: 700; color: #065f46; background-color: #f0fdf4;">
                      Total Disbursed Net Pay
                    </td>
                    <td style="padding: 12px; font-size: 14px; font-family: monospace; font-weight: 800; text-align: right; color: #047857; background-color: #f0fdf4;">
                      ${formattedAmount}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Advisory Box -->
              <div class="advisory" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #1e40af; line-height: 18px; margin-top: 16px;">
                <strong>💡 Processing Window Notice:</strong> Depending on your banking institution or eWallet provider (GCash, Maya, etc.), funds typically reflect immediately or within standard clearing hours (1 business day). If funds do not appear in your account after this timeframe, please contact your payroll department with reference <strong>${refNo}</strong>.
              </div>

              <!-- CTA Button -->
              <div class="cta-container" style="text-align: center; margin: 28px 0 12px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${origin}/?tab=payments" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="#059669">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">View Payment Record in Portal</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${origin}/?tab=payments" class="btn" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);">
                  View Payment Record in Portal
                </a>
                <!--<![endif]-->
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 18px;">
              <p style="margin: 0 0 6px;">
                <strong style="color: #64748b;">WMedlaw Daily Time Record &amp; Payroll System</strong>
              </p>
              <p style="margin: 0 0 6px;">
                This is an automated confirmation receipt dispatched upon individual payment release.
              </p>
              <p style="margin: 0; font-size: 10px;">
                Reference: ${refNo} &bull; Recipient: ${params.to} &bull; Generated: ${new Date().toUTCString()}
              </p>
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

/**
 * Builds plain-text fallback for email clients that do not render HTML.
 */
export function buildDisbursementEmailText(params: DisbursementEmailParams): string {
  const formattedMethod = formatMethodLabel(params.method);
  const formattedAmount = formatCurrency(params.gross_amount || 0);
  const periodLabel = params.pay_period_label || 'Current Pay Period';
  const payDate = params.paid_at || new Date().toISOString().slice(0, 10);
  const refNo = params.reference_no || 'N/A';
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';

  return `WMEDLAW DTR & PAYROLL - PAYMENT DISBURSEMENT RECEIPT
======================================================

Dear ${params.employee_name},

Your individual payment disbursement for ${periodLabel} has been tagged as PAID by administration.

PAYMENT SUMMARY:
------------------------------------------------------
Total Disbursed Net Amount: ${formattedAmount}
Status: PAID
Payment Date: ${payDate}
Disbursement Method: ${formattedMethod}
Transaction Reference / Confirmation No: ${refNo}

PAYOUT DESTINATION:
------------------------------------------------------
Bank / eWallet: ${params.bank_name || 'Bank Transfer'}
Account / Mobile No: ${params.account_no || 'On File'}
Department: ${params.department || 'IT'}

View your complete payment history and breakdown online:
${origin}/?tab=payments

If you have any questions regarding your disbursement, please contact your payroll administrator with reference ${refNo}.

WMedlaw DTR & Payroll Management System
`;
}

/**
 * Sends an email using configured Resend API or Nodemailer SMTP.
 * Gracefully simulates delivery in development or when no email provider credentials exist.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  tag,
}: SendEmailOptions): Promise<SendEmailResult> {
  const cleanTo = (to || '').trim();
  if (!cleanTo) {
    return { sent: false, reason: 'RECIPIENT_EMAIL_MISSING' };
  }

  // 1. Try Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'WMedlaw Payroll <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanTo],
          subject,
          html,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { sent: true, id: data.id };
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
      const transporter = nodemailer.default
        ? nodemailer.default.createTransport({
            host: smtpHost,
            port,
            secure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port,
            secure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

      const fromAddr = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"WMedlaw Payroll" <${smtpUser}>`;
      const info = await transporter.sendMail({
        from: fromAddr,
        to: cleanTo,
        subject,
        html,
        text,
      });
      return { sent: true, id: info.messageId };
    } catch (smtpErr: any) {
      console.warn('SMTP delivery failed:', smtpErr);
      return { sent: false, reason: smtpErr?.message };
    }
  }

  // 3. Fallback: Log and simulate delivery when no third-party transport is configured
  const logTag = tag || 'EMAIL NOTIFICATION DISPATCH';
  console.log(`\n======================================================`);
  console.log(`📨 [${logTag}] (Simulation Mode)`);
  console.log(`To: ${cleanTo}`);
  console.log(`Subject: ${subject}`);
  console.log(`HTML Body Length: ${html.length} chars`);
  console.log(`Note: No live email transport configured. Set RESEND_API_KEY or SMTP_HOST in .env.local for live transmission.`);
  console.log(`======================================================\n`);

  return {
    sent: true,
    simulated: true,
    reason: 'SIMULATED_NO_TRANSPORT',
  };
}

/**
 * High-level helper to build and dispatch a disbursement payment receipt email to an employee.
 */
export async function sendDisbursementReceipt(
  params: DisbursementEmailParams
): Promise<SendEmailResult> {
  const subject = `Payment Disbursement Receipt: ${formatCurrency(params.gross_amount || 0)} [Ref: ${params.reference_no || 'PAID'}]`;
  const html = buildDisbursementEmailHtml(params);
  const text = buildDisbursementEmailText(params);

  return await sendEmail({
    to: params.to,
    subject,
    html,
    text,
    tag: 'PAYMENT DISBURSEMENT EMAIL DISPATCH',
  });
}

// ============================================================================
// DTR MONTHLY FINALIZATION & SELF-APPROVAL EMAIL NOTIFICATIONS
// ============================================================================

export interface DtrFinalizedEmailParams {
  to: string;
  admin_name?: string;
  employee_name: string;
  employee_no?: string;
  employee_email?: string;
  department?: string;
  month: string; // YYYY-MM
  month_label?: string; // e.g. "October 2026"
  reference_no: string; // e.g. "REF-DTR-202610-EMP10024"
  total_hours: number;
  regular_hours?: number;
  extra_hours?: number;
  approved_hours?: number;
  entries_count: number;
  submitted_at?: string;
  employee_note?: string;
  origin?: string;
}

export interface AdminRecipient {
  email: string;
  name?: string;
}

export interface NotifyAdminsResult {
  total: number;
  sent: number;
  simulated: boolean;
  recipients: string[];
  results: Array<{
    email: string;
    success: boolean;
    simulated?: boolean;
    id?: string;
    error?: string;
  }>;
}

function formatMonthLabel(month: string): string {
  try {
    const [yearStr, monthStr] = month.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
}

/**
 * Builds an official responsive HTML email notification sent to administrators
 * whenever an employee finalizes and self-approves their monthly DTR.
 */
export function buildDtrFinalizedEmailHtml(params: DtrFinalizedEmailParams): string {
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
  const logoUrl = getEmailLogoUrl(origin);
  const monthLabel = params.month_label || formatMonthLabel(params.month);
  const submittedDate = params.submitted_at
    ? new Date(params.submitted_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const refNo = params.reference_no || 'N/A';
  const adminSalutation = params.admin_name ? `Dear ${params.admin_name},` : 'Dear Administrator,';
  const cleanNote = (params.employee_note || '').replace(/\[REF:[^\]]+\]\s*/g, '').trim();
  const reviewUrl = `${origin}/?tab=admin_filings&month=${encodeURIComponent(params.month)}&employee=${encodeURIComponent(params.employee_no || '')}`;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Monthly DTR Finalized - ${params.employee_name} (${monthLabel})</title>
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #064e3b !important;
      background: #064e3b linear-gradient(135deg, #064e3b 0%, #065f46 100%) !important;
      padding: 32px 24px;
      text-align: center;
      color: #ffffff !important;
    }
    .logo {
      display: inline-block;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: #ffffff;
      padding: 3px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .hero-badge {
      display: inline-block;
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    .callout-box {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #10b981;
      border-radius: 12px;
      padding: 18px 20px;
      margin: 24px;
    }
    .content {
      padding: 0 24px 24px;
    }
    .stat-grid {
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px;
      margin: 16px 0 24px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 12px;
      text-align: center;
      vertical-align: top;
      width: 50%;
    }
    .stat-number {
      font-size: 22px;
      font-weight: 800;
      color: #065f46;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      margin: 4px 0 2px;
    }
    .stat-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
    }
    .grid-2 {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-2 td {
      width: 50%;
      padding: 6px 8px;
      vertical-align: top;
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 3px;
      font-weight: 600;
    }
    .value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .ref-tag {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      color: #065f46;
      background: #e6fcf5;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #c3fae8;
      display: inline-block;
    }
    .attestation-box {
      background-color: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #065f46;
      line-height: 18px;
      margin-bottom: 20px;
    }
    .note-box {
      background-color: #f1f5f9;
      border-left: 3px solid #64748b;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #334155;
      font-style: italic;
      margin-bottom: 20px;
      line-height: 20px;
    }
    .advisory {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #1e40af;
      line-height: 18px;
      margin-top: 16px;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0 12px;
    }
    .btn {
      display: inline-block;
      background-color: #059669;
      color: #ffffff !important;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 24px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      line-height: 18px;
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Outlook-compatible Outer Wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" valign="top" style="padding: 12px 0;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="wrapper" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header (Solid #064e3b for Outlook + Gradient for modern clients) -->
          <tr>
            <td align="center" bgcolor="#064e3b" class="header" style="background-color: #064e3b; background: #064e3b linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="text-align: center;">
                    <img src="${logoUrl}" alt="WMedlaw Logo" class="logo" width="56" height="56" style="display: block; margin: 0 auto 12px; width: 56px; height: 56px; border-radius: 12px; background-color: #ffffff; padding: 3px; border: 0; outline: none; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
                    <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #ffffff !important; opacity: 0.95; font-weight: 600; margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      WMedlaw DTR &amp; Payroll Management
                    </div>
                    <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 4px; color: #ffffff !important; line-height: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Monthly DTR Certified &amp; Finalized
                    </h1>
                    <p style="font-size: 13px; margin: 0; color: #ffffff !important; opacity: 0.95; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Action Required: Administrator Review for ${monthLabel}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Callout -->
          <tr>
            <td style="padding: 24px 24px 0;">
              <div class="callout-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; border-radius: 12px; padding: 18px 20px; margin: 0;">
                <span class="hero-badge" style="display: inline-block; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 8px;">
                  &#10004; Finalized &amp; Self-Approved
                </span>
                <h3 style="margin: 6px 0 4px; font-size: 16px; font-weight: 800; color: #065f46;">
                  ${params.employee_name} has finalized DTR for ${monthLabel}
                </h3>
                <p style="margin: 0; font-size: 13px; color: #166534; line-height: 20px;">
                  All daily time record filings, attendance punches, and accomplishment descriptions for <strong>${monthLabel}</strong> have been formally attested and self-approved by the employee. The filing is now locked from further edits and ready for administration review.
                </p>
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content" style="padding: 20px 24px 24px;">
              <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 16px;">
                ${adminSalutation}
                <br>
                An employee has submitted their certified monthly time log. Below is the executive hours breakdown and reference information:
              </p>

              <!-- Key Metrics Stats Grid -->
              <table class="stat-grid" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: separate; border-spacing: 8px; margin: 16px 0 24px;">
                <tr>
                  <td class="stat-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div class="stat-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Total Work Hours</div>
                    <div class="stat-number" style="font-size: 22px; font-weight: 800; color: #065f46; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; margin: 4px 0 2px;">${params.total_hours.toFixed(2)}h</div>
                    <div style="font-size: 10px; color: #64748b;">Recorded time</div>
                  </td>
                  <td class="stat-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div class="stat-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Regular Hours</div>
                    <div class="stat-number" style="font-size: 22px; font-weight: 800; color: #065f46; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; margin: 4px 0 2px;">${(params.regular_hours ?? params.total_hours).toFixed(2)}h</div>
                    <div style="font-size: 10px; color: #64748b;">Standard shift hours</div>
                  </td>
                </tr>
                <tr>
                  <td class="stat-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div class="stat-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Extra / Overtime</div>
                    <div class="stat-number" style="font-size: 22px; font-weight: 800; color: ${(params.extra_hours || 0) > 0 ? '#b45309' : '#065f46'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; margin: 4px 0 2px;">
                      ${(params.extra_hours || 0).toFixed(2)}h
                    </div>
                    <div style="font-size: 10px; color: #64748b;">
                      ${(params.extra_hours || 0) > 0 ? 'Requires verification' : 'None filed'}
                    </div>
                  </td>
                  <td class="stat-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div class="stat-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Logged Sessions</div>
                    <div class="stat-number" style="font-size: 22px; font-weight: 800; color: #065f46; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; margin: 4px 0 2px;">${params.entries_count}</div>
                    <div style="font-size: 10px; color: #64748b;">Total shifts across month</div>
                  </td>
                </tr>
              </table>

              <!-- Employee & Filing Details Card -->
              <div class="info-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 12px; letter-spacing: 0.05em;">
                  Employee &amp; Filing Identification
                </div>
                <table class="grid-2" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Employee Name</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${params.employee_name}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Employee ID / Dept</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${params.employee_no || 'N/A'} &bull; ${params.department || 'IT'}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Pay Month</div>
                      <div class="value" style="font-size: 13px; font-weight: 700; color: #0f172a;">${monthLabel}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Certified Tag Reference</div>
                      <div><span class="ref-tag" style="font-family: monospace; font-size: 12px; font-weight: 700; color: #065f46; background-color: #e6fcf5; padding: 3px 8px; border-radius: 6px; border: 1px solid #c3fae8; display: inline-block;">${refNo}</span></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Submitted At</div>
                      <div class="value" style="font-size: 12px; font-weight: 700; color: #0f172a;">${submittedDate}</div>
                    </td>
                    <td style="width: 50%; padding: 6px 8px; vertical-align: top;">
                      <div class="label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; font-weight: 600;">Employee Email</div>
                      <div class="value" style="font-size: 12px; font-weight: 700; color: #0f172a;">${params.employee_email || 'On File'}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Employee Attestation Notice -->
              <div class="attestation-box" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #065f46; line-height: 18px; margin-bottom: 20px;">
                <strong>🛡️ Employee Electronic Attestation Confirmed:</strong>
                <br>
                The employee certified under solemn declaration that all daily punches, hours rendered, and accomplishment remarks represent true, complete, and accurate records of actual working time.
              </div>

              <!-- Employee Note (if present) -->
              ${cleanNote ? `
              <div style="margin-bottom: 20px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.05em;">
                  Employee Remarks / Notes to Payroll Admin:
                </div>
                <div class="note-box" style="background-color: #f1f5f9; border-left: 3px solid #64748b; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #334155; font-style: italic; line-height: 20px;">
                  &ldquo;${cleanNote}&rdquo;
                </div>
              </div>
              ` : ''}

              <!-- Next Steps Advisory -->
              <div class="advisory" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #1e40af; line-height: 18px; margin-top: 16px;">
                <strong>💡 Administrator Next Steps:</strong>
                <br>
                Please open the Admin Filings module to review the recorded shifts. Once reviewed and accepted by administration, these verified hours will be unlocked for automated payroll calculation and disbursement.
              </div>

              <!-- Call to Action Button -->
              <div class="cta-container" style="text-align: center; margin: 28px 0 12px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${reviewUrl}" style="height:44px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="#059669">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Review &amp; Verify DTR in Admin Filings &rarr;</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${reviewUrl}" class="btn" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);">
                  Review &amp; Verify DTR in Admin Filings &rarr;
                </a>
                <!--<![endif]-->
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 18px;">
              <p style="margin: 0 0 6px;">
                <strong style="color: #64748b;">WMedlaw Daily Time Record &amp; Payroll Management System</strong>
              </p>
              <p style="margin: 0 0 6px;">
                This is an automated administrative notification dispatched immediately upon employee monthly DTR finalization.
              </p>
              <p style="margin: 0; font-size: 10px;">
                Reference: ${refNo} &bull; Recipient: ${params.to} &bull; Timestamp: ${new Date().toUTCString()}
              </p>
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

/**
 * Builds plain-text fallback for email clients that do not render HTML.
 */
export function buildDtrFinalizedEmailText(params: DtrFinalizedEmailParams): string {
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
  const monthLabel = params.month_label || formatMonthLabel(params.month);
  const submittedDate = params.submitted_at || new Date().toISOString();
  const refNo = params.reference_no || 'N/A';
  const cleanNote = (params.employee_note || '').replace(/\[REF:[^\]]+\]\s*/g, '').trim();

  return `======================================================
WMEDLAW DTR & PAYROLL - MONTHLY DTR FINALIZED NOTIFICATION
======================================================

Dear Administrator,

Employee ${params.employee_name} has finalized and self-approved their Daily Time Record (DTR) for ${monthLabel}.

SUMMARY OF CERTIFIED HOURS:
------------------------------------------------------
Employee: ${params.employee_name} (${params.employee_no || 'N/A'})
Department: ${params.department || 'IT'}
Month: ${monthLabel} (${params.month})
Certified Reference Tag: ${refNo}
Total Recorded Hours: ${params.total_hours.toFixed(2)} hrs
Regular Hours: ${(params.regular_hours ?? params.total_hours).toFixed(2)} hrs
Extra/Overtime Hours: ${(params.extra_hours || 0).toFixed(2)} hrs
Total Shifts Logged: ${params.entries_count} sessions
Submitted At: ${submittedDate}
${cleanNote ? `Employee Note: "${cleanNote}"\n` : ''}
Attestation Status: Confirmed & Electronically Signed

NEXT STEPS FOR PAYROLL ADMINISTRATION:
------------------------------------------------------
Please review and verify the employee's monthly filing in the Admin Portal:
${origin}/?tab=admin_filings&month=${params.month}

Once verified, these records will be processed for payroll calculation and disbursement.

WMedlaw Daily Time Record & Payroll System
Reference: ${refNo}
`;
}

/**
 * High-level helper to dispatch a DTR finalization notification email to a single admin.
 */
export async function sendDtrFinalizedNotification(
  params: DtrFinalizedEmailParams
): Promise<SendEmailResult> {
  const monthLabel = params.month_label || formatMonthLabel(params.month);
  const subject = `[Action Required] Monthly DTR Finalized: ${params.employee_name} - ${monthLabel} [Ref: ${params.reference_no || 'DTR'}]`;
  const html = buildDtrFinalizedEmailHtml(params);
  const text = buildDtrFinalizedEmailText(params);

  return await sendEmail({
    to: params.to,
    subject,
    html,
    text,
    tag: 'MONTHLY DTR FINALIZATION ADMIN NOTIFICATION DISPATCH',
  });
}

/**
 * Dispatches DTR finalization notification emails to multiple administrators.
 * De-duplicates admin emails and returns comprehensive dispatch results.
 */
export async function notifyAdminsOnDtrFinalized(
  params: Omit<DtrFinalizedEmailParams, 'to' | 'admin_name'> & {
    admins: AdminRecipient[];
  }
): Promise<NotifyAdminsResult> {
  const { admins, ...details } = params;
  const uniqueEmails = new Map<string, string>();

  (admins || []).forEach((a) => {
    const clean = (a?.email || '').trim().toLowerCase();
    if (clean && clean.includes('@') && !uniqueEmails.has(clean)) {
      uniqueEmails.set(clean, a.name || 'Administrator');
    }
  });

  const recipients = Array.from(uniqueEmails.entries());
  const results: NotifyAdminsResult['results'] = [];
  let sentCount = 0;
  let simulatedAny = false;

  for (const [email, name] of recipients) {
    try {
      const res = await sendDtrFinalizedNotification({
        ...details,
        to: email,
        admin_name: name,
      });

      if (res.sent) {
        sentCount++;
        if (res.simulated) simulatedAny = true;
      }

      results.push({
        email,
        success: res.sent,
        simulated: res.simulated,
        id: res.id,
        error: res.error || res.reason,
      });
    } catch (err: any) {
      results.push({
        email,
        success: false,
        error: err?.message || 'Error sending email to admin',
      });
    }
  }

  return {
    total: recipients.length,
    sent: sentCount,
    simulated: simulatedAny,
    recipients: recipients.map(([email]) => email),
    results,
  };
}

// ============================================================================
// DTR MONTHLY FINALIZATION REMINDER (ADMIN → EMPLOYEE) EMAIL NOTIFICATIONS
// ============================================================================

export interface DtrFinalizeReminderEmailParams {
  to: string;
  employee_name: string;
  employee_no?: string;
  department?: string;
  month: string; // YYYY-MM
  month_label?: string;
  deadline_date: string; // YYYY-MM-DD (last day of month)
  days_remaining: number;
  entries_count: number;
  total_hours: number;
  open_sessions_count?: number;
  sent_by_name?: string;
  origin?: string;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLongDate(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function describeDaysRemaining(days: number): string {
  if (days <= 0) return 'Due today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/**
 * Builds the HTML reminder email sent to an employee who has not yet
 * finalized (self-approved) their DTR logs for the month.
 */
export function buildDtrFinalizeReminderEmailHtml(params: DtrFinalizeReminderEmailParams): string {
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
  const logoUrl = getEmailLogoUrl(origin);
  const monthLabel = escapeHtml(params.month_label || formatMonthLabel(params.month));
  const deadlineLabel = escapeHtml(formatLongDate(params.deadline_date));
  const daysLabel = describeDaysRemaining(params.days_remaining);
  const employeeName = escapeHtml(params.employee_name || 'Employee');
  const reviewUrl = `${origin}/?tab=my_dtr&month=${encodeURIComponent(params.month)}`;
  const openSessions = params.open_sessions_count || 0;
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const openSessionsWarning = openSessions > 0
    ? `
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #991b1b; line-height: 18px; margin-bottom: 20px;">
                <strong>&#9888; ${openSessions} open session${openSessions === 1 ? '' : 's'} detected:</strong>
                <br>
                Please punch out or correct any shift without a time-out before finalizing. Open sessions block finalization.
              </div>`
    : '';

  const noEntriesNote = params.entries_count === 0
    ? `
              <div style="background-color: #f1f5f9; border-left: 3px solid #64748b; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #334155; line-height: 20px; margin-bottom: 20px;">
                No time logs have been recorded for ${monthLabel} yet. If you rendered work this month, please file your DTR entries before finalizing.
              </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Reminder: Finalize your DTR for ${monthLabel}</title>
</head>
<body style="font-family: ${font}; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" valign="top" style="padding: 12px 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" bgcolor="#064e3b" style="background-color: #064e3b; background: #064e3b linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <img src="${logoUrl}" alt="WMedlaw Logo" width="56" height="56" style="display: block; margin: 0 auto 12px; width: 56px; height: 56px; border-radius: 12px; background-color: #ffffff; padding: 3px; border: 0; outline: none;" />
              <div style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #ffffff !important; opacity: 0.95; font-weight: 600; margin: 0 0 6px; font-family: ${font};">
                WMedlaw DTR &amp; Payroll Management
              </div>
              <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 4px; color: #ffffff !important; line-height: 28px; font-family: ${font};">
                Reminder: Finalize Your Monthly DTR
              </h1>
              <p style="font-size: 13px; margin: 0; color: #ffffff !important; opacity: 0.95; line-height: 18px; font-family: ${font};">
                ${monthLabel} &bull; Deadline ${deadlineLabel}
              </p>
            </td>
          </tr>

          <!-- Callout -->
          <tr>
            <td style="padding: 24px 24px 0;">
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 12px; padding: 18px 20px; margin: 0;">
                <span style="display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 8px;">
                  &#9200; ${daysLabel}
                </span>
                <h3 style="margin: 6px 0 4px; font-size: 16px; font-weight: 800; color: #92400e;">
                  Your ${monthLabel} time logs are not yet finalized
                </h3>
                <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 20px;">
                  Please review your daily time records and finalize them on or before <strong>${deadlineLabel}</strong> so payroll can process your hours on schedule.
                </p>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 24px 24px;">
              <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 16px;">
                Dear ${employeeName},
                <br>
                Here is a snapshot of what is currently recorded for you this month:
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: separate; border-spacing: 8px; margin: 8px 0 20px;">
                <tr>
                  <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Logged Shifts</div>
                    <div style="font-size: 22px; font-weight: 800; color: #065f46; margin: 4px 0 2px;">${params.entries_count}</div>
                    <div style="font-size: 10px; color: #64748b;">Sessions in ${monthLabel}</div>
                  </td>
                  <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; text-align: center; vertical-align: top; width: 50%;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Recorded Hours</div>
                    <div style="font-size: 22px; font-weight: 800; color: #065f46; margin: 4px 0 2px;">${(params.total_hours || 0).toFixed(2)}h</div>
                    <div style="font-size: 10px; color: #64748b;">Not yet certified</div>
                  </td>
                </tr>
              </table>
${openSessionsWarning}${noEntriesNote}
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #1e40af; line-height: 20px;">
                <strong>How to finalize:</strong>
                <br>
                1. Open <strong>My DTR Records</strong> and select ${monthLabel}.
                <br>
                2. Check every shift: time-in, time-out and accomplishment remarks.
                <br>
                3. File corrections for anything missing or wrong.
                <br>
                4. Click <strong>Finalize &amp; Self-Approve Month</strong> and confirm the attestation.
              </div>

              <div style="text-align: center; margin: 28px 0 12px;">
                <a href="${reviewUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none;">
                  Review &amp; Finalize My DTR &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 18px;">
              <p style="margin: 0 0 6px;">
                <strong style="color: #64748b;">WMedlaw Daily Time Record &amp; Payroll Management System</strong>
              </p>
              <p style="margin: 0 0 6px;">
                This reminder was sent by ${escapeHtml(params.sent_by_name || 'Payroll Administration')}. If you have already finalized your ${monthLabel} DTR, you can ignore this message.
              </p>
              <p style="margin: 0; font-size: 10px;">
                Recipient: ${escapeHtml(params.to)} &bull; ${new Date().toUTCString()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDtrFinalizeReminderEmailText(params: DtrFinalizeReminderEmailParams): string {
  const origin = params.origin || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
  const monthLabel = params.month_label || formatMonthLabel(params.month);
  const deadlineLabel = formatLongDate(params.deadline_date);
  const openSessions = params.open_sessions_count || 0;

  return `======================================================
WMEDLAW DTR & PAYROLL - REMINDER: FINALIZE YOUR MONTHLY DTR
======================================================

Dear ${params.employee_name || 'Employee'},

Your Daily Time Record for ${monthLabel} has not been finalized yet.
Please review and finalize it on or before ${deadlineLabel} (${describeDaysRemaining(params.days_remaining)}).

CURRENTLY RECORDED:
------------------------------------------------------
Logged Shifts: ${params.entries_count}
Recorded Hours: ${(params.total_hours || 0).toFixed(2)} hrs
${openSessions > 0 ? `Open Sessions: ${openSessions} (punch out or correct these before finalizing)\n` : ''}
HOW TO FINALIZE:
------------------------------------------------------
1. Open My DTR Records and select ${monthLabel}.
2. Check every shift: time-in, time-out and remarks.
3. File corrections for anything missing or wrong.
4. Click "Finalize & Self-Approve Month" and confirm the attestation.

${origin}/?tab=my_dtr&month=${params.month}

If you have already finalized your ${monthLabel} DTR, you can ignore this message.

WMedlaw Daily Time Record & Payroll System
`;
}

export async function sendDtrFinalizeReminder(
  params: DtrFinalizeReminderEmailParams
): Promise<SendEmailResult> {
  const monthLabel = params.month_label || formatMonthLabel(params.month);
  const subject = `[Reminder] Please finalize your DTR for ${monthLabel} by ${formatLongDate(params.deadline_date)}`;

  return await sendEmail({
    to: params.to,
    subject,
    html: buildDtrFinalizeReminderEmailHtml(params),
    text: buildDtrFinalizeReminderEmailText(params),
    tag: 'MONTHLY DTR FINALIZATION REMINDER DISPATCH',
  });
}
