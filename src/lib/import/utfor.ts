import type { TenantDb } from "@/lib/tenant";
import type { AssetType } from "@/generated/prisma/client";
import { tilTall, type Importtype } from "./felter";
import type { Tabell } from "./les";

/**
 * Selve importen.
 *
 * Grunnregelen er at en import skal kunne kjøres to ganger uten å lage rot.
 * Kunden retter en skrivefeil i regnearket og laster opp på nytt — da skal
 * raden oppdateres, ikke bli en ny enhet ved siden av den gamle. Derfor er
 * koden og delenummeret nøkkelen, ikke rekkefølgen i fila.
 *
 * Rader som ikke går gjennom stopper ikke resten. Et regneark med 400 linjer
 * har nesten alltid to som er rare, og å avvise hele fila for det ville gjort
 * importen ubrukelig.
 */

export type Radfeil = { rad: number; melding: string };

export type Importresultat = {
  opprettet: number;
  oppdatert: number;
  feil: Radfeil[];
};

/** Henter en celle ut fra koblingen brukeren bekreftet. */
function celle(
  rad: string[],
  kobling: Record<string, number>,
  felt: string,
): string {
  const i = kobling[felt];
  if (i === undefined) return "";
  return (rad[i] ?? "").trim();
}

const TYPER: Record<string, AssetType> = {
  anlegg: "ANLEGG",
  system: "SYSTEM",
  utstyr: "UTSTYR",
  komponent: "KOMPONENT",
  plant: "ANLEGG",
  equipment: "UTSTYR",
  component: "KOMPONENT",
};

export async function importerUtstyr(
  db: TenantDb,
  organizationId: string,
  tabell: Tabell,
  kobling: Record<string, number>,
): Promise<Importresultat> {
  const feil: Radfeil[] = [];

  type Rad = {
    linje: number;
    code: string;
    parentCode: string;
    data: {
      name: string;
      type: AssetType;
      location: string | null;
      manufacturer: string | null;
      modelNumber: string | null;
      serialNumber: string | null;
      criticality: number;
      runningHours: number;
    };
  };

  const gyldige: Rad[] = [];
  const sett = new Set<string>();

  tabell.rader.forEach((rad, i) => {
    // +2 fordi brukeren teller fra 1 og overskriftene er linje 1
    const linje = i + 2;

    const code = celle(rad, kobling, "code");
    const name = celle(rad, kobling, "name");

    if (!code && !name) return; // helt tom linje, ikke verdt en feilmelding
    if (!code) {
      feil.push({ rad: linje, melding: "Mangler kode." });
      return;
    }
    if (!name) {
      feil.push({ rad: linje, melding: `${code}: mangler navn.` });
      return;
    }
    if (sett.has(code)) {
      feil.push({ rad: linje, melding: `${code} finnes flere ganger i fila.` });
      return;
    }
    sett.add(code);

    const kritikk = tilTall(celle(rad, kobling, "criticality"));

    gyldige.push({
      linje,
      code,
      parentCode: celle(rad, kobling, "parentCode"),
      data: {
        name,
        type: TYPER[celle(rad, kobling, "type").toLowerCase()] ?? "UTSTYR",
        location: celle(rad, kobling, "location") || null,
        manufacturer: celle(rad, kobling, "manufacturer") || null,
        modelNumber: celle(rad, kobling, "modelNumber") || null,
        serialNumber: celle(rad, kobling, "serialNumber") || null,
        criticality: kritikk ? Math.min(5, Math.max(1, Math.round(kritikk))) : 3,
        runningHours: tilTall(celle(rad, kobling, "runningHours")) ?? 0,
      },
    });
  });

  // Ett oppslag for alt som finnes fra før, i stedet for ett per rad
  const fraFor = await db.asset.findMany({
    where: { code: { in: gyldige.map((r) => r.code) } },
    select: { id: true, code: true },
  });
  const finnes = new Map(fraFor.map((a) => [a.code, a.id]));

  let opprettet = 0;
  let oppdatert = 0;

  for (const rad of gyldige) {
    const id = finnes.get(rad.code);
    try {
      if (id) {
        await db.asset.update({ where: { id }, data: rad.data });
        oppdatert += 1;
      } else {
        const ny = await db.asset.create({
          data: { organizationId, code: rad.code, ...rad.data },
        });
        finnes.set(rad.code, ny.id);
        opprettet += 1;
      }
    } catch {
      feil.push({ rad: rad.linje, melding: `${rad.code} kunne ikke lagres.` });
    }
  }

  await kobleHierarki(db, gyldige, finnes, feil);

  return { opprettet, oppdatert, feil };
}

/**
 * Setter forelder og regner ut stien i treet.
 *
 * Dette må skje etter at alt er opprettet. En rad kan peke på en forelder som
 * står lenger ned i fila, og da finnes den ikke ennå når raden leses.
 *
 * Stien lagres som «/id/id/id» slik at en spørring på et helt deltre blir ett
 * oppslag i stedet for en runde per nivå.
 */
