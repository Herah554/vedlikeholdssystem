"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { assertRole, hashPassword, requireTenant } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { lagLenkeForBruker } from "@/lib/passord";
import { prisma } from "@/lib/prisma";

/**
 * Rollene, hentet fra schemaet framfor skrevet av.
 *
 * Den håndskrevne lista manglet DELELAGER. Nedtrekkslista i skjemaet viste
 * rollen fordi den leser fra ROLLE i domene.ts, men serveren avviste den —
 * så rollen fantes, var synlig, og kunne likevel ikke tildeles.
 */
const ROLLER = Object.keys(Role) as [Role, ...Role[]];

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const brukerSkjema = z.object({
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  email: z.email("Skriv inn en gyldig e-postadresse."),
  role: z.enum(ROLLER),
  password: z.string().min(8, "Passordet må ha minst åtte tegn."),
  hourlyRate: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export async function opprettBruker(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const parsed = brukerSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const epost = d.email.toLowerCase();
  const finnes = await db.user.findFirst({ where: { email: epost } });
  if (finnes) return { ok: false, feil: `${epost} er allerede registrert.` };

  const sats = d.hourlyRate ? Number(d.hourlyRate) : null;

  await db.user.create({
    data: {
      organizationId: session.organizationId,
      name: d.name,
      email: epost,
      role: d.role,
      phone: d.phone || null,
      hourlyRate: sats != null && !Number.isNaN(sats) ? sats : null,
      passwordHash: await hashPassword(d.password),
    },
  });

  revalidatePath("/innstillinger");
  return { ok: true, melding: `${d.name} er lagt til.` };
}

export async function endreRolle(
  brukerId: string,
  rolle: Role,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  // Typen sier Role, men en server-handling tar imot det klienten sender og
  // typer finnes ikke ved kjøring. Uten denne linja ville en ukjent verdi
  // gått helt ned til databasen og kommet tilbake som en ubehandlet feil.
  if (!ROLLER.includes(rolle)) return { ok: false, feil: "Ukjent rolle." };

  // Uten denne sperren kan siste administrator degradere seg selv og
  // låse hele organisasjonen ute fra brukeradministrasjonen.
  if (brukerId === session.userId && rolle !== "ADMIN") {
    const antallAdmin = await db.user.count({ where: { role: "ADMIN", isActive: true } });
    if (antallAdmin <= 1) {
      return {
        ok: false,
        feil: "Du er eneste administrator. Gi noen andre admin-rollen først.",
      };
    }
  }

  await db.user.updateMany({ where: { id: brukerId }, data: { role: rolle } });

  revalidatePath("/innstillinger");
  return { ok: true };
}

export async function settAktiv(
  brukerId: string,
  aktiv: boolean,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  if (brukerId === session.userId && !aktiv) {
    return { ok: false, feil: "Du kan ikke deaktivere din egen bruker." };
  }

  await db.user.updateMany({ where: { id: brukerId }, data: { isActive: aktiv } });

  revalidatePath("/innstillinger");
  return { ok: true };
}

const kostnadsstedSkjema = z.object({
  code: z.string().trim().min(1, "Kode er påkrevd.").max(20),
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
});

export async function opprettKostnadssted(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "LEDER");

  const parsed = kostnadsstedSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const finnes = await db.costCenter.findFirst({ where: { code: parsed.data.code } });
  if (finnes) return { ok: false, feil: `Koden ${parsed.data.code} finnes allerede.` };

  await db.costCenter.create({ data: { ...parsed.data, organizationId: session.organizationId } });

  revalidatePath("/innstillinger");
  revalidatePath("/budsjett");
  return { ok: true, melding: "Kostnadsstedet er opprettet." };
}

const budsjettSkjema = z.object({
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number().min(0, "Beløpet kan ikke være negativt."),
  category: z.enum(["ARBEID", "DELER", "TJENESTER", "TOTALT"]),
  costCenterId: z.string().min(1, "Velg kostnadssted."),
});

export async function opprettBudsjett(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "LEDER");

  const parsed = budsjettSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const ks = await db.costCenter.findFirst({
    where: { id: parsed.data.costCenterId },
  });
  if (!ks) return { ok: false, feil: "Ukjent kostnadssted." };

  await db.budget.create({ data: { ...parsed.data, organizationId: session.organizationId } });

  revalidatePath("/innstillinger");
  revalidatePath("/budsjett");
  return { ok: true, melding: "Budsjettlinjen er lagt inn." };
}

// ─── Redigering av eksisterende brukere ──────────────────────

