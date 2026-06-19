// Supabase Edge Function: send-staff-credentials
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return 'N/A'; }
}

function getWelcomeEmailTemplate(data: {
  to: string; name: string; email: string; password: string; role: string; loginUrl: string;
  hireDate?: string | null; franchiseName?: string | null; vehicleId?: string | null;
  contractStartDate?: string | null; companyName?: string | null; deliveryZoneName?: string | null;
}): { subject: string; html: string } {
  const { name, email, password, role, hireDate, franchiseName, vehicleId, contractStartDate, companyName, deliveryZoneName } = data;
  const currentYear = new Date().getFullYear();
  const formattedHireDate = formatDate(hireDate);
  const formattedContractDate = formatDate(contractStartDate);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CoconutStock</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#86baff;padding:40px 30px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;">🌴 Welcome to CoconutStock!</h1>
              <p style="margin:12px 0 0 0;font-size:18px;color:#ffffff;">Your account has been created</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 20px 0;font-size:18px;color:#1f2937;">Hello <strong style="color:#00a1ff;">${name}</strong>,</p>
              <p style="margin:0 0 30px 0;font-size:16px;color:#4b5563;">Your ${role.toLowerCase()} account has been successfully created. Below are your login credentials.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f9fafb;border-left:4px solid #00a1ff;border-radius:8px;">
                <tr>
                  <td style="padding:25px;">
                    <h2 style="margin:0 0 20px 0;font-size:20px;color:#1f2937;">Login Credentials</h2>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;width:40%;">Email:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${email}</td></tr>
                      <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Role:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${role}</td></tr>
                      ${companyName ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Company:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${companyName}</td></tr>` : ''}
                      ${franchiseName ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Franchise:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${franchiseName}</td></tr>` : ''}
                      ${deliveryZoneName ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Delivery Zone:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${deliveryZoneName}</td></tr>` : ''}
                      ${hireDate ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Hire Date:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${formattedHireDate}</td></tr>` : ''}
                      ${contractStartDate ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Contract Start:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${formattedContractDate}</td></tr>` : ''}
                      ${vehicleId ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Vehicle ID:</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:14px;font-weight:600;">${vehicleId}</td></tr>` : ''}
                    </table>

                    <div style="margin-top:20px;">
                      <p style="margin:0 0 10px 0;color:#6b7280;font-size:14px;font-weight:600;">Temporary Password:</p>
                      <div style="padding:15px;background:#ffffff;border-radius:8px;border:2px dashed #00a1ff;text-align:center;">
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#00a1ff;letter-spacing:2px;">${password}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;margin:25px 0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px 0;font-weight:600;color:#856404;font-size:15px;">⚠️ Important Security Notice</p>
                    <p style="margin:0;color:#856404;font-size:14px;">This is a temporary password. Please change it immediately after your first login.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:25px 30px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">© ${currentYear} CoconutStock. All rights reserved.</p>
              <p style="margin:4px 0 0 0;color:#9ca3af;font-size:11px;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: `Welcome to CoconutStock - Your Login Credentials`, html };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { to, name, email, password, role, loginUrl, hireDate, franchiseName, vehicleId, contractStartDate, companyName, deliveryZoneName } = body;

    if (!to || !name || !email || !password || !role || !loginUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, name, email, password, role, loginUrl' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const emailTemplate = getWelcomeEmailTemplate({ to, name, email, password, role, loginUrl, hireDate, franchiseName, vehicleId, contractStartDate, companyName, deliveryZoneName });

    console.log('Sending welcome email to:', to);
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'CoconutStock <support@coconutstock.com>',
        to: [to],
        subject: emailTemplate.subject,
        html: emailTemplate.html
      })
    });

    const responseData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Resend API error:', responseData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email', details: responseData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Email sent successfully:', responseData);
    return new Response(
      JSON.stringify({ success: true, messageId: responseData.id, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
