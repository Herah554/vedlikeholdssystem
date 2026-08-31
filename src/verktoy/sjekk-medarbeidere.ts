import "dotenv/config";
import {
  andel,
  arbeidsdager,
  leggTilTrend,
  malMedarbeidere,
  OMGANG_DAGER,
} from "@/lib/medarbeidere";
import { maalingTillater } from "@/lib/medarbeiderdata";
import type { Korrektiv, OrdreForMaling } from "@/lib/medarbeidere";
import { kanSession, type Session } from "@/lib/auth";
import { VALGBARE_ROLLER } from "@/lib/rettigheter";
import type { Role } from "@/generated/prisma/client";

/**
 * Kontrollerer målene som vises om navngitte personer.
 *
 * Dette er den ene rapporten i systemet der et feil tall får følger for en
 * person. Er «omganger» for høy, ser en tekniker ut til å gjøre dårlig arbeid
 * hen ikke har gjort; er «i tide» regnet på feil nevner, ser den som fikk
 * jobber uten frist ut som en som aldri rekker noe.
 *
 * Derfor prøves nettopp grensetilfellene: jobber uten anslag, uten frist,
 * uten utstyr, og en ny feil akkurat på dagen tretti.
 *
 * Kjør med: npm run sjekk:medarbeidere
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

const T0 = new Date("2026-06-01T08:00:00Z");
const dager = (n: number) => new Date(T0.getTime() + n * 86400_000);

function ordre(o: Partial<OrdreForMaling> & { id: string }): OrdreForMaling {
  return {
    assignedToId: "u1",
    assetId: null,
    priority: "NORMAL",
    estimatedHours: null,
    dueDate: null,
    completedAt: T0,
    resolution: null,
    ...o,
  };
}

function main() {
  const folk = [
    { id: "u1", navn: "Jonas" },
    { id: "u2", navn: "Mona" },
  ];

  // ── Grunnleggende telling ─────────────────────────────────
  const grunn = malMedarbeidere(
    [
      ordre({ id: "a" }),
      ordre({ id: "b" }),
      ordre({ id: "c", assignedToId: "u2" }),
      // Ikke fullført. Skal ikke telle med.
      ordre({ id: "d", completedAt: null }),
      // Ingen tildelt.
      ordre({ id: "e", assignedToId: null }),
    ],
    folk,
    new Map([
      ["u1", 12],
      ["u2", 4],
    ]),
    [],
  );

  const finn = (id: string) => grunn.find((m) => m.brukerId === id)!;

  sjekk("Bare fullførte jobber telles", finn("u1").utfort, 2);
  sjekk("Uten tildelt teller ikke på noen", finn("u2").utfort, 1);
  sjekk("Timer kommer fra timeføringen", finn("u1").timer, 12);
  sjekk(
    "Flest utført står øverst",
    grunn.map((m) => m.navn),
    ["Jonas", "Mona"],
  );

  // ── Tunge jobber ──────────────────────────────────────────
  // Uten dette ser den som tar de harde jobbene bare ut som treg.
  const tunge = malMedarbeidere(
    [
      ordre({ id: "a", priority: "KRITISK" }),
      ordre({ id: "b", priority: "HOY" }),
      ordre({ id: "c", priority: "NORMAL" }),
      ordre({ id: "d", priority: "LAV" }),
    ],
    [folk[0]],
    new Map(),
    [],
  );
  sjekk("Kritisk og høy regnes som tunge", tunge[0].tunge, 2);

  // ── Anslag ────────────────────────────────────────────────
  const anslag = malMedarbeidere(
    [
      ordre({ id: "a", estimatedHours: 4 }),
      ordre({ id: "b", estimatedHours: 6 }),
      // Uten anslag. Skal ikke trekke forholdstallet ned.
      ordre({ id: "c" }),
    ],
    [folk[0]],
    new Map([["u1", 15]]),
    [],
  );
  sjekk("Bare jobber med anslag telles i nevneren", anslag[0].medAnslag, 2);
  sjekk("Femten timer mot ti anslåtte gir 1,5", anslag[0].motAnslag, 1.5);

  const utenAnslag = malMedarbeidere(
    [ordre({ id: "a" })],
    [folk[0]],
    new Map([["u1", 9]]),
    [],
  );
  sjekk(
    "Uten anslag gir ingen påstand, ikke null",
    utenAnslag[0].motAnslag,
    null,
  );

  // ── Frist ─────────────────────────────────────────────────
  const frist = malMedarbeidere(
    [
      ordre({ id: "a", dueDate: dager(5), completedAt: dager(3) }),
      ordre({ id: "b", dueDate: dager(5), completedAt: dager(9) }),
      // Nøyaktig på fristen er i tide, ikke for sent
      ordre({ id: "c", dueDate: dager(5), completedAt: dager(5) }),
      // Uten frist. Skal verken telle som i tide eller som forsinket.
      ordre({ id: "d" }),
    ],
    [folk[0]],
    new Map(),
    [],
  );
  sjekk("Bare jobber med frist er med i nevneren", frist[0].medFrist, 3);
  sjekk("To av tre var i tide", frist[0].iTide, 2);

  // ── Dokumentasjon ─────────────────────────────────────────
  const dok = malMedarbeidere(
    [
      ordre({ id: "a", resolution: "Byttet lager og tetning." }),
      ordre({ id: "b", resolution: "   " }),
      ordre({ id: "c", resolution: null }),
    ],
    [folk[0]],
    new Map(),
    [],
  );
  sjekk("Blank tekst teller ikke som dokumentert", dok[0].dokumentert, 1);

  // ── Omganger ──────────────────────────────────────────────
  // Kom det en ny korrektiv jobb på samme utstyr rett etterpå, holdt ikke
  // reparasjonen. Dette er nærmeste ærlige mål på kvalitet.
  const korrektive: Korrektiv[] = [
    // Ny feil på maskin A etter ti dager — teller
    { id: "k1", assetId: "A", createdAt: dager(10) },
    // Maskin B: akkurat innenfor grensa
    { id: "k2", assetId: "B", createdAt: dager(OMGANG_DAGER) },
    // Maskin C: én dag for sent til å regnes som omgang
    { id: "k3", assetId: "C", createdAt: dager(OMGANG_DAGER + 1) },
    // Maskin D: kom før jobben ble fullført, altså ikke en omgang
    { id: "k4", assetId: "D", createdAt: dager(-5) },
  ];

  const omgang = malMedarbeidere(
    [
      ordre({ id: "a", assetId: "A" }),
      ordre({ id: "b", assetId: "B" }),
      ordre({ id: "c", assetId: "C" }),
      ordre({ id: "d", assetId: "D" }),
      // Uten utstyr kan ingen omgang måles
      ordre({ id: "e" }),
    ],
    [folk[0]],
    new Map(),
    korrektive,
  );

  sjekk("Bare jobber på utstyr er med i nevneren", omgang[0].medUtstyr, 4);
  sjekk("To av dem fikk ny feil innen fristen", omgang[0].omganger, 2);

  // Jobben skal ikke telle seg selv som sin egen omgang
  const segSelv = malMedarbeidere(
    [ordre({ id: "k9", assetId: "A", completedAt: dager(0) })],
    [folk[0]],
    new Map(),
    [{ id: "k9", assetId: "A", createdAt: dager(2) }],
  );
  sjekk("En jobb er ikke sin egen omgang", segSelv[0].omganger, 0);

  // ── Arbeidsdager ──────────────────────────────────────────
  // Én uke, mandag til søndag, gir fem. Er denne feil, blir skrutiden
  // feil for alle.
  sjekk("Hele uka gir fem", arbeidsdager(new Date("2026-06-01"), new Date("2026-06-07")), 5);
  sjekk("Bare helga gir null", arbeidsdager(new Date("2026-06-06"), new Date("2026-06-07")), 0);
  sjekk("Én ukedag gir én", arbeidsdager(new Date("2026-06-03"), new Date("2026-06-03")), 1);
  sjekk("To uker gir ti", arbeidsdager(new Date("2026-06-01"), new Date("2026-06-14")), 10);

  // ── Skrutid ───────────────────────────────────────────────
  const skrutid = malMedarbeidere(
    [ordre({ id: "a" })],
    [{ id: "u1", navn: "Jonas", timerPerDag: 7.5 }],
    new Map([["u1", 30]]),
    [],
    20,
  );
  sjekk("Tilgjengelig tid er dager ganger timer", skrutid[0].tilgjengelig, 150);
  sjekk("Tretti av hundreogfemti er en femtedel", skrutid[0].skrutid, 0.2);

  // Uten arbeidsdager kan skrutid ikke regnes, og skal ikke påstås
  const utenDager = malMedarbeidere(
    [ordre({ id: "a" })],
    [{ id: "u1", navn: "Jonas", timerPerDag: 7.5 }],
    new Map([["u1", 30]]),
    [],
  );
  sjekk("Uten periode gir ingen skrutid", utenDager[0].skrutid, null);

  // ── Trend ─────────────────────────────────────────────────
  const naaTall = malMedarbeidere(
    [ordre({ id: "a" }), ordre({ id: "b" }), ordre({ id: "c", assignedToId: "u2" })],
    folk,
    new Map([["u1", 10]]),
    [],
  );
  const forTall = malMedarbeidere(
    [ordre({ id: "x" })],
    folk,
    new Map([["u1", 4]]),
    [],
  );
  const trend = leggTilTrend(naaTall, forTall);
  const jonas = trend.find((m) => m.brukerId === "u1")!;
  const mona = trend.find((m) => m.brukerId === "u2")!;

  sjekk("Forrige periode følger med", jonas.forrige, { utfort: 1, timer: 4 });
  sjekk("To mot én er framgang", jonas.utfort - jonas.forrige!.utfort, 1);
  // Den som ikke fantes forrige periode skal ikke få en pil
  sjekk("Uten forrige periode ingen påstand", mona.forrige, null);

  // ── Innstillingen i bedriften ─────────────────────────────
  // Skillet går mellom å se sine egne tall og at andre ser dem.
  sjekk("Av: ingen ser noe", maalingTillater("AV"), { egne: false, andres: false });
  sjekk("Egne: bare sine egne", maalingTillater("EGNE"), { egne: true, andres: false });
  sjekk("Alle: også andres", maalingTillater("ALLE"), { egne: true, andres: true });

  // ── Hvem som slipper inn ──────────────────────────────────
  // Dette er tall om navngitte kolleger. Nivået «administrere» på
  // arbeidsordre er det rettighetsoppsettet kaller «Godkjenne, tildele og
  // lukke» — de som leder arbeidet. Blir sperren feil, ligger
  // personopplysninger åpent for alle som kan se rapporter.
  const okt = (rolle: Role): Session => ({
    userId: "u",
    organizationId: "o",
    organizationName: "Firma",
    name: "Navn",
    email: "e@f.no",
    role: rolle,
    plan: "PRO",
  });

  const slipperInn = (rolle: Role) =>
    kanSession(okt(rolle), "arbeidsordre", "administrere");

  sjekk("Administrator slipper inn", slipperInn("ADMIN"), true);
  sjekk("Leder slipper inn", slipperInn("LEDER"), true);
  sjekk("Planlegger slipper inn", slipperInn("PLANLEGGER"), true);
  sjekk("Tekniker slipper ikke inn", slipperInn("TEKNIKER"), false);
  sjekk("Delelager slipper ikke inn", slipperInn("DELELAGER"), false);
  sjekk("Gjest slipper ikke inn", slipperInn("GJEST"), false);

  // Kommer det en ny rolle, skal den ikke få tilgang ved et uhell
  const uventet = VALGBARE_ROLLER.filter(
    (r) => slipperInn(r) && !["LEDER", "PLANLEGGER"].includes(r),
  );
  sjekk("Ingen uventet rolle har fått tilgang", uventet, []);

  // ── Andel ─────────────────────────────────────────────────
  sjekk("Andel regnes ut", andel(3, 4), 75);
  sjekk("Deling på null gir ingen påstand", andel(0, 0), null);
  sjekk("Null av fem er null prosent, ikke ingenting", andel(0, 5), 0);

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