const redigerBrukerSkjema = z.object({
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  email: z.email("Skriv inn en gyldig e-postadresse."),
  role: z.enum(ROLLER),
  phone: z.string().trim().optional(),
  hourlyRate: z.string().trim().optional(),
  dailyHours: z.coerce
    .number()
    .min(0, "Timer per dag kan ikke være negativt.")
    .max(24, "Et døgn har tjuefire timer."),
});

export async function oppdaterBruker(
  brukerId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const parsed = redigerBrukerSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const bruker = await db.user.findFirst({ where: { id: brukerId } });
  if (!bruker) return { ok: false, feil: "Fant ikke brukeren." };

  const epost = d.email.toLowerCase();
  if (epost !== bruker.email) {
    const opptatt = await db.user.findFirst({ where: { email: epost } });
    if (opptatt) return { ok: false, feil: `${epost} er allerede i bruk.` };
  }

  // Samme sperre som ved rollebytte: siste administrator må ikke kunne
  // degradere seg selv og låse organisasjonen ute.
  if (brukerId === session.userId && d.role !== "ADMIN") {
    const antallAdmin = await db.user.count({ where: { role: "ADMIN", isActive: true } });
    if (antallAdmin <= 1) {
      return {
        ok: false,
        feil: "Du er eneste administrator. Gi noen andre admin-rollen først.",
      };
    }
  }

  const sats = d.hourlyRate ? Number(d.hourlyRate) : null;

  await db.user.updateMany({
    where: { id: brukerId },
    data: {
      name: d.name,
      email: epost,
      role: d.role,
      phone: d.phone || null,
      hourlyRate: sats != null && !Number.isNaN(sats) ? sats : null,
      dailyHours: d.dailyHours,
    },
  });

  revalidatePath("/innstillinger");
  revalidatePath(`/innstillinger/bruker/${brukerId}`);
  return { ok: true, melding: "Brukeren er oppdatert." };
}

export async function nullstillPassord(
  brukerId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const passord = String(formData.get("password") ?? "");
  if (passord.length < 8) {
    return { ok: false, feil: "Passordet må ha minst åtte tegn." };
  }

  const bruker = await db.user.findFirst({ where: { id: brukerId } });
  if (!bruker) return { ok: false, feil: "Fant ikke brukeren." };

  await db.user.updateMany({
    where: { id: brukerId },
    data: { passwordHash: await hashPassword(passord) },
  });

  return {
    ok: true,
    melding: `Passordet er byttet. Gi det til ${bruker.name} på en trygg måte.`,
  };
}

// ─── Organisasjonen ──────────────────────────────────────────

const orgSkjema = z.object({
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  orgNumber: z.string().trim().optional(),
  hourlyRate: z.coerce.number().min(0, "Timeprisen kan ikke være negativ."),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

/**
 * Oppdaterer organisasjonen brukeren tilhører.
 *
 * Merk at id-en aldri kommer fra skjemaet — den leses fra sesjonen. Ellers
 * kunne en administrator i ett firma endret navnet på et annet.
 */
export async function oppdaterOrganisasjon(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const parsed = orgSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      name: d.name,
      orgNumber: d.orgNumber || null,
      hourlyRate: d.hourlyRate,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      postalCode: d.postalCode || null,
      city: d.city || null,
    },
  });

  revalidatePath("/innstillinger");
  return { ok: true, melding: "Organisasjonen er oppdatert." };
}

/**
 * Lager en engangslenke administratoren kan gi videre.
 *
 * Erstatter det å skrive inn et passord for noen andre. Brukeren setter sitt
 * eget, og administratoren får aldri vite det — da kan ingen logge inn som
 * en kollega og se ut som hen i loggen.
 *
 * Lenka virker i én time og bare én gang, som alle andre passordlenker.
 */
export async function lagPassordlenke(
  brukerId: string,
): Promise<{ ok: boolean; feil?: string; lenke?: string; navn?: string }> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  // Gjennom flerklient-filteret: en administrator skal ikke kunne lage en
  // lenke til en bruker i en annen bedrift ved å gjette en id.
  const bruker = await db.user.findFirst({
    where: { id: brukerId },
    select: { id: true },
  });
  if (!bruker) return { ok: false, feil: "Fant ikke brukeren." };

  const svar = await lagLenkeForBruker(brukerId);
  if (!svar.ok) return { ok: false, feil: svar.feil };

  const h = await headers();
  const vert = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protokoll =
    h.get("x-forwarded-proto") ?? (vert.startsWith("localhost") ? "http" : "https");

  return {
    ok: true,
    navn: svar.navn,
    lenke: `${protokoll}://${vert}/nytt-passord?token=${svar.token}`,
  };
}
