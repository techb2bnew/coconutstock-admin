import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, name, email, password, role, companyName, franchiseName, deliveryZoneName } = body;

    const RESEND_API_KEY = process.env.RESEND_API_KEY; // NEXT_PUBLIC nahi — server side
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'API key missing' }, { status: 500 });
    }

    const currentYear = new Date().getFullYear();
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" style="background:#f4f4f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="600" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#86baff;padding:30px;text-align:center;">
  <h1 style="margin:0;color:#fff;">🌴 Welcome to CoconutStock!</h1>
  <p style="margin:10px 0 0;color:#fff;">Your account has been created</p>
</td></tr>
<tr><td style="padding:30px;">
  <p style="font-size:18px;color:#1f2937;">Hello <strong style="color:#00a1ff;">${name}</strong>,</p>
  <p style="color:#4b5563;">Your ${role} account has been created. Here are your login credentials:</p>
  <div style="background:#f9fafb;border-left:4px solid #00a1ff;border-radius:8px;padding:20px;margin:20px 0;">
    <table width="100%">
      <tr><td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;width:40%;">Email:</td><td style="color:#1f2937;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">${email}</td></tr>
      <tr><td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">Role:</td><td style="color:#1f2937;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">${role}</td></tr>
      ${companyName ? `<tr><td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">Company:</td><td style="color:#1f2937;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">${companyName}</td></tr>` : ''}
      ${franchiseName ? `<tr><td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">Franchise:</td><td style="color:#1f2937;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">${franchiseName}</td></tr>` : ''}
      ${deliveryZoneName ? `<tr><td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">Delivery Zone:</td><td style="color:#1f2937;font-weight:600;font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;">${deliveryZoneName}</td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:14px;font-weight:600;margin:15px 0 8px;">Temporary Password:</p>
    <div style="background:#fff;border:2px dashed #00a1ff;border-radius:8px;padding:15px;text-align:center;">
      <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#00a1ff;letter-spacing:2px;">${password}</span>
    </div>
  </div>
  <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;padding:15px;">
    <p style="color:#856404;margin:0;font-weight:600;">⚠️ Please change your password after first login.</p>
  </div>
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
        to: [to],
        subject: 'Welcome to CoconutStock - Your Login Credentials',
        html,
      }),
    });

    const result = await resendRes.json();
    if (!resendRes.ok) {
      return NextResponse.json({ error: result }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}