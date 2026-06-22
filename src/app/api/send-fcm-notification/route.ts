import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ FCM V1 API access token fetch karo
 
const getFCMAccessToken = async (): Promise<string> => {
  const rawJson = process.env.NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON!;
  const serviceAccount = JSON.parse(rawJson);
  
  // ✅ private_key mein \n fix karo — env se aate waqt escape ho jaata hai
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token!;
};
export async function POST(req: NextRequest) {
     console.log('ENV CHECK:', process.env.NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON ? '✅ Found' : '❌ undefined')
  
  if (!process.env.NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not set in .env.local' }, { status: 500 });
  }
  try {
    const { tokens, title, message } = await req.json();

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No tokens provided' }, { status: 400 });
    }

    const serviceAccount = JSON.parse(process.env.NEXT_PUBLIC_FCM_SERVICE_ACCOUNT_JSON!);
    const projectId = serviceAccount.project_id;
    const accessToken = await getFCMAccessToken();

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    // ✅ Har token ko individually send karo (FCM V1 API)
    for (const token of tokens) {
      try {
        const fcmRes = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body: message },
                android: { priority: 'high' },
                apns: {
                  payload: { aps: { alert: { title, body: message }, sound: 'default' } },
                },
              },
            }),
          }
        );

        const result = await fcmRes.json();

        if (!fcmRes.ok) {
          failureCount++;
          // Invalid token detect karo
          const errCode = result?.error?.details?.[0]?.errorCode || '';
          if (
            errCode === 'UNREGISTERED' ||
            errCode === 'INVALID_ARGUMENT'
          ) {
            invalidTokens.push(token);
          }
        } else {
          successCount++;
        }
      } catch (err) {
        failureCount++;
      }
    }

    // ✅ Invalid tokens database se remove karo
    if (invalidTokens.length > 0) {
      await supabaseAdmin
        .from('customers')
        .update({ fcm_token: null })
        .in('fcm_token', invalidTokens);

      await supabaseAdmin
        .from('staff')
        .update({ fcm_token: null })
        .in('fcm_token', invalidTokens);
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      invalidTokens,
    });
  } catch (err: any) {
    console.error('FCM API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}