import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { opprettDemobedrift } from "@/lib/demo";
import { tomAlleTabeller } from "@/lib/bedrift";
import { beskyttedeModeller } from "@/lib/tenant";
import { eksporterOrg, rensRader, tilCelle } from "@/lib/eksport";

/**
 * Kontrollerer eksporten av en bedrifts data.
 *
 * To ting kan gå galt her, og begge er stille:
 *
 * En passordhash som blir med ut i et regneark kunden får. Derfor prøves det
 * uttrykkelig, og derfor er vakten positiv — den stopper på alt som *ser*
 * hemmelig ut, ikke bare på det noen har husket å liste opp.
 *
 * En tabell som mangler. En sikkerhetskopi uten arbeidsordrene er ikke en
 * halv sikkerhetskopi, den er ingen — og det oppdager man først den dagen
 * man trenger den.
 *
 * Kjør med: npm run sjekk:eksport
 */

let feil = 0;

function sjekk(hva: string, faktisk: unknown, forventet: unknown) {
  const ok = JSON.stringify(faktisk) === JSON.stringify(forventet);
  if (!ok) feil += 1;
  console.log(`${ok ? "✓" : "✗"} ${hva}`);
  if (!ok) {
    console.log(
      `    forventet ${JSON.stringify(forventet)}, fikk ${JSON.stringify(faktisk)}`,
    );
  }
}

async function main() {
  // ── Vakten mot hemmeligheter ──────────────────────────────
  sjekk(
    "Passordhashen fjernes fra brukere",
    rensRader("User", [{ id: "1", name: "Kari", passwordHash: "$2b$10$hemmelig" }]),
    [{ id: "1", name: "Kari" }],
  );

  // Et felt ingen har tatt stilling til skal stoppe eksporten, ikke skli med
  for (const felt of ["apiToken", "resetSecret", "nyPassordHash", "apiKey"]) {
    let stoppet = false;
    try {
      rensRader("WorkOrder", [{ id: "1", [felt]: "xyz" }]);
    } catch {
      stoppet = true;
    }
    sjekk(`Ukjent felt «${felt}» stopper eksporten`, stoppet, true);
  }

  sjekk(
    "Vanlige felter slipper gjennom",
    rensRader("WorkOrder", [{ id: "1", title: "Bytt lager", hours: 3 }]),
    [{ id: "1", title: "Bytt lager", hours: 3 }],
  );

  // ── Celleverdier ──────────────────────────────────────────
  sjekk("Dato blir ISO", tilCelle(new Date("2026-06-01T08:00:00Z")), "2026-06-01T08:00:00.000Z");
  sjekk("Null forblir null", tilCelle(null), null);
  sjekk("Tall forblir tall", tilCelle(42), 42);
  sjekk("Sann forblir sann", tilCelle(true), true);
  sjekk("Liste blir JSON", tilCelle([1, 2]), "[1,2]");
  sjekk("Objekt blir JSON", tilCelle({ a: 1 }), '{"a":1}');

  // ── Hele veien gjennom databasen ──────────────────────────
  const demo = await opprettDemobedrift();
  const nabo = await opprettDemobedrift();

  try {
    const ut = await eksporterOrg(demo.organisasjonId);

    sjekk("Eksporten navngir bedriften", ut.bedrift.navn, demo.navn);

    // Alle eierskapstabellene skal være med, også de tomme. En manglende
    // nøkkel og en tom liste betyr helt forskjellige ting den dagen noen
    // skal lese fila.
    const forventede = beskyttedeModeller().filter((m) => m !== "Organization");
    const mangler = forventede.filter((m) => !(m in ut.tabeller));
    sjekk("Ingen tabell mangler i eksporten", mangler, []);

    const medData = Object.entries(ut.tabeller).filter(([, r]) => r.length > 0);
    sjekk("Mange tabeller har innhold", medData.length > 10, true);
    sjekk("Arbeidsordrene er med", (ut.tabeller.WorkOrder ?? []).length > 0, true);
    sjekk("Brukerne er med", (ut.tabeller.User ?? []).length > 0, true);

    // Den viktigste: ingen hash noe sted i hele fila
    const hele = JSON.stringify(ut);
    sjekk("Ordet passwordHash finnes ikke i fila", hele.includes("passwordHash"), false);
    sjekk("Ingen bcrypt-hash lekket", /\$2[aby]\$\d\d\$/.test(hele), false);

    // ── Isolering ───────────────────────────────────────────
    // En eksport som drar med seg naboens data er verre enn ingen eksport.
    // Id og ikke e-post: alle demobedrifter bruker de samme adressene
    // («tekniker@demo.no»), så en e-post beviser ingenting om hvem raden
    // tilhører.
    const naboBrukere = await prisma.user.findMany({
      where: { organizationId: nabo.organisasjonId },
      select: { id: true },
    });
    const fremmed = naboBrukere.filter((b) => hele.includes(b.id));
    sjekk("Ingen av naboens rader er med", fremmed.length, 0);

    const alleOrgIder = new Set<string>();
    for (const rader of Object.values(ut.tabeller)) {
      for (const r of rader) {
        if (typeof r.organizationId === "string") alleOrgIder.add(r.organizationId);
      }
    }
    sjekk(
      "Alle rader tilhører bedriften som ble bedt om",
      [...alleOrgIder],
      [demo.organisasjonId],
    );
  } finally {
    for (const org of [demo, nabo]) {
      await tomAlleTabeller(org.organisasjonId);
      await prisma.organization
        .delete({ where: { id: org.organisasjonId } })
        .catch(() => {});
    }
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
