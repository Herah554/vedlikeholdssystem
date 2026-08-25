import "dotenv/config";
import {
  FUNKSJON_IDER,
  PLANER,
  funksjonerFor,
  harFunksjon,
  lesUnntak,
  modulErKjopt,
} from "@/lib/planer";
import { kan, STANDARD_MATRISE } from "@/lib/rettigheter";

/**
 * Kontrollerer at planene faktisk stenger noe.
 *
 * Den farlige feilen her er at planen bare skjuler menyvalget, mens rollen
 * fortsatt slipper deg inn. Da ville en administrator hos kunden kunne gi seg
 * selv noe firmaet ikke betaler for ved å endre rettighetene sine.
 *
 * Kjør med: npm run sjekk:planer
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

function main() {
  // ── Planene inneholder det de skal ────────────────────────
  sjekk("Basis har ikke avvik", harFunksjon("BASIS", {}, "avvik"), false);
  sjekk("Pluss har avvik", harFunksjon("PLUSS", {}, "avvik"), true);
  sjekk("Pluss har ikke assistenten", harFunksjon("PLUSS", {}, "assistent"), false);
  sjekk("Pro har assistenten", harFunksjon("PRO", {}, "assistent"), true);
  sjekk(
    "Pro har alt",
    funksjonerFor("PRO", {}).size,
    FUNKSJON_IDER.length,
  );

  // ── Unntak overstyrer planen begge veier ──────────────────
  sjekk(
    "Assistenten kan slås på for en Basis-kunde",
    harFunksjon("BASIS", { assistent: true }, "assistent"),
    true,
  );
  sjekk(
    "Avvik kan slås av for en Pro-kunde",
    harFunksjon("PRO", { avvik: false }, "avvik"),
    false,
  );
  sjekk(
    "Uten unntak gjelder planen",
    harFunksjon("PLUSS", { assistent: undefined }, "avvik"),
    true,
  );

  // ── Modulene ──────────────────────────────────────────────
  sjekk(
    "Arbeidsordre er med i alle planer",
    modulErKjopt("BASIS", {}, "arbeidsordre"),
    true,
  );
  sjekk("Avviksmodulen er stengt på Basis", modulErKjopt("BASIS", {}, "avvik"), false);
  sjekk("Budsjett er stengt på Basis", modulErKjopt("BASIS", {}, "budsjett"), false);
  sjekk("Budsjett er åpent på Pluss", modulErKjopt("PLUSS", {}, "budsjett"), true);

  // ── Det viktigste: rollen kan ikke overstyre planen ───────
  // En administrator har alle rettigheter i matrisen. Klarer hen likevel å
  // komme inn i avviksmodulen på en Basis-plan, er hele planinndelingen bare
  // pynt.
  const rollenSierJa = kan("ADMIN", STANDARD_MATRISE, "avvik", "administrere");
  sjekk("Rollen alene sier ja for administrator", rollenSierJa, true);
  sjekk(
    "Men planen stenger den likevel",
    rollenSierJa && modulErKjopt("BASIS", {}, "avvik"),
    false,
  );

  // ── Vasking av lagrede unntak ─────────────────────────────
  sjekk("Tull i databasen forkastes", lesUnntak({ finnesikke: true }), {});
  sjekk("Feil datatype forkastes", lesUnntak({ avvik: "ja" }), {});
  sjekk("Gyldig unntak leses", lesUnntak({ avvik: false }), { avvik: false });
  sjekk("Null gir tomt", lesUnntak(null), {});
  sjekk("Liste gir tomt", lesUnntak([1, 2]), {});

  // ── Planene skal bygge på hverandre ───────────────────────
  const basis = funksjonerFor("BASIS", {});
  const pluss = funksjonerFor("PLUSS", {});
  const pro = funksjonerFor("PRO", {});
  sjekk(
    "Pluss inneholder alt Basis har",
    [...basis].every((f) => pluss.has(f)),
    true,
  );
  sjekk(
    "Pro inneholder alt Pluss har",
    [...pluss].every((f) => pro.has(f)),
    true,
  );
  sjekk("Hver plan har en beskrivelse", Object.values(PLANER).every((p) => p.beskrivelse.length > 10), true);

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
