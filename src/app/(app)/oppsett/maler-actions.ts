"use server";

import { revalidatePath } from "next/cache";
import { assertRole, requireTenant } from "@/lib/auth";
import { lesFelter, SJA_MAL, type Felt } from "@/lib/skjema";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/**
 * Skjemamaler.
 *
 * Malen kan endres når som helst, og det er meningen. Utfylte skjemaer tar en
 * kopi av feltene ved utfylling, så en endring her rører aldri et SJA som
 * allerede er signert — se src/lib/skjema.ts.
 *
 * Versjonsnummeret økes ved hver endring, slik at et utfylt skjema kan si
 * hvilken utgave det ble fylt ut fra.
 */

export async function opprettMal(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const navn = String(formData.get("name") ?? "").trim();
  if (navn.length < 2) return { ok: false, feil: "Skriv inn et navn på malen." };

  const scope = String(formData.get("scope") ?? "ARBEIDSORDRE");
  if (!["ARBEIDSORDRE", "AVVIK", "BEGGE"].includes(scope)) {
    return { ok: false, feil: "Ukjent bruksområde." };
  }

  // Et tomt skjema er vanskelig å komme i gang med. Den som vil ha en SJA
  // får forslaget ferdig utfylt og kan stryke det som ikke passer.
  const fraSja = formData.get("sja") === "ja";

  await db.formTemplate.create({
    data: {
      organizationId: session.organizationId,
      name: navn,
      description: String(formData.get("description") ?? "").trim() || null,
      scope: scope as "ARBEIDSORDRE" | "AVVIK" | "BEGGE",
      fields: fraSja ? (SJA_MAL as unknown as object[]) : [],
    },
  });

  revalidatePath("/oppsett");
  return { ok: true, melding: `${navn} er opprettet.` };
}

/**
 * Lagrer feltene i malen.
 *
 * Hele lista skrives om. Feltenes id-er beholdes der de finnes fra før, slik
 * at et utkast som er påbegynt fra en tidligere versjon fortsatt kjenner igjen
 * svarene sine der spørsmålet er uendret.
 */
export async function lagreMalFelter(
  malId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  let felter: Felt[];
  try {
    felter = lesFelter(JSON.parse(String(formData.get("felter") ?? "[]")));
  } catch {
    return { ok: false, feil: "Feltene kunne ikke leses." };
  }

  if (felter.length === 0) {
    return { ok: false, feil: "Malen må ha minst ett felt." };
  }

  const mal = await db.formTemplate.findFirst({
    where: { id: malId },
    select: { version: true },
  });
  if (!mal) return { ok: false, feil: "Fant ikke malen." };

  await db.formTemplate.updateMany({
    where: { id: malId },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || null,
      fields: felter as unknown as object[],
      version: mal.version + 1,
    },
  });

  revalidatePath("/oppsett");
  return {
    ok: true,
    melding: `Lagret som versjon ${mal.version + 1}. Skjemaer som allerede er fylt ut står urørt.`,
  };
}

/** Tar malen ut av bruk. Utfylte skjemaer blir stående. */
export async function settMalAktiv(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  await db.formTemplate.updateMany({
    where: { id: String(formData.get("id") ?? "") },
    data: { isActive: formData.get("aktiv") === "ja" },
  });

  revalidatePath("/oppsett");
}

/**
 * Sletter en mal som aldri er tatt i bruk.
 *
 * Er den brukt, blir den stående. Utfylte skjemaer har sin egen kopi av
 * feltene og ville overlevd, men lista over maler er også en oversikt over
 * hva firmaet har brukt — og den skal ikke få hull.
 */
export async function slettMal(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const id = String(formData.get("id") ?? "");

  const brukt = await db.formResponse.count({ where: { templateId: id } });
  if (brukt > 0) {
    throw new Error(
      `Malen er brukt på ${brukt} skjema og kan ikke slettes. Ta den ut av bruk i stedet.`,
    );
  }

  await db.formTemplate.deleteMany({ where: { id } });
  revalidatePath("/oppsett");
}
