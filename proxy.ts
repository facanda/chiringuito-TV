import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;

    // Si alguien intenta /admin sin ser ADMIN, lo mandamos al home
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

// ✅ IMPORTANT: excluye /login y rutas públicas para evitar loops
export const config = {
  matcher: [
    "/((?!api/auth|api/password|login|register|forgot|reset|_next|favicon.ico|robots.txt|sitemap.xml|icons/|images/|assets/|fonts/).*)",
  ],
};
