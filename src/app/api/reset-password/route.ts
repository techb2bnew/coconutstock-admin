import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // ✅ Supabase Auth password update (admin se — no session needed)
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = users?.users?.find((u) => u.email === email);

    if (authUser) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password }
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // ✅ Saari tables mein password update karo
    await supabaseAdmin.from('staff').update({ password }).eq('email', email);
    await supabaseAdmin.from('customers').update({ password }).eq('email', email);
    await supabaseAdmin.from('drivers').update({ password }).eq('email', email);
    await supabaseAdmin.from('franchises').update({ password }).eq('owner_email', email);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}