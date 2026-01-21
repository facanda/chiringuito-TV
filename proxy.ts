import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;

    // Admin gate (solo si llega aquí ya está autenticado)
    if (pathname.startsWith("/admin")) {
      const role = (req.nextauth?.token as any)?.role || "USER";
      if (role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

/**
 * 🔥 CRÍTICO: el proxy NO debe correr en:
 * - /api/* (incluye /api/auth/*)
 * - /login, /register, /forgot, /reset
 * - _next y assets
 */
export const config = {
  matcher: [
    "/((?!api/|login|register|forgot|reset|_next/|favicon.ico|robots.txt|sitemap.xml|icons/|images/|assets/|fonts/).*)",
  ],
};
