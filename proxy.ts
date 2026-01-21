import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Deja pasar assets públicos + cosas internas de Next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isPublicAsset(pathname)
  ) {
    return NextResponse.next();
  }

  // 2) Rutas públicas (auth pages + auth api)
  // Nota: incluimos /api/auth/error y /api/auth/_log para evitar loops.
  if (
    pathname.startsWith("/api/auth") || // NextAuth (incluye [...nextauth], error, _log, etc.)
    pathname.startsWith("/api/password") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot" ||
    pathname === "/reset"
  ) {
    return NextResponse.next();
  }

  // 3) Todo lo demás requiere sesión
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 4) Rutas ADMIN: requiere role=ADMIN (sin Prisma, solo JWT)
  if (pathname.startsWith("/admin")) {
    const role = (token as any).role || "USER";
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
