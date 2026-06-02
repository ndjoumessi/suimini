import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side navigation guard (Next.js `proxy` convention — the former
 * `middleware` file convention is deprecated in Next 16; `proxy` always runs on
 * the Node.js runtime, which suits `@supabase/ssr`).
 *
 *   /app  : requires a Supabase session OR the demo cookie, else → /
 *   /     : redirects signed-in users straight to /app (no landing flash)
 *
 * The demo flag is mirrored to a cookie (`suimini_demo`) so it is readable here;
 * the client guard re-checks demo via localStorage as well.
 */
export async function proxy(req: NextRequest) {
  const response = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Supabase not configured → let the client handle everything.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isDemo = req.cookies.get('suimini_demo')?.value === 'true';
  const path = req.nextUrl.pathname;

  // Account status (multitenant validation). When the column/migration is absent
  // the query returns nothing → treat as approved so the app keeps working.
  let approved = true;
  if (user) {
    try {
      const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single();
      const status = (profile as { status?: string } | null)?.status;
      approved = !status || status === 'approved';
    } catch { approved = true; }
  }

  const redirectTo = (pathname: string) => {
    const u = req.nextUrl.clone();
    u.pathname = pathname;
    const redirect = NextResponse.redirect(u);
    // Preserve any refreshed auth cookies set above.
    response.cookies.getAll().forEach(c => redirect.cookies.set(c));
    return redirect;
  };

  if (path === '/app' || path.startsWith('/app/')) {
    if (!user && !isDemo) return redirectTo('/');
    // Connected but not yet approved → back to '/', which shows the status screen.
    if (user && !approved) return redirectTo('/');
  } else if (path === '/') {
    // Only approved users skip the landing; pending/rejected/suspended stay on '/'.
    if (user && approved) return redirectTo('/app');
  }

  return response;
}

export const config = {
  matcher: ['/', '/app', '/app/:path*'],
};
