import { fyllUtPlassering, klemInn, pakk, type Plassert } from "@/lib/plassering";
import { STANDARD_OPPSETT, MALER } from "@/components/widget-katalog";

/**
 * Kontrollerer at widgets aldri havner oppå hverandre.
 *
 * Fri plassering står og faller på dette. Ligger to widgets i samme rute,
 * tegner nettleseren dem over hverandre, og dashbordet ser ødelagt ut uten at
 * brukeren skjønner hvorfor. Det er heller ikke noe man ser i en typesjekk.
 *
 * Kjør med: npm run sjekk:plassering
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

/** Teller hvor mange par som overlapper. Skal alltid være null. */
function overlapp(w: Plassert[]): number {
  let n = 0;
  for (let i = 0; i < w.length; i += 1) {
    for (let j = i + 1; j < w.length; j += 1) {
      const a = w[i];
      const b = w[j];
      if (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        n += 1;
      }
    }
  }
  return n;
}

/** Sant hvis noen widget stikker utenfor rutenettet. */
function utenfor(w: Plassert[]): number {
  return w.filter((el) => el.x < 0 || el.y < 0 || el.x + el.w > 4).length;
}

function lag(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Plassert {
  return { id, type: "apne-ordrer", x, y, w: w as 1, h: h as 1 };
}

function main() {
  // ── Klemming inn i rutenettet ─────────────────────────────
  sjekk("For bred blir fire", klemInn(lag("a", 0, 0, 9, 1)).w, 4);
  sjekk("For høy blir tre", klemInn(lag("a", 0, 0, 1, 9)).h, 3);
  sjekk("Negativ x blir null", klemInn(lag("a", -5, 0, 1, 1)).x, 0);
  sjekk(
    "Tre bred kan ikke begynne i kolonne tre",
    klemInn(lag("a", 3, 0, 3, 1)).x,
    1,
  );

  // ── Overlapp løses opp ────────────────────────────────────
  const oppa = pakk([lag("a", 0, 0, 2, 2), lag("b", 0, 0, 2, 2)]);
  sjekk("To i samme rute overlapper ikke etterpå", overlapp(oppa), 0);
  sjekk("Begge er fortsatt med", oppa.length, 2);

  // Den man slapp skal beholde plassen sin
  const forrang = pakk(
    [lag("gammel", 0, 0, 2, 2), lag("ny", 0, 0, 2, 2)],
    "ny",
  );
  sjekk(
    "Den som slippes vinner plassen",
    forrang.find((w) => w.id === "ny")?.y,
    0,
  );
  sjekk(
    "Den andre skyves ned",
    forrang.find((w) => w.id === "gammel")?.y,
    2,
  );

  // ── Hull fjernes ──────────────────────────────────────────
  const hull = pakk([lag("a", 0, 0, 1, 1), lag("b", 0, 7, 1, 1)]);
  sjekk("Hull trekkes sammen", hull.find((w) => w.id === "b")?.y, 1);

  // Men bare rett opp — noe ved siden av skal ikke flytte seg
  const side = pakk([lag("a", 0, 0, 1, 2), lag("b", 2, 0, 1, 1)]);
  sjekk("Widget ved siden av blir stående", side.find((w) => w.id === "b")?.x, 2);
  sjekk("Og på samme rad", side.find((w) => w.id === "b")?.y, 0);

  // ── Mange på én gang ──────────────────────────────────────
  const mange = pakk(
    Array.from({ length: 20 }, (_, i) => lag(`w${i}`, i % 4, 0, 2, 2)),
  );
  sjekk("Tjue overlappende blir ryddet", overlapp(mange), 0);
  sjekk("Ingen havner utenfor", utenfor(mange), 0);
  sjekk("Alle er med", mange.length, 20);

  // ── Gamle oppsett uten koordinater ────────────────────────
  const gammelt = [
    { id: "a", type: "apne-ordrer" as const, w: 1 as const, h: 1 as const },
    { id: "b", type: "apne-ordrer" as const, w: 1 as const, h: 1 as const },
    { id: "c", type: "apne-ordrer" as const, w: 2 as const, h: 2 as const },
    { id: "d", type: "apne-ordrer" as const, w: 2 as const, h: 2 as const },
  ];
  const fylt = fyllUtPlassering(gammelt);
  sjekk("Gammelt oppsett får koordinater", fylt.every((w) => typeof w.x === "number"), true);
  sjekk("Uten overlapp", overlapp(fylt), 0);
  sjekk("I samme rekkefølge som før", fylt.map((w) => w.id), ["a", "b", "c", "d"]);
  sjekk("De to første står på øverste rad", [fylt[0].y, fylt[1].y], [0, 0]);

  // ── Oppsettene som følger med ─────────────────────────────
  sjekk("Standardoppsettet overlapper ikke", overlapp(STANDARD_OPPSETT), 0);
  sjekk("Standardoppsettet er innenfor", utenfor(STANDARD_OPPSETT), 0);

  for (const mal of MALER) {
    sjekk(`Malen «${mal.navn}» overlapper ikke`, overlapp([...mal.oppsett]), 0);
    sjekk(`Malen «${mal.navn}» er innenfor`, utenfor([...mal.oppsett]), 0);
  }

  // ── Pakking skal være stabil ──────────────────────────────
  const enGang = pakk(STANDARD_OPPSETT);
  const toGanger = pakk(enGang);
  sjekk("Å pakke to ganger endrer ingenting", toGanger, enGang);

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
