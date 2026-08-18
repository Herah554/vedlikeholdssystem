import "dotenv/config";
import { beskyttedeModeller } from "@/lib/tenant";

/**
 * Kontrollerer at flerklient-isoleringen dekker alle tabeller.
 *
 * Selve sjekken skjer når src/lib/tenant.ts lastes — den stopper med en
 * forklarende feil hvis en tabell verken har organizationId eller er ført
 * opp som en som arver tilhørighet. Dette skriptet finnes for å kunne kjøre
 * den kontrollen alene, uten å starte hele appen.
 *
 * Kjør med: npm run sjekk:isolering
 */

const modeller = beskyttedeModeller();

console.log(`✓ Flerklient-isoleringen dekker ${modeller.length} tabeller:\n`);
for (const m of modeller) console.log(`   ${m}`);
console.log(
  "\nAlle tabeller er enten dekket eller uttrykkelig unntatt fordi de arver\n" +
    "tilhørighet fra en forelder. Se src/lib/tenant.ts.",
);