async function kobleHierarki(
  db: TenantDb,
  rader: { linje: number; code: string; parentCode: string }[],
  finnes: Map<string, string>,
  feil: Radfeil[],
): Promise<void> {
  const forelderAv = new Map<string, string>();

  for (const rad of rader) {
    if (!rad.parentCode) continue;

    if (rad.parentCode === rad.code) {
      feil.push({ rad: rad.linje, melding: `${rad.code} peker på seg selv.` });
      continue;
    }

    if (!finnes.has(rad.parentCode)) {
      feil.push({
        rad: rad.linje,
        melding: `${rad.code}: fant ikke «${rad.parentCode}» å legge den under.`,
      });
      continue;
    }

    forelderAv.set(rad.code, rad.parentCode);
  }

  /** Går oppover til roten. Returnerer null hvis kjeden går i ring. */
  function kjede(code: string): string[] | null {
    const sti: string[] = [];
    const besokt = new Set<string>();
    let n: string | undefined = code;

    while (n) {
      if (besokt.has(n)) return null;
      besokt.add(n);
      sti.unshift(n);
      n = forelderAv.get(n);
    }

    return sti;
  }

  for (const rad of rader) {
    const sti = kjede(rad.code);

    if (!sti) {
      feil.push({
        rad: rad.linje,
        melding: `${rad.code} inngår i en løkke — noe ligger under seg selv.`,
      });
      continue;
    }

    const id = finnes.get(rad.code);
    if (!id) continue;

    const forelderKode = forelderAv.get(rad.code);

    await db.asset.update({
      where: { id },
      data: {
        parentId: forelderKode ? (finnes.get(forelderKode) ?? null) : null,
        depth: sti.length - 1,
        path: `/${sti.map((k) => finnes.get(k)).join("/")}`,
      },
    });
  }
}

export async function importerDeler(
  db: TenantDb,
  organizationId: string,
  tabell: Tabell,
  kobling: Record<string, number>,
): Promise<Importresultat> {
  const feil: Radfeil[] = [];

  // Leverandørene slås opp én gang. Står det et navn som ikke finnes,
  // opprettes det — ellers ville halve fila blitt liggende uten kobling.
  const leverandorer = new Map<string, string>();
  for (const l of await db.supplier.findMany({ select: { id: true, name: true } })) {
    leverandorer.set(l.name.toLowerCase(), l.id);
  }

  const gyldige: {
    linje: number;
    number: string;
    data: Record<string, unknown>;
  }[] = [];
  const sett = new Set<string>();

  for (const [i, rad] of tabell.rader.entries()) {
    const linje = i + 2;

    const nummer = celle(rad, kobling, "number");
    const navn = celle(rad, kobling, "name");

    if (!nummer && !navn) continue;
    if (!nummer) {
      feil.push({ rad: linje, melding: "Mangler delenummer." });
      continue;
    }
    if (!navn) {
      feil.push({ rad: linje, melding: `${nummer}: mangler navn.` });
      continue;
    }
    if (sett.has(nummer)) {
      feil.push({ rad: linje, melding: `${nummer} finnes flere ganger i fila.` });
      continue;
    }
    sett.add(nummer);

    const levNavn = celle(rad, kobling, "supplierName");
    let supplierId: string | null = null;

    if (levNavn) {
      const kjent = leverandorer.get(levNavn.toLowerCase());
      if (kjent) {
        supplierId = kjent;
      } else {
        const ny = await db.supplier.create({
          data: { organizationId, name: levNavn },
        });
        leverandorer.set(levNavn.toLowerCase(), ny.id);
        supplierId = ny.id;
      }
    }

    const maks = tilTall(celle(rad, kobling, "maxStock"));
    const ledetid = tilTall(celle(rad, kobling, "leadTimeDays"));

    gyldige.push({
      linje,
      number: nummer,
      data: {
        name: navn,
        manufacturer: celle(rad, kobling, "manufacturer") || null,
        manufacturerPartNo: celle(rad, kobling, "manufacturerPartNo") || null,
        unit: celle(rad, kobling, "unit") || "stk",
        unitCost: tilTall(celle(rad, kobling, "unitCost")) ?? 0,
        quantityOnHand: tilTall(celle(rad, kobling, "quantityOnHand")) ?? 0,
        minStock: tilTall(celle(rad, kobling, "minStock")) ?? 0,
        maxStock: maks,
        binLocation: celle(rad, kobling, "binLocation") || null,
        supplierId,
        leadTimeDays: ledetid ? Math.round(ledetid) : null,
      },
    });
  }

  const fraFor = await db.part.findMany({
    where: { number: { in: gyldige.map((r) => r.number) } },
    select: { id: true, number: true },
  });
  const finnes = new Map(fraFor.map((p) => [p.number, p.id]));

  let opprettet = 0;
  let oppdatert = 0;

  for (const rad of gyldige) {
    const id = finnes.get(rad.number);
    try {
      if (id) {
        await db.part.update({ where: { id }, data: rad.data });
        oppdatert += 1;
      } else {
        await db.part.create({
          data: { organizationId, number: rad.number, ...rad.data } as never,
        });
        opprettet += 1;
      }
    } catch {
      feil.push({ rad: rad.linje, melding: `${rad.number} kunne ikke lagres.` });
    }
  }

  return { opprettet, oppdatert, feil };
}

export function importer(
  type: Importtype,
  db: TenantDb,
  organizationId: string,
  tabell: Tabell,
  kobling: Record<string, number>,
): Promise<Importresultat> {
  return type === "utstyr"
    ? importerUtstyr(db, organizationId, tabell, kobling)
    : importerDeler(db, organizationId, tabell, kobling);
}
