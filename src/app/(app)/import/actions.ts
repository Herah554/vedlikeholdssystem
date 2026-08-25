"use server";

import { revalidatePath } from "next/cache";
import { krev, krevFunksjon, requireTenant } from "@/lib/auth";
import { lesTabell, MAKS_RADER } from "@/lib/import/les";
import { felterFor, gjettKobling, type Importtype } from "@/lib/import/felter";
import { importer, type Radfeil } from "@/lib/import/utfor";

/**
 * Import kjøres i to steg med samme fil.
 *
 * Første steg leser fila og foreslår hvilken kolonne som er hva. Andre steg
 * gjør jobben. Fila blir liggende i nettleseren mellom stegene og lastes opp
 * på nytt — det er billigere enn å sende hele tabellen fram og tilbake, og
 * serveren slipper å ta vare på noe mellom to forespørsler.
 */

/** Utstyr hører til anleggsmodulen, deler til reservedelsmodulen. */
function krevTilgang(
  session: Parameters<typeof krev>[0],
  type: Importtype,
): void {
  krevFunksjon(session, "import");
  krev(session, type === "utstyr" ? "anlegg" : "reservedeler", "administrere");
}

function lesType(formData: FormData): Importtype {
  return formData.get("type") === "deler" ? "deler" : "utstyr";
}

async function lesFil(formData: FormData) {
  const fil = formData.get("fil");
  if (!(fil instanceof File) || fil.size === 0) {
    throw new Error("Velg en fil først.");
  }
  return lesTabell(fil.name, new Uint8Array(await fil.arrayBuffer()));
}

export type Analyse =
  | {
      ok: true;
      filnavn: string;
      kolonner: string[];
      antallRader: number;
      forsteRader: string[][];
      kobling: Record<string, number>;
      forKort: boolean;
    }
  | { ok: false; feil: string };

/** Leser fila og foreslår en kobling mellom kolonner og felter. */
export async function analyser(
  _forrige: Analyse,
  formData: FormData,
): Promise<Analyse> {
  const { session } = await requireTenant();
  const type = lesType(formData);
  krevTilgang(session, type);

  try {
    const tabell = await lesFil(formData);

    if (tabell.kolonner.length === 0) {
      return { ok: false, feil: "Fant ingen kolonner i fila. Er den tom?" };
    }
    if (tabell.rader.length === 0) {
      return {
        ok: false,
        feil: "Fila har overskrifter, men ingen rader under.",
      };
    }

    const fil = formData.get("fil") as File;

    return {
      ok: true,
      filnavn: fil.name,
      kolonner: tabell.kolonner,
      antallRader: tabell.rader.length,
      forsteRader: tabell.rader.slice(0, 5),
      kobling: gjettKobling(tabell.kolonner, felterFor(type)),
      forKort: tabell.rader.length >= MAKS_RADER,
    };
  } catch (e) {
    return { ok: false, feil: e instanceof Error ? e.message : "Klarte ikke å lese fila." };
  }
}

export type Importsvar =
  | { ok: true; opprettet: number; oppdatert: number; feil: Radfeil[] }
  | { ok: false; feil: string };

/** Gjør importen med koblingen brukeren har bekreftet. */
export async function utforImport(
  _forrige: Importsvar,
  formData: FormData,
): Promise<Importsvar> {
  const { db, session } = await requireTenant();
  const type = lesType(formData);
  krevTilgang(session, type);

  let kobling: Record<string, number>;
  try {
    kobling = JSON.parse(String(formData.get("kobling") ?? "{}"));
  } catch {
    return { ok: false, feil: "Koblingen mellom kolonnene kunne ikke leses." };
  }

  // Påkrevde felter må være koblet. Uten dem har ingen rad noen sjanse.
  const mangler = felterFor(type)
    .filter((f) => f.påkrevd && kobling[f.id] === undefined)
    .map((f) => f.navn);

  if (mangler.length > 0) {
    return {
      ok: false,
      feil: `Velg hvilken kolonne som er ${mangler.join(" og ")}.`,
    };
  }

  try {
    const tabell = await lesFil(formData);
    const svar = await importer(type, db, session.organizationId, tabell, kobling);

    revalidatePath(type === "utstyr" ? "/anlegg" : "/reservedeler");

    return { ok: true, ...svar };
  } catch (e) {
    return {
      ok: false,
      feil: e instanceof Error ? e.message : "Importen stoppet underveis.",
    };
  }
}
