"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin, startSession } from "@/lib/auth";
import { opprettBedrift } from "@/lib/bedrift";

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
