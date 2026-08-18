"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole, requireTenant } from "@/lib/auth";
import { nextCounterValue } from "@/lib/tenant";
import {
  bestillingsNummer,
  byggBestillingsEpost,
  harSmtp,
  mailtoLenke,
  sendEpost,
} from "@/lib/epost";
import { toNumber } from "@/lib/format";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/**
 * Lager bestillinger av et utvalg deler.
 *
 * Delene grupperes per leverandør, slik at leverandøren får én samlet
 * bestilling i stedet for én e-post per del. Det er den eneste måten en
 * innkjøper faktisk vil ha det på.
 *
 * Antallet settes til det som mangler for å nå maksimumsnivået, eller til
 * minimumsnivået hvis maks ikke er satt — altså nok til at delen er tilbake
 * der den skal være, ikke bare så vidt over grensen.
 */
export async function lagBestillingerFraDeler(
  partIder: string[],
): Promise<Resultat & { antall?: number }> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  if (partIder.length === 0) {
    return { ok: false, feil: "Velg minst én del." };
  }

  const deler = await db.part.findMany({
    where: { id: { in: partIder }, isActive: true },
    include: { supplier: { select: { id: true, name: true } } },
  });

  if (deler.length === 0) return { ok: false, feil: "Fant ingen av delene." };

  const utenLeverandor = deler.filter((d) => !d.supplierId);
  const medLeverandor = deler.filter((d) => d.supplierId);

  if (medLeverandor.length === 0) {
    return {
      ok: false,
      feil:
        "Ingen av delene har leverandør. Velg leverandør på reservedelen først, " +
        "så vet systemet hvem bestillingen skal til.",
    };
  }

  // Grupper per leverandør
  const perLeverandor = new Map<string, typeof medLeverandor>();
  for (const d of medLeverandor) {
    const liste = perLeverandor.get(d.supplierId!) ?? [];
    liste.push(d);
    perLeverandor.set(d.supplierId!, liste);
  }

  let opprettet = 0;
  for (const [supplierId, delene] of perLeverandor) {
    const number = await nextCounterValue(session.organizationId, "purchaseOrder");

    await db.purchaseOrder.create({
      data: {
        organizationId: session.organizationId,
        number,
        supplierId,
        createdById: session.userId,
        status: "UTKAST",
        lines: {
          create: delene.map((d) => {
            const mål = d.maxStock ?? Math.max(d.minStock, 1);
            const mangler = Math.max(mål - d.quantityOnHand, 1);
            return {
              partId: d.id,
              quantity: Math.ceil(mangler),
              unitCost: d.unitCost,
            };
          }),
        },
      },
    });
    opprettet += 1;
  }

  revalidatePath("/bestillinger");
  revalidatePath("/reservedeler");

  const merknad =
    utenLeverandor.length > 0
      ? ` ${utenLeverandor.length} ${utenLeverandor.length === 1 ? "del" : "deler"} ble hoppet over fordi de mangler leverandør.`
      : "";

  return {
    ok: true,
    antall: opprettet,
    melding: `Opprettet ${opprettet} ${opprettet === 1 ? "bestilling" : "bestillinger"}.${merknad}`,
  };
}

/** Oppretter en tom bestilling til én leverandør. */
export async function lagTomBestilling(supplierId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const leverandor = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!leverandor) return { ok: false, feil: "Ukjent leverandør." };

  const number = await nextCounterValue(session.organizationId, "purchaseOrder");
  const ny = await db.purchaseOrder.create({
    data: {
      organizationId: session.organizationId,
      number,
      supplierId,
      createdById: session.userId,
    },
  });

  revalidatePath("/bestillinger");
  redirect(`/bestillinger/${ny.id}`);
}

// ─── Linjer ──────────────────────────────────────────────────

/** Sjekker at bestillingen finnes og fortsatt kan endres. */
async function hentRedigerbar(db: Awaited<ReturnType<typeof requireTenant>>["db"], id: string) {
  const b = await db.purchaseOrder.findFirst({ where: { id } });
  if (!b) return { feil: "Fant ikke bestillingen." as const };
  if (b.status === "MOTTATT" || b.status === "KANSELLERT") {
    return { feil: "Bestillingen er avsluttet og kan ikke endres." as const };
  }
  return { bestilling: b };
}

