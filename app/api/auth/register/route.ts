import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest } from '@/lib/crypto-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Decrypt incoming registration payload
    const body = await parseEncryptedRequest<any>(request);
    const { email, password, firstName, lastName } = body;

    if (!email || !password) {
      return createEncryptedResponse(
        { error: 'Email and password are required' },
        400
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const trimmedFirst = (firstName || '').trim();
    const trimmedLast = (lastName || '').trim();
    const fullName = `${trimmedFirst} ${trimmedLast}`.trim();

    const supabaseServer = createServerClient();

    // Use admin.createUser with email_confirm: true.
    // This bypasses Supabase's built-in email rate limit (3-4 emails/hr)
    // and automatically activates the user without requiring an email confirmation link.
    const { data, error } = await supabaseServer.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: trimmedFirst,
        last_name: trimmedLast,
        full_name: fullName,
      },
    });

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    const isDefaultSysAdmin = cleanEmail === 'marquez.ronrons@gmail.com';
    const userRole = isDefaultSysAdmin ? 'system_admin' : 'employee';
    const userStatus = isDefaultSysAdmin ? 'active' : 'pending_approval';

    // Directly persist the user profile in public.profiles using the server client.
    // This ensures the profile immediately exists and shows up in the admin dashboard,
    // independent of whether database triggers or client RLS rules are applied.
    try {
      const empNo = isDefaultSysAdmin
        ? 'SYS-001'
        : `EMP-${Math.floor(10000 + Math.random() * 90000)}`;

      await supabaseServer.from('profiles').upsert(
        {
          id: data.user.id,
          email: cleanEmail,
          first_name: trimmedFirst || (isDefaultSysAdmin ? 'Ron' : 'User'),
          last_name: trimmedLast || (isDefaultSysAdmin ? 'Marquez' : ''),
          username: cleanEmail.split('@')[0],
          role: userRole,
          status: userStatus,
          clocks_in: !isDefaultSysAdmin,
          employee_no: empNo,
          position: isDefaultSysAdmin ? 'System Administrator' : 'Pending Approval',
          department: isDefaultSysAdmin ? 'System Architecture' : 'IT',
          hourly_rate: 300.0,
          pay_frequency: 'monthly',
          auth_provider: 'email',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (profileErr) {
      console.warn('Could not upsert profile during registration:', profileErr);
    }

    return createEncryptedResponse({
      success: true,
      user: data.user,
      message: isDefaultSysAdmin
        ? 'System Admin registered and active!'
        : 'Registration successful! Your account is pending administrator approval before you can access the system.',
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Internal server error during registration' },
      500
    );
  }
}
