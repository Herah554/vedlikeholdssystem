import { trygLenke } from "@/lib/lenker";
import { beleggForDag, type Person } from "@/lib/kapasitet";

/**
 * Kontrollerer lenkekontrollen og beleggsregnestykket.
 *
 * Hurtiglenkene er det ene stedet i systemet der én bruker skriver inn en
 * adresse som andre senere klikker på. Slipper «javascript:» gjennom, kjører
 * det kode i nettleseren til den som klikker, med hens rettigheter. Derfor
 * prøves ikke bare den åpenbare formen, men også dem som er ment å skli forbi
 * en kontroll: store bokstaver, mellomrom og linjeskift inne i protokollen.
 *
 * Beleggstallene står her fordi et tall som er feil er verre enn ingen tall —
 * planleggeren tror da at hen vet noe hen ikke vet.
 *
 * Kjør med: npm run sjekk:lenker
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

/** Sant hvis adressen ble avvist. */
function avvist(rå: string): boolean {
  return !trygLenke(rå).ok;
}

function main() {
  // ── Det som må avvises ────────────────────────────────────
  // Alle disse er skrivemåter nettlesere faktisk godtar som protokollen.
  const farlige = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\nscript:alert(1)",
    "java\tscript:alert(1)",
    "jAvAsCrIpT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ];
  for (const f of farlige) {
    sjekk(`«${f.replace(/[\n\t]/g, "·")}» avvises`, avvist(f), true);
  }

  // Ser ut som en sti, men nettleseren leser den som et annet nettsted
  sjekk("Protokoll-relativ «//example.com» avvises", avvist("//example.com"), true);
  sjekk("Tom adresse avvises", avvist("   "), true);

  // ── Det som skal slippe gjennom ───────────────────────────
  const intern = trygLenke("/reservedeler?filter=lav");
  sjekk("Intern sti godtas", intern.ok, true);
  sjekk(
    "Intern sti står urørt",
    intern.ok ? intern.url : null,
    "/reservedeler?filter=lav",
  );

  const bar = trygLenke("idvest.no");
  sjekk("Bart domene godtas", bar.ok, true);
  sjekk("Bart domene får https", bar.ok ? bar.url : null, "https://idvest.no/");

  sjekk("https godtas", trygLenke("https://example.com/katalog").ok, true);
  sjekk("http godtas", trygLenke("http://intranett.lokalt/side").ok, true);
  sjekk("Mellomrom rundt fjernes", trygLenke("  https://a.no  ").ok, true);

  // ── Belegg per person ─────────────────────────────────────
  const folk: Person[] = [
    { id: "u1", navn: "Jonas", timerPerDag: 7.5 },
    { id: "u2", navn: "Mona", timerPerDag: 7.5 },
    { id: "u3", navn: "Kari", timerPerDag: 4 },
  ];

  const dag = beleggForDag(
    [
      { assignedToId: "u1", estimatedHours: 3 },
      { assignedToId: "u1", estimatedHours: 2 },
      { assignedToId: "u2", estimatedHours: 9 },
      { assignedToId: null, estimatedHours: 4 },
      // Uten anslag. Skal telle null, ikke gjettes til noe.
      { assignedToId: "u3", estimatedHours: null },
    ],
    folk,
  );

  const finn = (id: string) => dag.personer.find((p) => p.brukerId === id);

  sjekk("Timer summeres per person", finn("u1")?.planlagt, 5);
  sjekk("Og trekkes fra dagen", finn("u1")?.igjen, 2.5);
  sjekk("Overbooking gir negativt tall", finn("u2")?.igjen, -1.5);
  sjekk("Jobb uten anslag teller null", finn("u3")?.planlagt, 0);
  sjekk("Deltid bruker sin egen dag", finn("u3")?.igjen, 4);
  sjekk("Ufordelte timer belaster ingen", dag.ufordelt, 4);

  // Alle er med, også de uten jobber. Det er hele nytten: den som er ledig
  // skal være synlig, ikke fraværende.
  sjekk("Alle på laget er med", dag.personer.length, 3);

  // Mest ledig først — planleggeren leter etter noen som kan ta en jobb til
  sjekk(
    "Mest ledig står øverst",
    dag.personer.map((p) => p.navn),
    ["Kari", "Jonas", "Mona"],
  );

  const tom = beleggForDag([], folk);
  sjekk("Tom dag gir full kapasitet", tom.personer[0].igjen, 7.5);
  sjekk("Og ingenting ufordelt", tom.ufordelt, 0);

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