export async function leggTilLinje(
  bestillingId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const partId = String(formData.get("partId") ?? "");
  const antall = Number(formData.get("quantity"));

  if (!partId) return { ok: false, feil: "Velg en del." };
  if (!Number.isFinite(antall) || antall <= 0) {
    return { ok: false, feil: "Antall må være over null." };
  }

  const sjekk = await hentRedigerbar(db, bestillingId);
  if ("feil" in sjekk) return { ok: false, feil: sjekk.feil };

  const del = await db.part.findFirst({ where: { id: partId } });
  if (!del) return { ok: false, feil: "Ukjent reservedel." };

  const finnes = await db.purchaseOrder.findFirst({
    where: { id: bestillingId },
    include: { lines: { where: { partId }, select: { id: true, quantity: true } } },
  });

  if (finnes && finnes.lines.length > 0) {
    // Delen står allerede på bestillingen — legg til antallet i stedet for
    // å lage en dublett leverandøren må tolke.
    await db.purchaseOrder.update({
      where: { id: bestillingId },
      data: {
        lines: {
          update: {
            where: { id: finnes.lines[0].id },
            data: { quantity: finnes.lines[0].quantity + antall },
          },
        },
      },
    });
  } else {
    await db.purchaseOrder.update({
      where: { id: bestillingId },
      data: {
        lines: { create: { partId, quantity: antall, unitCost: del.unitCost } },
      },
    });
  }

  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true };
}

export async function endreLinje(
  bestillingId: string,
  linjeId: string,
  antall: number,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const sjekk = await hentRedigerbar(db, bestillingId);
  if ("feil" in sjekk) return { ok: false, feil: sjekk.feil };

  if (!Number.isFinite(antall) || antall <= 0) {
    return { ok: false, feil: "Antall må være over null." };
  }

  await db.purchaseOrder.update({
    where: { id: bestillingId },
    data: { lines: { update: { where: { id: linjeId }, data: { quantity: antall } } } },
  });

  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true };
}

export async function fjernLinje(
  bestillingId: string,
  linjeId: string,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const sjekk = await hentRedigerbar(db, bestillingId);
  if ("feil" in sjekk) return { ok: false, feil: sjekk.feil };

  await db.purchaseOrder.update({
    where: { id: bestillingId },
    data: { lines: { delete: { id: linjeId } } },
  });

  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true };
}

// ─── Opplysninger ────────────────────────────────────────────

const detaljerSkjema = z.object({
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
  expectedAt: z.string().trim().optional(),
});

export async function oppdaterBestilling(
  bestillingId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const parsed = detaljerSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const sjekk = await hentRedigerbar(db, bestillingId);
  if ("feil" in sjekk) return { ok: false, feil: sjekk.feil };

  const dato = parsed.data.expectedAt ? new Date(parsed.data.expectedAt) : null;

  await db.purchaseOrder.updateMany({
    where: { id: bestillingId },
    data: {
      reference: parsed.data.reference || null,
      note: parsed.data.note || null,
      expectedAt: dato && !Number.isNaN(dato.getTime()) ? dato : null,
    },
  });

  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true, melding: "Lagret." };
}

export async function kansellerBestilling(bestillingId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const b = await db.purchaseOrder.findFirst({
    where: { id: bestillingId },
    include: { lines: true },
  });
  if (!b) return { ok: false, feil: "Fant ikke bestillingen." };

  if (b.lines.some((l) => l.receivedQuantity > 0)) {
    return {
      ok: false,
      feil: "Deler av bestillingen er allerede mottatt og kan ikke kanselleres.",
    };
  }

  await db.purchaseOrder.updateMany({
    where: { id: bestillingId },
    data: { status: "KANSELLERT" },
  });

  revalidatePath("/bestillinger");
  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true, melding: "Bestillingen er kansellert." };
}

// ─── Sending ─────────────────────────────────────────────────

export type SendResultat =
  | { ok: true; metode: "smtp"; melding: string }
  | { ok: true; metode: "manuell"; mailto: string; emne: string; tekst: string }
  | { ok: false; feil: string };

/**
 * Sender bestillingen til leverandøren.
 *
 * Er SMTP satt opp, sendes e-posten herfra og bestillingen markeres som sendt.
 * Ellers får klienten den ferdige teksten og en mailto-lenke, og markerer
 * bestillingen som sendt når brukeren har sendt den fra sin egen klient.
 */
