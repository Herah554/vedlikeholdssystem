import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { opprettDemobedrift } from "@/lib/demo";
import { NESTE_AVVIK_STATUS, APNE_AVVIK } from "@/lib/domene";
import { sjekkFil } from "@/lib/lagring";

/**
 * Kontrollerer avvikssystemet og reglene rundt vedlegg.
 *
 * Det som er lett å bygge nesten riktig her, er å la et avvik lukkes uten at
 * noen har skrevet ned hvorfor det skjedde. Da blir avviksregistrering en
 * logg over ting som gikk galt, og ikke et verktøy for å hindre at de skjer
 * igjen. Derfor prøves nettopp den veien.
 *
 * Kjør med: npm run sjekk:avvik
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
  // ── Filkontroll ───────────────────────────────────────────
  sjekk("Vanlig bilde godtas", sjekkFil("bilde.jpg", "image/jpeg", 500_000).ok, true);
  sjekk("PDF godtas", sjekkFil("skjema.pdf", "application/pdf", 90_000).ok, true);
  sjekk(
    "Kjørbar fil avvises selv om typen lyver",
    sjekkFil("virus.exe", "image/jpeg", 1000).ok,
    false,
  );
  sjekk("For stor fil avvises", sjekkFil("stor.jpg", "image/jpeg", 9_000_000).ok, false);
  sjekk("Tom fil avvises", sjekkFil("tom.jpg", "image/jpeg", 0).ok, false);

  // ── Statusreglene ─────────────────────────────────────────
  sjekk(
    "Et meldt avvik kan ikke lukkes direkte",
    NESTE_AVVIK_STATUS.MELDT.includes("LUKKET"),
    false,
  );
  sjekk(
    "Lukking krever at tiltak er iverksatt først",
    NESTE_AVVIK_STATUS.TILTAK_IVERKSATT.includes("LUKKET"),
    true,
  );
  sjekk(
    "Et lukket avvik kan åpnes igjen",
    NESTE_AVVIK_STATUS.LUKKET.includes("UNDER_BEHANDLING"),
    true,
  );

  // ── Mot en ekte demobedrift ───────────────────────────────
  const demo = await opprettDemobedrift();
  const db = dbForOrg(demo.organisasjonId);

  try {
    const antall = await db.deviation.count();
    sjekk("Demobedriften har avvik", antall > 0, true);

    const apne = await db.deviation.count({ where: { status: { in: APNE_AVVIK } } });
    sjekk("Noen står åpne", apne > 0, true);

    const kritisk = await db.deviation.count({
      where: { severity: "KRITISK", status: { in: APNE_AVVIK } },
    });
    sjekk("Minst ett er kritisk og åpent", kritisk > 0, true);

    const overFrist = await db.deviation.count({
      where: { status: { in: APNE_AVVIK }, deadline: { lt: new Date() } },
    });
    sjekk("Minst ett er over frist", overFrist > 0, true);

    const lukket = await db.deviation.findFirst({ where: { status: "LUKKET" } });
    sjekk("Lukkede avvik har årsak", Boolean(lukket?.rootCause), true);
    sjekk("Lukkede avvik har tiltak", Boolean(lukket?.correctiveAction), true);

    // Nummereringen skal fortsette der demoen slapp
    const teller = await prisma.counter.findFirst({
      where: { organizationId: demo.organisasjonId, name: "deviation" },
    });
    sjekk("Telleren står på antall avvik", teller?.value, antall);

    // ── Isolering ───────────────────────────────────────────
    const iAlt = await prisma.deviation.count();
    const synlig = await db.deviation.count();
    const rader = await db.deviation.findMany({ select: { organizationId: true } });
    const fremmede = rader.filter((r) => r.organizationId !== demo.organisasjonId);
    sjekk("Ingen avvik fra andre bedrifter er synlige", fremmede.length, 0);
    sjekk("Bedriften ser færre enn alle i basen", synlig <= iAlt, true);
  } finally {
    await prisma.purchaseOrder.deleteMany({
      where: { organizationId: demo.organisasjonId },
    });
    await prisma.organization.delete({ where: { id: demo.organisasjonId } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
