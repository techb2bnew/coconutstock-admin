import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role } = await req.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Pehle check karo user exist karta hai ya nahi
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const exists = existingUsers?.users?.find((u) => u.email === email);

    if (exists) {
      // Already exist karta hai — password update karo
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        exists.id,
        { password, email_confirm: true }
      );
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, userId: exists.id, action: 'updated' });
    }

    // Naya user banao
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirm email nahi jayegi
      user_metadata: {
        name,
        role,
        is_temporary_password: true,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: data.user?.id, action: 'created' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}