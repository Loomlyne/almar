import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { allowHostOverride, HOST_OVERRIDE_HEADER, isOpsHost, routeFor, SHELL_HEADER } from "./lib/host";
import { isOwnerEmail } from "./lib/auth/rules";
import { OPS_PATH_HEADER } from "./lib/ops-routes";
import { sessionCookieOptions } from "./lib/supabase/cookie-options";

// Plan 02-02: keep her Supabase session fresh. Requests without a Supabase auth cookie never
// wait on Supabase, so the static Framer pages stay fast.
// Plan 02-04: the Host header picks the shell. The ops host serves app/dashboard without
// /dashboard in the URL; the marketing host answers 404 for /dashboard and /ops in production.
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

type PendingCookie = { name: string; value: string; options: CookieOptions };

async function sessionEmail(request: NextRequest, pending: PendingCookie[]): Promise<string | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !hasAuthCookie(request)) return undefined;
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        pending.push(...list);
      },
    },
  });
  // getUser, not getSession: it asks Supabase, so a revoked session is dropped here.
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? undefined;
}

export async function middleware(request: NextRequest) {
  const nodeEnv = process.env.NODE_ENV;
  const override = allowHostOverride(nodeEnv) ? request.headers.get(HOST_OVERRIDE_HEADER) : null;
  const host = override || request.headers.get("host");

  const pending: PendingCookie[] = [];
  const email = await sessionEmail(request, pending);

  // The shell header and the ops-path header are set here only; a client-sent copy is always dropped, on every host.
  // The ops-path header (plan 03.2-03) is the path the browser asked for, before any rewrite: the (ops) layout reads
  // it to render a section's page only when lib/ops-routes.ts lists that section.
  const forwarded = new Headers(request.headers);
  forwarded.delete(SHELL_HEADER);
  forwarded.delete(OPS_PATH_HEADER);
  if (isOpsHost(host)) {
    forwarded.set(SHELL_HEADER, "ops");
    forwarded.set(OPS_PATH_HEADER, request.nextUrl.pathname);
  }

  const route = routeFor({
    host,
    path: request.nextUrl.pathname,
    // A client-sent copy only skips the clean-URL redirect; the (ops) layout still gates the owner.
    rewritten: request.headers.get(SHELL_HEADER) === "ops",
    isOwner: email ? isOwnerEmail(email) : false,
    production: nodeEnv === "production",
  });

  let response: NextResponse;
  if (route.kind === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = route.path;
    response = NextResponse.redirect(target, 308);
  } else if (route.kind === "rewrite" || route.kind === "not-found") {
    const target = request.nextUrl.clone();
    // A path no route answers: Next renders the branded app/not-found.tsx with status 404.
    target.pathname = route.kind === "rewrite" ? route.path : "/_almar/not-found";
    response = NextResponse.rewrite(target, { request: { headers: forwarded } });
  } else {
    response = NextResponse.next({ request: { headers: forwarded } });
  }
  for (const { name, value, options } of pending) response.cookies.set(name, value, options);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|assets/|favicon|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff2?|css|js|map)$).*)"],
};
