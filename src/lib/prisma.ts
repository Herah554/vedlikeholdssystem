import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

/**
 * Tilkoblingen til databasen.
 *
 * Prisma 7 kobler til gjennom en driveradapter i stedet for en innebygd motor,
 * og valget av adapter betyr mer enn det ser ut til når appen kjører
 * serverløst.
 *
 * En vanlig Postgres-tilkobling må sette opp TCP og TLS på nytt hver gang en
 * kald funksjon starter. Det er flere rundturer før den første spørringen i
 * det hele tatt sendes, og ligger databasen i en annen del av verden enn
 * serveren, koster hver av dem hundre millisekunder. Målt mot produksjon:
 * en side uten databasespørring svarte på 210 ms, en med én spørring på 300
 * til 530 ms.
 *
 * Neon sin egen driver snakker over WebSocket og slipper mesteparten av den
 * oppstarten. Den brukes bare når tilkoblingsstrengen faktisk peker på Neon —
 * lokalt, mot en vanlig Postgres, ville den ikke virke i det hele tatt.
 */
/**
 * Neon-driveren snakker over WebSocket.
 *
 * Nyere Node har WebSocket innebygd, men ikke alle kjøremiljøer gjør det, og
 * mangler den feiler hver eneste spørring — i produksjon, der man merker det
 * verst. Derfor settes den eksplisitt når den ikke finnes fra før.
 */
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

function erNeon(tilkobling: string): boolean {
  return /\.neon\.tech(\/|:|$)/.test(tilkobling) || tilkobling.includes(".neon.");
}

function nyKlient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL mangler. Kopier .env.example til .env og fyll inn " +
        "tilkoblingsstrengen til Postgres.",
    );
  }

  const adapter = erNeon(connectionString)
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
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
