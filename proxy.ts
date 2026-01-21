import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|txt|xml|json|map|css|js|woff|woff2|ttf|eot)$/i.test(
      pathname
    )
  );
}

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;

    // 1) deja pasar assets + rutas internas
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon") ||
      pathname === "/robots.txt" ||
      pathname === "/sitemap.xml" ||
      isPublicAsset(pathname)
    ) {
      return NextResponse.next();
    }

    // 2) rutas públicas
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/password") ||
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot" ||
      pathname === "/reset"
    ) {
      return NextResponse.next();
    }

    // 3) Admin gate (role viene en el token)
    if (pathname.startsWith("/admin")) {
      const role = ((req as any).nextauth?.token as any)?.role || "USER";
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

export const config = { matcher: ["/:path*"] };
