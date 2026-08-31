"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole, requireTenant } from "@/lib/auth";
import {
  MODUL_IDER,
  NIVAER,
  STANDARD_MATRISE,
  VALGBARE_ROLLER,
  type Matrise,
  type Modul,
  type Nivaa,
} from "@/lib/rettigheter";
import { PersonMaling, type Role } from "@/generated/prisma/client";
import { LISTER, TONE_IDER } from "@/lib/lister";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/**
 * Oppsettsiden er administratorens. Hver handling sjekker det selv — en side
 * som ikke vises i menyen er ingen sperre for den som skriver adressen selv,
 * eller sender skjemaet rett til serveren.
 */

// ─── Rettigheter ──────────────────────────────────────────────

/**
 * Lagrer hele matrisen på nytt.
 *
 * Skjemaet sender én verdi per rute, med navnet «ROLLE:modul». Alt som ikke
 * er en kjent rolle, en kjent modul og et kjent nivå blir forkastet, slik at
 * en manipulert forespørsel ikke kan legge inn rettigheter som ikke finnes.
 */
export async function lagreRettigheter(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const ny: Matrise = {};

  for (const rolle of VALGBARE_ROLLER) {
    const rad: Partial<Record<Modul, Nivaa>> = {};

    for (const modul of MODUL_IDER) {
      const verdi = String(formData.get(`${rolle}:${modul}`) ?? "");
      if (NIVAER.includes(verdi as Nivaa)) rad[modul] = verdi as Nivaa;
      // Alt annet, «ingen» inkludert, betyr stengt og lagres ikke.
    }

    ny[rolle] = rad;
  }

  await db.organization.update({
    where: { id: session.organizationId },
    data: { permissions: ny },
  });

  revalidatePath("/", "layout");
  return { ok: true, melding: "Rettighetene er lagret." };
}

/** Setter alt tilbake til utgangspunktet. */
export async function tilbakestillRettigheter(): Promise<void> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  await db.organization.update({
    where: { id: session.organizationId },
    data: { permissions: STANDARD_MATRISE },
  });

  revalidatePath("/", "layout");
}

// ─── Årsaker ──────────────────────────────────────────────────

const aarsak = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Koden må ha minst to tegn.")
    .max(30, "Koden er for lang.")
    .regex(
      /^[A-ZÆØÅ0-9_-]+$/,
      "Koden kan bare ha store bokstaver, tall, bindestrek og understrek.",
    ),
  name: z.string().trim().min(2, "Skriv inn hva årsaken heter."),
  description: z.string().trim().optional(),
});

/**
 * Legger til en årsak firmaet kan velge mellom på en arbeidsordre.
 *
 * Koden er det som havner på ordren og i statistikken, og kan ikke endres
 * etterpå — da ville gammel historikk plutselig betydd noe annet.
 */
