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
/**
 * Vercel og Neon setter selv en «unpooled» streng ved siden av den vanlige,
 * og navnet følger prefikset man velger i integrasjonen. Vi leter etter de
 * vanligste navnene, slik at man slipper å kopiere strengen inn manuelt.
 */
const url =
  process.env["DIRECT_DATABASE_URL"] ||
  process.env["DATABASE_URL_UNPOOLED"] ||
  process.env["POSTGRES_URL_NON_POOLING"] ||
  process.env["DATABASE_URL"];

/**
 * Bare kommandoer som faktisk snakker med databasen trenger en tilkobling.
 *
 * «prisma generate» lager bare TypeScript-koden ut fra schemaet og skal kunne
 * kjøre uten database — det er nettopp det som skjer under installasjon hos
 * Vercel, før miljøvariablene er lest. Kastet vi her, ville bygget stoppe før
 * det kom i gang.
 */
const trengerDatabase = process.argv.some(
  (a) => a === "migrate" || a === "db" || a === "studio",
);

if (!url && trengerDatabase) {
  // Prisma sin egen melding — «The datasource.url property is required in your
  // Prisma config file» — sier ingenting om hva man faktisk mangler.
  throw new Error(
    "Fant ingen database å koble til.\n\n" +
      "Lokalt: kopier .env.example til .env og fyll inn DATABASE_URL.\n" +
      "I sky: legg til en Postgres-database og sett DATABASE_URL som " +
      "miljøvariabel.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