export async function sendBestilling(bestillingId: string): Promise<SendResultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const bestilling = await db.purchaseOrder.findFirst({
    where: { id: bestillingId },
    include: {
      supplier: true,
      lines: { include: { part: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!bestilling) return { ok: false, feil: "Fant ikke bestillingen." };
  if (bestilling.lines.length === 0) {
    return { ok: false, feil: "Bestillingen har ingen linjer." };
  }
  if (bestilling.status === "KANSELLERT") {
    return { ok: false, feil: "Bestillingen er kansellert." };
  }

  const org = await db.user.findFirst({
    where: { id: session.userId },
    select: { organization: true },
  });
  if (!org) return { ok: false, feil: "Fant ikke organisasjonen." };

  const { emne, tekst, til } = byggBestillingsEpost(
    bestilling,
    org.organization,
    session.name,
  );

  if (harSmtp() && til) {
    const svar = await sendEpost({
      til,
      emne,
      tekst,
      svarTil: org.organization.email,
    });

    if (!svar.ok) return { ok: false, feil: svar.feil };

    await db.purchaseOrder.updateMany({
      where: { id: bestillingId },
      data: {
        status: "SENDT",
        sentAt: new Date(),
        sentToEmail: til,
        sentMethod: "smtp",
      },
    });

    revalidatePath("/bestillinger");
    revalidatePath(`/bestillinger/${bestillingId}`);
    return {
      ok: true,
      metode: "smtp",
      melding: `${bestillingsNummer(bestilling.number)} er sendt til ${til}.`,
    };
  }

  return {
    ok: true,
    metode: "manuell",
    mailto: mailtoLenke(til, emne, tekst),
    emne,
    tekst,
  };
}

/** Brukeren har sendt e-posten fra sin egen klient. */
export async function markerSomSendt(bestillingId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const b = await db.purchaseOrder.findFirst({
    where: { id: bestillingId },
    include: { supplier: { select: { email: true } } },
  });
  if (!b) return { ok: false, feil: "Fant ikke bestillingen." };

  await db.purchaseOrder.updateMany({
    where: { id: bestillingId },
    data: {
      status: "SENDT",
      sentAt: new Date(),
      sentToEmail: b.supplier.email,
      sentMethod: "manuell",
    },
  });

  revalidatePath("/bestillinger");
  revalidatePath(`/bestillinger/${bestillingId}`);
  return { ok: true, melding: "Markert som sendt." };
}

// ─── Mottak ──────────────────────────────────────────────────

/**
 * Fører mottatte varer inn på lager.
 *
 * Beholdning, lagerbevegelse og mottatt antall på linjen skrives i én
 * transaksjon, slik at lageret aldri kan komme ut av synk med bestillingen.
 * Delleveranser er normalt, så statusen settes til Mottatt først når alle
 * linjer er fullt levert.
 */
export async function mottaVarer(
  bestillingId: string,
  mottak: { linjeId: string; antall: number }[],
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "TEKNIKER");

  const relevante = mottak.filter((m) => m.antall > 0);
  if (relevante.length === 0) {
    return { ok: false, feil: "Skriv inn hvor mye som kom." };
  }

  try {
    await db.$transaction(async (tx) => {
      const bestilling = await tx.purchaseOrder.findFirst({
        where: { id: bestillingId },
        include: { lines: true },
      });
      if (!bestilling) throw new Error("Fant ikke bestillingen.");
      if (bestilling.status === "KANSELLERT") {
        throw new Error("Bestillingen er kansellert.");
      }

      for (const m of relevante) {
        const linje = bestilling.lines.find((l) => l.id === m.linjeId);
        if (!linje) throw new Error("Fant ikke bestillingslinjen.");

        const gjenstår = linje.quantity - linje.receivedQuantity;
        if (m.antall > gjenstår + 0.001) {
          throw new Error(
            `Kan ikke motta mer enn det som gjenstår (${gjenstår}) på en linje.`,
          );
        }

        await tx.purchaseOrderLine.update({
          where: { id: linje.id },
          data: { receivedQuantity: linje.receivedQuantity + m.antall },
        });

        await tx.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            partId: linje.partId,
            type: "INN",
            quantity: m.antall,
            unitCost: linje.unitCost,
            purchaseOrderId: bestillingId,
            userId: session.userId,
            note: `Mottatt på ${bestillingsNummer(bestilling.number)}`,
          },
        });

        await tx.part.update({
          where: { id: linje.partId },
          data: {
            quantityOnHand: { increment: m.antall },
            // Innkjøpsprisen på bestillingen blir gjeldende kostnad videre
            unitCost: toNumber(linje.unitCost),
          },
        });
      }

      // Er alt levert nå?
      const oppdaterte = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: bestillingId },
      });
      const altMottatt = oppdaterte.every(
        (l) => l.receivedQuantity >= l.quantity - 0.001,
      );

      await tx.purchaseOrder.update({
        where: { id: bestillingId },
        data: {
          status: altMottatt ? "MOTTATT" : "DELVIS_MOTTATT",
          receivedAt: altMottatt ? new Date() : null,
        },
      });
    });
  } catch (e) {
    return {
      ok: false,
      feil: e instanceof Error ? e.message : "Mottaket kunne ikke registreres.",
    };
  }

  revalidatePath(`/bestillinger/${bestillingId}`);
  revalidatePath("/bestillinger");
  revalidatePath("/reservedeler");
  revalidatePath("/dashbord");
  return { ok: true, melding: "Varene er ført inn på lager." };
}
