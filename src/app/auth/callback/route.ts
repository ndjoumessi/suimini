import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase magic-link / OAuth callback.
 * Exchanges the `?code=` for a session (PKCE) and writes the auth cookies,
 * then redirects back into the app. The browser client (cookie-based) then
 * picks up the session automatically via onAuthStateChange.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Expired / denied magic-link (Supabase appends ?error=access_denied&error_code=
  // otp_expired to the redirect). Send the user home with a clean flag — no hash
  // fragment in the final URL — so the landing can show the "link expired" banner.
  const errorCode = searchParams.get('error_code');
  const errorParam = searchParams.get('error');
  if (errorCode === 'otp_expired' || errorParam === 'access_denied') {
    return NextResponse.redirect(`${origin}/?auth_error=expired`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && anonKey) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { /* ignore — read-only context */ }
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code or exchange failed → return home with an error flag.
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
