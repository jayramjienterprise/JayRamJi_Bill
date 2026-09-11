import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const internalSecret = process.env.INTERNAL_EMAIL_SECRET || process.env.JWT_SECRET || 'jre_internal_email_secret_key_2026';
    
    // Validate secret token if provided
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (internalSecret && token !== internalSecret) {
      // If neither matches, reject unauthorized calls
      return NextResponse.json(
        { success: false, error: 'Unauthorized email relay request' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { success: false, error: 'Missing required email fields (to, subject, html/text)' },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER || 'priymavani001@gmail.com';
    const emailPass = process.env.EMAIL_PASS || 'vvbfjkjfkftoufax';

    // Create Gmail transporter (Vercel serverless has open outbound port 465 / 587)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"Jay Ramji Enterprise" <${emailUser}>`,
      to,
      subject,
      text: text || '',
      html: html || '',
    });

    console.log(`[Vercel Email Relay] Email sent to ${to}: Message ID: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `Email dispatched successfully via Gmail SMTP to ${to}`,
    });
  } catch (error: any) {
    console.error('[Vercel Email Relay Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to relay email',
      },
      { status: 500 }
    );
  }
}
