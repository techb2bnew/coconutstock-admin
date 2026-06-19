import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Simple in-memory OTP store (production mein Redis use karo)
const otpStore = new Map<string, { otp: string; expires: number }>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'API key missing' }, { status: 500 });
    }

    // ✅ 6-digit OTP generate karo
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // ✅ Store karo (email → otp + expiry)
    otpStore.set(email.toLowerCase(), { otp, expires });

    const currentYear = new Date().getFullYear();
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" style="background:#f4f4f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="600" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#86baff;padding:30px;text-align:center;">
  <h1 style="margin:0;color:#fff;">🌴 CoconutStock</h1>
  <p style="margin:10px 0 0;color:#fff;">Password Reset OTP</p>
</td></tr>
<tr><td style="padding:30px;">
  <p style="font-size:18px;color:#1f2937;">Hello,</p>
  <p style="color:#4b5563;">We received a request to reset your password. Use the OTP below:</p>
  <div style="text-align:center;margin:30px 0;">
    <div style="background:#f9fafb;border:2px dashed #00a1ff;border-radius:12px;padding:25px;display:inline-block;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Your OTP Code</p>
      <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:#00a1ff;letter-spacing:6px;">${otp}</span>
    </div>
  </div>
  <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;padding:15px;margin:20px 0;">
    <p style="color:#856404;margin:0;font-weight:600;">⚠️ This OTP expires in 10 minutes.</p>
  </div>
  <p style="color:#4b5563;">If you didn't request this, please ignore this email.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="color:#6b7280;font-size:12px;margin:0;">© ${currentYear} CoconutStock. All rights reserved.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'CoconutStock <support@coconutstock.com>',
        to: [email],
        subject: 'Your OTP Code - CoconutStock',
        html,
      }),
    });

    const result = await resendRes.json();
    if (!resendRes.ok) {
      return NextResponse.json({ error: result }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ OTP verify endpoint
export async function PUT(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP required' }, { status: 400 });
    }

    const stored = otpStore.get(email.toLowerCase());

    if (!stored) {
      return NextResponse.json({ error: 'OTP not found. Please request a new one.' }, { status: 400 });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(email.toLowerCase());
      return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 });
    }

    if (stored.otp !== otp.trim()) {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
    }

    // ✅ OTP valid — delete karo
    otpStore.delete(email.toLowerCase());
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}