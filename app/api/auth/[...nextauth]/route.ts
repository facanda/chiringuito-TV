export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export const authOptions = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials: any, req: any) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        // IP / UA
        const ip =
          req?.headers?.get?.("x-forwarded-for")?.split(",")?.[0]?.trim() ||
          req?.headers?.get?.("x-real-ip") ||
          null;

        const userAgent = req?.headers?.get?.("user-agent") || null;

        // ✅ leemos el usuario primero (para saber si es ADMIN)
        const user = await prisma.user.findUnique({ where: { email } });

        // ✅ MANTENIMIENTO: solo ADMIN puede entrar
        const cfg = await prisma.appConfig.findUnique({
          where: { id: 1 },
          select: { maintenanceActive: true },
        });

        if (cfg?.maintenanceActive) {
          if (!user || user.role !== "ADMIN") {
            // ⚠️ error distinguible para el frontend
            throw new Error("MAINTENANCE");
          }
        }

        // bloqueado o no existe
        if (!user || user.isBlocked) {
          await prisma.loginAttempt.create({
            data: { email, ip: ip || undefined, ok: false },
          });
          return null;
        }

        // Rate limit (10 min)
        const since = new Date(Date.now() - 10 * 60 * 1000);

        const failsByEmail = await prisma.loginAttempt.count({
          where: { email, ok: false, createdAt: { gte: since } },
        });

        const failsByIp = await prisma.loginAttempt.count({
          where: { ip: ip || undefined, ok: false, createdAt: { gte: since } },
        });

        if (failsByEmail >= 8 || failsByIp >= 12) {
          await prisma.loginAttempt.create({
            data: { email, ip: ip || undefined, ok: false },
          });
          return null;
        }

        // password check
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          await prisma.loginAttempt.create({
            data: { email, ip: ip || undefined, ok: false },
          });
          return null;
        }

        // login OK
        await prisma.loginAttempt.create({
          data: { email, ip: ip || undefined, ok: true },
        });

        // ✅ sessionVersion + loginSession
        const sessionId = randomUUID();

        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            sessionVersion: { increment: 1 },
            lastLoginAt: new Date(),
            lastLoginIp: ip || undefined,
          },
          select: { id: true, email: true, name: true, role: true, sessionVersion: true },
        });

        await prisma.loginSession.upsert({
          where: { userId: updated.id },
          create: {
            userId: updated.id,
            sessionId,
            ip: ip || undefined,
            userAgent: userAgent || undefined,
          },
          update: {
            sessionId,
            ip: ip || undefined,
            userAgent: userAgent || undefined,
          },
        });

        return {
          id: updated.id,
          email: updated.email,
          name: updated.name ?? "Usuario",
          role: updated.role,
          sessionVersion: updated.sessionVersion,
        };
      },
    }),
  ],

  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user }: any) {
      // primer login (cuando authorize devuelve user)
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        (token as any).role = user.role || "USER";
        (token as any).sv = user.sessionVersion ?? 0;
      }

      // en cada request: refresca desde DB
      if (token?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.sub) },
          select: { isBlocked: true, sessionVersion: true, role: true },
        });

        // invalidar sesión si bloqueado o no existe
        if (!dbUser || dbUser.isBlocked) return {};

        // invalidar si cambió sessionVersion (1 dispositivo / logout all)
        if ((token as any).sv !== dbUser.sessionVersion) return {};

        // ✅ mantener role actualizado
        (token as any).role = dbUser.role;
      }

      return token;
    },

    async session({ session, token }: any) {
      if (token?.sub) {
        (session.user as any).id = token.sub;
        (session.user as any).email = token.email;

        // ✅ CLAVE: role dentro de session.user.role (lo que la UI suele leer)
        (session.user as any).role = (token as any).role || "USER";

        // opcional: también a nivel raíz
        (session as any).role = (token as any).role || "USER";
        (session as any).sessionVersion = (token as any).sv ?? 0;
      }
      return session;
    },
  },

  events: {
    async signIn() {
      // no hacer nada aquí
    },
  },
};

const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };
