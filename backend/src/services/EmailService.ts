import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Service managing email delivery via Gmail SMTP.
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (!env.EMAIL_USER || !env.EMAIL_PASS) {
      console.warn('⚠️ [EmailService] EMAIL_USER or EMAIL_PASS not configured. Email sending will be skipped.');
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    }

    return this.transporter;
  }

  /**
   * Sends password reset email with secure 30-minute reset link
   */
  async sendPasswordResetEmail(toEmail: string, resetUrl: string, recipientName?: string): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log(`ℹ️ [EmailService (Mock)] In development/unconfigured mode. Reset URL for ${toEmail}: ${resetUrl}`);
      return false;
    }

    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Jay Ramji Enterprise password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; text-align: center; border-bottom: 1px solid #334155;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; font-weight: 900; color: #f59e0b; font-size: 18px; margin-bottom: 12px;">
                JRE
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #f59e0b; text-transform: uppercase;">
                Jay Ramji Enterprise
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                Billing & Invoice Engine
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #f8fafc;">
                Password Reset Request
              </h2>
              
              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                ${greeting}
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                We received a request to reset the password for your account. Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #0f172a; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">
                      Reset Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #0f172a; border-radius: 10px; padding: 14px; border: 1px solid #334155; margin-top: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                  <strong style="color: #cbd5e1;">Notice:</strong> This password reset link expires in <strong>30 minutes</strong> and can only be used once.
                </p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                If you did not request this reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                © Jay Ramji Enterprise • Secure Billing Engine
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `Jay Ramji Enterprise\n\nPassword Reset Request\n\n${greeting}\n\nWe received a request to reset the password for your account.\n\nReset Your Password:\n${resetUrl}\n\nThe link expires in 30 minutes.\n\nIf you did not request this reset, you can safely ignore this email.`;

    try {
      await transporter.sendMail({
        from: `"Jay Ramji Enterprise" <${env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Reset your Jay Ramji Enterprise password',
        text: textContent,
        html: htmlContent,
      });
      return true;
    } catch (err: any) {
      console.error('❌ [EmailService] Failed to send password reset email via Gmail SMTP:', err.message);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
