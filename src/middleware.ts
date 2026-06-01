import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side navigation guard (note: `@supabase/auth-helpers-nextjs` is deprecated —
 * `@supabase/ssr` is its official replacement, already used across this project).
 *
 *   /app  : requires a Supabase session OR the demo cookie, else → /
 *   /     : redirects signed-in users straight to /app (no landing flash)
 *
 * The demo flag is mirrored to a cookie (`suimini_demo`) so it is readable here;
 * the client guard re-checks demo via localStorage as well.
 */
export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

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
  } else if (path === '/') {
    if (user) return redirectTo('/app');
  }

  return response;
}

export const config = {
  matcher: ['/', '/app', '/app/:path*'],
};
