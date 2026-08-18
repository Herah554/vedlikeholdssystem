import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Oppsett for Prisma sine kommandolinjeverktøy — migrasjoner og lignende.
 *
 * Appen selv kobler til gjennom en tilkoblingspool, som er riktig når mange
 * forespørsler kommer samtidig. Men migrasjoner tar en rådgivende lås i
 * Postgres, og en pool i transaksjonsmodus — slik Neon og Supabase kjører —
 * slipper ikke slike låser gjennom. Migrasjonen blir da stående og vente til
 * den gir opp.
 *
 * Derfor kjøres migrasjoner mot DIRECT_DATABASE_URL når den er satt. Lokalt,
 * der man kobler rett på Postgres, finnes den ikke, og da brukes DATABASE_URL.
 */
const url = process.env["DIRECT_DATABASE_URL"] || process.env["DATABASE_URL"];

if (!url) {
  // Prisma sin egen melding her er «The datasource.url property is required
  // in your Prisma config file», som ikke sier noe om hva man faktisk mangler.
  throw new Error(
    "Fant ingen database å koble til.\n\n" +
      "Lokalt: kopier .env.example til .env og fyll inn DATABASE_URL.\n" +
      "I sky: legg til en Postgres-database og sett DATABASE_URL som " +
      "miljøvariabel. Setter du også DIRECT_DATABASE_URL (den «unpooled» " +
      "strengen), brukes den til migrasjonene.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