export async function leggTilAarsak(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const parsed = aarsak.safeParse({
    code: String(formData.get("code") ?? "").toUpperCase(),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }

  const finnes = await db.failureCause.findFirst({
    where: { code: parsed.data.code },
    select: { id: true },
  });

  if (finnes) {
    return { ok: false, feil: `Koden ${parsed.data.code} er allerede i bruk.` };
  }

  const antall = await db.failureCause.count();

  await db.failureCause.create({
    data: {
      organizationId: session.organizationId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: antall,
    },
  });

  revalidatePath("/oppsett");
  return { ok: true, melding: `${parsed.data.name} er lagt til.` };
}

/**
 * Slår en årsak av eller på.
 *
 * Den slettes ikke. Arbeidsordre som allerede peker på koden skal fortsatt
 * kunne forklare seg, selv om årsaken ikke lenger er et gyldig valg.
 */
export async function settAarsakAktiv(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const id = String(formData.get("id") ?? "");
  const aktiv = formData.get("aktiv") === "ja";

  await db.failureCause.update({
    where: { id },
    data: { isActive: aktiv },
  });

  revalidatePath("/oppsett");
}

/** Endrer navnet eller forklaringen. Koden står fast. */
export async function endreAarsak(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const id = String(formData.get("id") ?? "");
  const navn = String(formData.get("name") ?? "").trim();
  const beskrivelse = String(formData.get("description") ?? "").trim();

  if (navn.length < 2) return { ok: false, feil: "Navnet er for kort." };

  await db.failureCause.update({
    where: { id },
    data: { name: navn, description: beskrivelse || null },
  });

  revalidatePath("/oppsett");
  return { ok: true, melding: "Lagret." };
}

// ─── Verdilister ──────────────────────────────────────────────

const listeverdi = z.object({
  liste: z.string().trim().min(1),
  code: z
    .string()
    .trim()
    .min(2, "Koden må ha minst to tegn.")
    .max(30, "Koden er for lang.")
    .regex(
      /^[A-ZÆØÅ0-9_-]+$/,
      "Koden kan bare ha store bokstaver, tall, bindestrek og understrek.",
    ),
  name: z.string().trim().min(2, "Skriv inn hva verdien heter."),
  description: z.string().trim().optional(),
  tone: z.string().trim().optional(),
});

/**
 * Legger til en verdi i en liste.
 *
 * Koden er det som lagres på arbeidsordren og kan ikke endres etterpå — da
 * ville hundre gamle ordre plutselig betydd noe annet. Navnet kan endres
 * fritt, og slår igjennom overalt med det samme.
 */
export async function leggTilListeverdi(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const parsed = listeverdi.safeParse({
    liste: formData.get("liste"),
    code: String(formData.get("code") ?? "").toUpperCase(),
    name: formData.get("name"),
    description: formData.get("description"),
    tone: formData.get("tone"),
  });

  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  if (!LISTER.some((l) => l.id === d.liste)) {
    return { ok: false, feil: "Ukjent liste." };
  }

  const finnes = await db.listValue.findFirst({
    where: { list: d.liste, code: d.code },
    select: { id: true },
  });
  if (finnes) return { ok: false, feil: `Koden ${d.code} er allerede i bruk.` };

  const antall = await db.listValue.count({ where: { list: d.liste } });

  await db.listValue.create({
    data: {
      organizationId: session.organizationId,
      list: d.liste,
      code: d.code,
      name: d.name,
      description: d.description || null,
      tone: TONE_IDER.includes(d.tone ?? "") ? d.tone! : "noytral",
      sortOrder: antall,
    },
  });

  revalidatePath("/oppsett");
  return { ok: true, melding: `${d.name} er lagt til.` };
}

/** Endrer navn, forklaring og farge. Koden står fast. */
export async function endreListeverdi(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const id = String(formData.get("id") ?? "");
  const navn = String(formData.get("name") ?? "").trim();
  const tone = String(formData.get("tone") ?? "");

  if (navn.length < 2) return { ok: false, feil: "Navnet er for kort." };

  await db.listValue.updateMany({
    where: { id },
    data: {
      name: navn,
      description: String(formData.get("description") ?? "").trim() || null,
      tone: TONE_IDER.includes(tone) ? tone : "noytral",
    },
  });

  revalidatePath("/oppsett");
  return { ok: true, melding: "Lagret." };
}

/**
 * Tar en verdi ut av bruk, eller inn igjen.
 *
 * Den slettes ikke. Arbeidsordre som allerede er merket med koden skal
 * fortsatt vise hva de var, selv om verdien ikke lenger er et gyldig valg.
 * Innebygde verdier kan ikke tas ut — systemet bruker dem selv når det lager
 * ordre fra forebyggende planer.
 */
export async function settListeverdiAktiv(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const id = String(formData.get("id") ?? "");
  const aktiv = formData.get("aktiv") === "ja";

  const verdi = await db.listValue.findFirst({
    where: { id },
    select: { isBuiltIn: true },
  });

  if (!verdi) return;
  if (verdi.isBuiltIn && !aktiv) {
    throw new Error(
      "Denne verdien er systemet avhengig av og kan ikke tas ut av bruk.",
    );
  }

  await db.listValue.updateMany({ where: { id }, data: { isActive: aktiv } });
  revalidatePath("/oppsett");
}

/**
 * Setter hvor langt måling av enkeltpersoner får gå.
 *
 * Bare administrator. Dette er en avgjørelse om arbeidsforholdene i
 * bedriften, ikke en innstilling en planlegger justerer i forbifarten — og
 * «Hele laget» utløser drøftingsplikt med tillitsvalgte etter
 * arbeidsmiljøloven kapittel 9.
 */
export async function settPersonMaling(
  verdi: PersonMaling,
): Promise<{ ok: boolean; feil?: string }> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  // Typen sier PersonMaling, men en server-handling tar imot det klienten
  // sender, og typer finnes ikke ved kjøring.
  if (!Object.keys(PersonMaling).includes(verdi)) {
    return { ok: false, feil: "Ukjent verdi." };
  }

  await db.organization.update({
    where: { id: session.organizationId },
    data: { personMaling: verdi },
  });

  revalidatePath("/oppsett");
  revalidatePath("/rapporter");
  revalidatePath("/rapporter/medarbeidere");
  revalidatePath("/rapporter/meg");
  return { ok: true };
}
