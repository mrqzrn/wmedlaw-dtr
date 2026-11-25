import { NextResponse } from 'next/server';
import { encryptPayload, decryptPayload } from './crypto';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an encrypted JSON response for Next.js Route Handlers.
 * In browser DevTools Network tab, the body will appear as an opaque encrypted payload.
 */
export async function createEncryptedResponse(
  data: any,
  status: number = 200,
  headers?: Record<string, string>
) {
  try {
    const encrypted = await encryptPayload(data);
    return NextResponse.json(
      {
        _encrypted: true,
        payload: encrypted,
      },
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          ...headers,
        },
      }
    );
  } catch (err: any) {
    console.error('Failed to encrypt server response:', err);
    return NextResponse.json(
      { error: 'Internal encryption error' },
      { status: 500 }
    );
  }
}

/**
 * Parses and decrypts an incoming request body.
 * Supports both encrypted requests ({ _encrypted: true, payload: "..." })
 * and standard JSON bodies.
 */
export async function parseEncryptedRequest<T = any>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text || !text.trim()) {
    return {} as T;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text as unknown as T;
  }

  if (parsed && typeof parsed === 'object' && (parsed._encrypted || parsed.payload)) {
    return await decryptPayload<T>(parsed);
  }

  return parsed as T;
}

export interface AuthApiResult {
  user: any | null;
  profile: any | null;
  isAdmin: boolean;
  token: string | null;
  error: string | null;
}

/**
 * Authenticates an incoming API request by verifying the Supabase JWT Bearer token.
 */
export async function authenticateApiRequest(
  request: Request,
  supabaseServer: SupabaseClient
): Promise<AuthApiResult> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      token: null,
      error: 'Missing or invalid Authorization header',
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      token: null,
      error: 'Empty Bearer token',
    };
  }

  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        profile: null,
        isAdmin: false,
        token: null,
        error: error?.message || 'Invalid or expired session token',
      };
    }

    const email = (user.email || '').toLowerCase().trim();
    const isDefaultSysAdmin = email === 'marquez.ronrons@gmail.com';

    // Fetch caller's profile to inspect role
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const role = isDefaultSysAdmin
      ? 'system_admin'
      : profile?.role || 'employee';

    const isAdmin = isDefaultSysAdmin || role === 'admin' || role === 'system_admin';

    return {
      user,
      profile,
      isAdmin,
      token,
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      profile: null,
      isAdmin: false,
      token: null,
      error: err?.message || 'Authentication verification failed',
    };
  }
}
