import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;

    // Admin gate: role en el token
    if (pathname.startsWith("/admin")) {
      const role = (req.nextauth?.token as any)?.role || "USER";
      if (role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

/**
 * IMPORTANT:
 * Excluimos rutas públicas para evitar loops (/login, /api/auth, etc.)
 */
export const config = {
  matcher: [
    // corre SOLO en rutas protegidas (todo menos estas):
    "/((?!api/auth|api/password|login|register|forgot|reset|_next|favicon.ico|robots.txt|sitemap.xml|icons/|images/|assets/|fonts/).*)",
  ],
};
