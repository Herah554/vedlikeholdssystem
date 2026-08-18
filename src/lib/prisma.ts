import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 kobler til databasen gjennom en driveradapter i stedet for en
// innebygd motor. Adapteren eier tilkoblingspoolen mot Postgres.
function nyKlient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL mangler. Kopier .env.example til .env og fyll inn " +
        "tilkoblingsstrengen til Postgres.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js laster om server-modulene ved hver endring i utviklingsmodus.
// Uten denne mellomlagringen ville hver omlasting åpne en ny tilkoblingspool,
// og Postgres ville gå tom for tilkoblinger etter noen minutter.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? nyKlient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
