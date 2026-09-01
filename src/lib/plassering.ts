import {
  MAKS_BREDDE,
  MAKS_HOYDE,
  type Bredde,
  type Hoyde,
  type WidgetOppsett,
} from "@/components/widget-katalog";

/**
 * Hvor widgetene ligger i rutenettet.
 *
 * Før bestemte rekkefølgen i lista plasseringen. Det holder til å bytte om på
 * ting, men ikke til å legge én widget i høyre hjørne og la det stå tomt til
 * venstre. Nå har hver widget en faktisk rute — x fra venstre, y nedover — og
 * da må systemet håndtere at to kan havne oppå hverandre.
 *
 * Regelen er enkel og forutsigbar: en widget blir liggende der den slippes.
 * Ligger noe annet i veien, skyves det nedover — men ingenting trekkes oppover
 * av seg selv.
 *
 * Første utgave trakk alt så langt opp det kom, for å unngå hull. Det var feil
 * to ganger. Widgeten man nettopp flyttet ble behandlet først, og siden
 * rutenettet da var tomt, havnet den alltid øverst — man måtte dra alt på nytt
 * hver gang man gjorde noe bredere. Og selv uten den feilen kjempet opptrekket
 * mot hele poenget: skal plasseringen være fri, må et tomrom man har laget med
 * vilje få lov til å bli stående.
 */

/** Flest rader et dashbord kan strekke seg over. */
const MAKS_RADER = 40;

export type Plassert = WidgetOppsett & { x: number; y: number };

function kolliderer(a: Plassert, b: Plassert): boolean {
  return (
    a.id !== b.id &&
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Klemmer en widget inn i rutenettet, uansett hva den påstår om seg selv. */
export function klemInn(w: Plassert): Plassert {
  const bredde = Math.min(MAKS_BREDDE, Math.max(1, Math.round(w.w))) as Bredde;
  const hoyde = Math.min(MAKS_HOYDE, Math.max(1, Math.round(w.h))) as Hoyde;

  return {
    ...w,
    w: bredde,
    h: hoyde,
    // En widget som er tre bred kan ikke begynne i kolonne tre av fire
    x: Math.min(MAKS_BREDDE - bredde, Math.max(0, Math.round(w.x))),
    // Taket hindrer at en ødelagt lagret verdi lager tusen tomme rader
    y: Math.min(MAKS_RADER, Math.max(0, Math.round(w.y))),
  };
}

/**
 * Løser opp overlapp og fjerner hull.
 *
 * `forrang` er widgeten brukeren nettopp slapp. Den beholder plassen sin, og
 * de andre viker. Uten det ville den man akkurat dro selv blitt dyttet vekk,
 * og dragingen ville føltes som om systemet kranglet imot.
 */
export function pakk(widgets: Plassert[], forrang?: string): Plassert[] {
  const rekkefolge = [...widgets]
    .map(klemInn)
    .sort((a, b) => {
      if (a.id === forrang) return -1;
      if (b.id === forrang) return 1;
      return a.y - b.y || a.x - b.x;
    });

  const plassert: Plassert[] = [];

  for (const el of rekkefolge) {
    // Den man nettopp slapp legges nøyaktig der den ble sluppet. Den er
    // først i rekka, så den møter aldri noe å kollidere med.
    if (el.id === forrang) {
      plassert.push(el);
      continue;
    }

    let y = el.y;

    // Skyv nedover til den ikke lenger ligger oppå noe. Oppover skjer
    // ingenting — et tomrom er noe brukeren har laget med vilje.
    while (
      y < MAKS_RADER &&
      plassert.some((p) => kolliderer({ ...el, y }, p))
    ) {
      y += 1;
    }

    plassert.push({ ...el, y });
  }

  return plassert.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Gir plassering til widgets som mangler den.
 *
 * Oppsett lagret før dette fantes har bare rekkefølge. De legges ut fra
 * venstre mot høyre, med linjeskift når raden er full — akkurat slik de så ut
 * før. Ingen skal oppleve at dashbordet stokker om seg selv ved en
 * oppgradering.
 */
export function fyllUtPlassering(
  // Omit, ikke &: WidgetOppsett krever x og y, så et snitt-type ville krevd
  // dem også — og da kunne funksjonen aldri fått et gammelt oppsett som
  // mangler dem, som er hele grunnen til at den finnes.
  widgets: (Omit<WidgetOppsett, "x" | "y"> & { x?: number; y?: number })[],
): Plassert[] {
  const harAlle = widgets.every(
    (w) => typeof w.x === "number" && typeof w.y === "number",
  );

  if (harAlle) return pakk(widgets as Plassert[]);

  let x = 0;
  let y = 0;
  let radHoyde = 1;

  const flyt = widgets.map((w) => {
    const bredde = Math.min(MAKS_BREDDE, Math.max(1, w.w));
    const hoyde = Math.max(1, w.h);

    if (x + bredde > MAKS_BREDDE) {
      x = 0;
      // Neste rad begynner under den høyeste widgeten i den forrige. Hopper
      // man bare én rad, legger radene seg oppå hverandre og opprydningen må
      // flytte alt etterpå — med et resultat ingen har bedt om.
      y += radHoyde;
      radHoyde = hoyde;
    } else {
      radHoyde = Math.max(radHoyde, hoyde);
    }

    const plass = { ...w, x, y } as Plassert;
    x += bredde;

    return plass;
  });

  return pakk(flyt);
}

/**
 * Hvilken rute et punkt peker på.
 *
 * Rutenettet måles der og da fordi bredden avhenger av vinduet. Det er billig
 * nok når det skjer én gang per draging og ikke per musebevegelse.
 */
export function ruteFraPunkt(
  rutenett: DOMRect,
  kolonner: number,
  radHoyde: number,
  mellomrom: number,
  klientX: number,
  klientY: number,
): { x: number; y: number } {
  const kolonneBredde = (rutenett.width + mellomrom) / kolonner;

  return {
    x: Math.max(
      0,
      Math.min(kolonner - 1, Math.floor((klientX - rutenett.left) / kolonneBredde)),
    ),
    y: Math.max(0, Math.floor((klientY - rutenett.top) / (radHoyde + mellomrom))),
  };
}

/**
 * Hvilken mal oppsettet svarer til, hvis noen.
 *
 * Sammenlikningen går på hva man faktisk ser — type, plass og størrelse —
 * og ikke på id-ene. En mal er «i bruk» bare når alt står nøyaktig der malen
 * satte det; flytter man én widget, er det ikke lenger malen, og da skal
 * knappen heller ikke påstå det.
 */
export function finnMal(
  oppsett: readonly WidgetOppsett[],
  maler: readonly { id: string; oppsett: readonly WidgetOppsett[] }[],
): string | undefined {
  const fingeravtrykk = (w: readonly WidgetOppsett[]) =>
    w
      .map((x) => `${x.type}:${x.x}:${x.y}:${x.w}:${x.h}`)
      .sort()
      .join("|");

  const mitt = fingeravtrykk(oppsett);
  return maler.find((m) => fingeravtrykk(m.oppsett) === mitt)?.id;
}
