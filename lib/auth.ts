import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, req) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        // IP / UA
        const ip =
          (req as any)?.headers?.get?.("x-forwarded-for")?.split(",")?.[0]?.trim() ||
          (req as any)?.headers?.get?.("x-real-ip") ||
          null;

        const userAgent = (req as any)?.headers?.get?.("user-agent") || null;

        // Buscar usuario
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || (user as any).isBlocked) {
          // registramos intento fallido (normal)
          await prisma.loginAttempt.create({
            data: { email, ip: ip || undefined, ok: false },
          });
          return null;
        }

        // ✅ MANTENIMIENTO: bloquear SOLO USER (ADMIN sí entra)
        // (tu AppConfig tiene id default 1)
        try {
          const cfg = await prisma.appConfig.findUnique({ where: { id: 1 } });
          const maintenanceActive = Boolean(cfg?.maintenanceActive);

          if (maintenanceActive && String((user as any).role) !== "ADMIN") {
            // 👇 IMPORTANTE: no lo marcamos como "password wrong"
            // para que no te contamine rate-limit como fallo de contraseña.
            // (y en el login UI, tú no llamas signIn cuando maintenance está ON)
            return null;
          }
        } catch {
          // si falla lectura de config, NO bloqueamos login
        }

        // Rate limit (después de saber que el user existe)
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

        // Password
        const ok = await bcrypt.compare(password, (user as any).password);
        if (!ok) {
          await prisma.loginAttempt.create({
            data: { email, ip: ip || undefined, ok: false },
          });
          return null;
        }

        // Login OK
        await prisma.loginAttempt.create({
          data: { email, ip: ip || undefined, ok: true },
        });

        // sessionVersion: token nace con el nuevo sv
        const sessionId = randomUUID();

        const updated = await prisma.user.update({
          where: { id: (user as any).id },
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
          role: (updated as any).role || "USER",
          sessionVersion: (updated as any).sessionVersion ?? 0,
        } as any;
      },
    }),
  ],

  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user }: any) {
      // primera vez
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        (token as any).role = user.role || "USER";
        (token as any).sv = user.sessionVersion ?? 0;
      }

      // validar en cada request
      if (token?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: String(token.sub) },
          select: { isBlocked: true, sessionVersion: true, role: true },
        });

        if (!dbUser || dbUser.isBlocked) return {};

        // si cambia sessionVersion -> logout
        if ((token as any).sv !== dbUser.sessionVersion) return {};

        // mantener role actualizado
        (token as any).role = dbUser.role;
      }

      return token;
    },

    async session({ session, token }: any) {
      if (token?.sub) {
        (session.user as any).id = token.sub;
        (session.user as any).email = token.email;
        (session as any).role = (token as any).role || "USER";
        (session as any).sessionVersion = (token as any).sv ?? 0;
      }
      return session;
    },
  },
};
