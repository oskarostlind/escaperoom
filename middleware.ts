import { NextRequest, NextResponse } from "next/server";

const ADMIN_PATH = "/admin";
const LOGIN_PATH = "/admin/login";
const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "adm";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApi = pathname.startsWith("/api/admin");
  if (!pathname.startsWith(ADMIN_PATH) && !isApi) return NextResponse.next(); // allt annat tillåts

  // /admin/login och /api/admin/login ska vara åtkomliga utan cookie
  if (pathname === LOGIN_PATH || pathname === "/api/admin/login") return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;

  if (!cookie && isApi) {
    return NextResponse.json({ ok: false, error: "Ej inloggad" }, { status: 401 });
  }

  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Enkel verifiering: existens av cookie räcker; den sätts enbart av vårt /api-admin-login
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
