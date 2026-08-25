"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin, startSession } from "@/lib/auth";
import { opprettBedrift } from "@/lib/bedrift";
import { opprettDemobedrift } from "@/lib/demo";
import {
  FUNKSJON_IDER,
  lesUnntak,
  PLAN_REKKEFOLGE,
  type Funksjon,
} from "@/lib/planer";
import type { Plan } from "@/generated/prisma/client";

/**
 * Handlingene på plattformsiden.
 *
 * Her brukes prisma direkte og ikke dbForOrg(), fordi dette er det ene stedet
 * i systemet som med hensikt ser på tvers av kunder. Det er derfor hver eneste
 * handling begynner med requireSuperadmin() — den sperren er alt som skiller
 * denne filen fra en datalekkasje.
 *
 * Merk at organisasjonstabellen uansett ikke har noen organizationId. Det er
 * bare den, og tellingene av rader under hver kunde, som leses her. Vil du inn
 * i selve dataene til en kunde, må du åpne bedriften — og da går du gjennom
 * det vanlige filteret som alle andre.
 */

export type Resultat = {
  ok: boolean;
  feil?: string;
  melding?: string;
  verdier?: { firma: string; orgNumber: string; navn: string; email: string };
};

const nyKunde = z.object({
  firma: z.string().trim().min(2, "Skriv inn firmanavnet."),
  orgNumber: z.string().trim().optional(),
  navn: z.string().trim().min(2, "Skriv inn navnet på administratoren."),
  email: z.email("Skriv inn en gyldig e-postadresse."),
  password: z.string().min(8, "Passordet må ha minst åtte tegn."),
});

/** Oppretter en ny kunde med sin første administrator. */
export async function opprettKunde(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  await requireSuperadmin();

  const les = (n: string) => String(formData.get(n) ?? "");
  const verdier = {
    firma: les("firma"),
    orgNumber: les("orgNumber"),
    navn: les("navn"),
    email: les("email"),
  };

  const parsed = nyKunde.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message, verdier };
  }

  // Kunden opprettes aldri som plattformeier. Administratoren deres styrer
  // sitt eget firma og ser ikke at andre kunder finnes.
  const { org } = await opprettBedrift(parsed.data);

  revalidatePath("/plattform");
  return {
    ok: true,
    melding: `${org.name} er opprettet. Gi innloggingen til ${parsed.data.email} på en trygg måte.`,
  };
}

/**
 * Åpner en kundes system.
 *
 * Økten får kundens organisasjon som aktiv, og din egen lagres slik at du
 * finner veien tilbake. Du får ingen ny tilgang av dette — all datatilgang
 * går fortsatt gjennom dbForOrg() med den aktive organisasjonen, akkurat som
 * for kundens egne brukere.
 */
export async function apneBedrift(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");

  const mal = await prisma.organization.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  });
  if (!mal) throw new Error("Fant ikke bedriften, eller den er deaktivert.");

  // Hjemmeorganisasjonen leses fra brukeren, ikke fra økten. Er du allerede
  // inne hos en kunde, skal veien hjem fortsatt peke på ditt eget firma.
  const meg = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { organizationId: true, organization: { select: { name: true } } },
  });

  const egen = mal.id === meg.organizationId;

  await startSession({
    userId: session.userId,
    organizationId: mal.id,
    organizationName: mal.name,
    name: session.name,
    email: session.email,
    role: "ADMIN",
    superadmin: true,
    hjemOrganisasjonId: egen ? undefined : meg.organizationId,
    hjemOrganisasjonNavn: egen ? undefined : meg.organization.name,
  });

  redirect("/dashbord");
}

/** Tilbake til ditt eget firma. */
export async function tilbakeTilEgen(): Promise<void> {
  const session = await requireSuperadmin();

  const meg = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true } },
    },
  });

  await startSession({
    userId: session.userId,
    organizationId: meg.organizationId,
    organizationName: meg.organization.name,
    name: session.name,
    email: session.email,
    role: meg.role,
    superadmin: true,
  });

  redirect("/dashbord");
}

/**
 * Slår en bedrift av eller på.
 *
 * Ingenting slettes. Brukerne kommer bare ikke inn, og innloggingssiden sier
 * fra om hvorfor. Dette er bryteren for en kunde som slutter å betale — og
 * den er like lett å slå på igjen.
 */
export async function settAktiv(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  const aktiv = formData.get("aktiv") === "ja";

  const meg = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { organizationId: true },
  });

  // Å stenge sitt eget firma ville låst deg ute av plattformsiden også.
  if (id === meg.organizationId && !aktiv) {
    throw new Error("Du kan ikke deaktivere ditt eget firma.");
  }

  await prisma.organization.update({
    where: { id },
    data: { isActive: aktiv },
  });

  revalidatePath("/plattform");
}

/**
 * Oppretter en ferdig utfylt demobedrift.
 *
 * Nyttig når systemet skal vises fram: et tomt dashbord selger ingenting.
 * Bedriften er en helt vanlig kunde og ser ikke noe fra de andre.
 */
export async function lagDemobedrift(): Promise<Resultat> {
  await requireSuperadmin();

  const demo = await opprettDemobedrift();

  revalidatePath("/plattform");
  return {
    ok: true,
    melding: `${demo.navn} er klar. Logg inn som ${demo.innlogging} med passordet ${demo.passord} — dette vises bare nå.`,
  };
}

// ─── Planer og funksjoner ─────────────────────────────────────

/**
 * Setter hvilken plan kunden er på.
 *
 * Unntakene røres ikke. Har du gitt en kunde assistenten på prøve, skal ikke
 * en oppgradering til Pluss ta den fra dem igjen.
 */
export async function settPlan(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const plan = String(formData.get("plan") ?? "");

  if (!PLAN_REKKEFOLGE.includes(plan as Plan)) {
    throw new Error("Ukjent plan.");
  }

  await prisma.organization.update({
    where: { id },
    data: { plan: plan as Plan },
  });

  revalidatePath("/plattform");
  revalidatePath(`/plattform/${id}`);
}

/**
 * Slår én funksjon av eller på for én kunde, uavhengig av planen.
 *
 * Tre tilstander, ikke to: «følg planen», «på» og «av». Uten den første ville
 * en kunde som byttet plan sittet fast med det de hadde før, og ingen ville
 * skjønt hvorfor.
 */
export async function settFunksjon(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const funksjon = String(formData.get("funksjon") ?? "") as Funksjon;
  const verdi = String(formData.get("verdi") ?? "");

  if (!FUNKSJON_IDER.includes(funksjon)) throw new Error("Ukjent funksjon.");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id },
    select: { features: true },
  });

  const unntak = lesUnntak(org.features);

  if (verdi === "plan") {
    delete unntak[funksjon];
  } else {
    unntak[funksjon] = verdi === "pa";
  }

  await prisma.organization.update({
    where: { id },
    data: { features: unntak },
  });

  revalidatePath("/plattform");
  revalidatePath(`/plattform/${id}`);
}
