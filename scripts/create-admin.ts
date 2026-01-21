import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL; // pooled está bien para esto

if (!databaseUrl) {
  console.error("❌ Falta DATABASE_URL en .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("❌ Debes definir ADMIN_EMAIL y ADMIN_PASSWORD");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash(password!, 12);

  // create (y si ya existe, te avisa)
  const user = await prisma.user.create({
    data: {
      email: email!.toLowerCase().trim(),
      password: hash,
      role: "ADMIN",
      isBlocked: false,
      sessionVersion: 0,
    },
    select: { id: true, email: true, role: true },
  });

  console.log("✅ ADMIN creado:", user);
}

main()
  .catch(async (e: any) => {
    // Si el email ya existe, muestra mensaje claro
    if (String(e?.code) === "P2002") {
      console.error("❌ Ese email ya existe. Usa otro o dime y lo convertimos a ADMIN.");
    } else {
      console.error("❌ Error:", e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
