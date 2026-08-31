"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";
import { nextCounterValue } from "@/lib/tenant";
import { grupperBehov, slaaSammenLinjer } from "@/lib/delebehov";
import { toNumber } from "@/lib/format";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/** Det klienten trenger for å vise et søketreff. */
export type Deletreff = {
  id: string;
  number: string;
  name: string;
  unit: string;
  beholdning: number;
  leverandor: string | null;
};

/**
 * Søker opp deler mens teknikeren skriver.
 *
 * Før lå alle delene i en nedtrekksliste. Det fungerer til hundre deler og
 * blir ubrukelig ved tusen — og et lager med tusen deler er det normale hos
 * dem systemet skal selges til. Nå spørres databasen i stedet, som har
 * trigram-indekser på både navn og delenummer.
 *
 * Søket treffer midt inne i ordet, ikke bare i starten. Den som leter etter
 * en pakning skriver «pakning», ikke «SKF-6205 pakning», og delenummeret
 * husker nesten ingen utenat.
 */
export async function sokDeler(tekst: string): Promise<Deletreff[]> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "se");

  const q = tekst.trim();
  if (q.length < 2) return [];

  const treff = await db.part.findMany({
    where: {
      isActive: true,
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { manufacturerPartNo: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      number: true,
      name: true,
      unit: true,
      quantityOnHand: true,
      supplier: { select: { name: true } },
    },
    // Delene med noe på lager først: teknikeren vil helst ta den han kan
    // hente nå, framfor å bestille noe han må vente på.
    orderBy: [{ quantityOnHand: "desc" }, { number: "asc" }],
    take: 20,
  });

  return treff.map((d) => ({
    id: d.id,
    number: d.number,
    name: d.name,
    unit: d.unit,
    beholdning: d.quantityOnHand,
    leverandor: d.supplier?.name ?? null,
  }));
}

const behovSkjema = z
  .object({
    partId: z.string().trim().optional(),
    description: z.string().trim().optional(),
    quantity: z.coerce.number().positive("Antall må være mer enn null."),
    note: z.string().trim().optional(),
    urgent: z.string().optional(),
  })
  .refine((d) => d.partId || d.description, {
    message: "Velg en del fra lageret, eller beskriv hva du trenger.",
  });

/**
 * Teknikeren melder at hen mangler en del.
 *
 * Dette er ikke en bestilling — det er en beskjed til den som bestiller.
 * Skillet er med vilje: en tekniker skal kunne si fra uten å ha ansvar for
 * innkjøpsbudsjettet, og den som har det ansvaret skal se hva som er bedt om
 * før pengene brukes.
 */
export async function meldDelebehov(
  workOrderId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  // Samme nivå som å ta ut en del. Den som gjør jobben skal kunne si hva
  // jobben trenger.
  krev(session, "arbeidsordre", "endre");

  const parsed = behovSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const ordre = await db.workOrder.findFirst({
    where: { id: workOrderId },
    select: { id: true },
  });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  if (d.partId) {
    const del = await db.part.findFirst({
      where: { id: d.partId, isActive: true },
      select: { id: true },
    });
    if (!del) return { ok: false, feil: "Fant ikke delen." };
  }

  await db.partRequest.create({
    data: {
      organizationId: session.organizationId,
      workOrderId,
      partId: d.partId || null,
      description: d.partId ? null : d.description || null,
      quantity: d.quantity,
      note: d.note || null,
      urgent: d.urgent === "on" || d.urgent === "true",
      requestedById: session.userId,
    },
  });

  revalidatePath(`/arbeidsordre/${workOrderId}`);
  revalidatePath("/bestillinger/behov");
  revalidatePath("/dashbord");

  return { ok: true, melding: "Delelageret har fått beskjed." };
}

/**
 * Teknikeren angrer.
 *
 * Bare den som meldte behovet kan trekke det, og bare før noen har handlet
 * på det. Er delen først bestilt, er pengene brukt, og da er det innkjøperen
 * som må kansellere hos leverandøren.
 */
export async function trekkBehov(behovId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const behov = await db.partRequest.findFirst({
    where: { id: behovId },
    select: { id: true, status: true, requestedById: true, workOrderId: true },
  });
  if (!behov) return { ok: false, feil: "Fant ikke behovet." };

  if (behov.status !== "ONSKET") {
    return {
      ok: false,
      feil: "Behovet er allerede behandlet og kan ikke trekkes.",
    };
  }
  if (behov.requestedById !== session.userId) {
    return { ok: false, feil: "Bare den som meldte behovet kan trekke det." };
  }

  await db.partRequest.delete({ where: { id: behovId } });

  if (behov.workOrderId) revalidatePath(`/arbeidsordre/${behov.workOrderId}`);
  revalidatePath("/bestillinger/behov");
  revalidatePath("/dashbord");

  return { ok: true };
}

/** Delelager sier nei, og må si hvorfor. */
export async function avvisBehov(
  behovId: string,
  begrunnelse: string,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "bestillinger", "administrere");

  const grunn = begrunnelse.trim();
  if (grunn.length < 3) {
    // Et blankt avslag gir teknikeren ingenting å gå videre på, og behovet
    // dukker opp igjen neste uke fordi ingen vet hva som var galt.
    return { ok: false, feil: "Skriv en kort begrunnelse." };
  }

  const behov = await db.partRequest.findFirst({
    where: { id: behovId },
    select: { id: true, status: true, workOrderId: true },
  });
  if (!behov) return { ok: false, feil: "Fant ikke behovet." };
  if (behov.status !== "ONSKET") {
    return { ok: false, feil: "Behovet er allerede behandlet." };
  }

  await db.partRequest.update({
    where: { id: behovId },
    data: {
      status: "AVVIST",
      handledById: session.userId,
      handledAt: new Date(),
      handledNote: grunn,
    },
  });

  if (behov.workOrderId) revalidatePath(`/arbeidsordre/${behov.workOrderId}`);
  revalidatePath("/bestillinger/behov");
  revalidatePath("/dashbord");

  return { ok: true, melding: "Behovet er avvist." };
}

/**
 * Kobler et fritekstbehov til en faktisk del.
 *
 * «Trenger den store pakningen til pumpe 3» blir til et delenummer. Først da
 * kan behovet bli en bestillingslinje, og først da vet lageret hva som
 * kommer inn.
 */
export async function koblePartTilBehov(
  behovId: string,
  partId: string,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "administrere");

  const [behov, del] = await Promise.all([
    db.partRequest.findFirst({
      where: { id: behovId },
      select: { id: true, status: true, workOrderId: true },
    }),
    db.part.findFirst({ where: { id: partId, isActive: true }, select: { id: true } }),
  ]);

  if (!behov) return { ok: false, feil: "Fant ikke behovet." };
  if (!del) return { ok: false, feil: "Fant ikke delen." };
  if (behov.status !== "ONSKET") {
    return { ok: false, feil: "Behovet er allerede behandlet." };
  }

  await db.partRequest.update({
    where: { id: behovId },
    // Beskrivelsen beholdes. Den er teknikerens egne ord om hva hen trengte,
    // og er verdt å ha hvis koblingen viser seg å være feil.
    data: { partId },
  });

  if (behov.workOrderId) revalidatePath(`/arbeidsordre/${behov.workOrderId}`);
  revalidatePath("/bestillinger/behov");

  return { ok: true, melding: "Behovet er koblet til delen." };
}

/**
 * Gjør et utvalg behov om til bestillinger.
 *
 * Behovene grupperes per leverandør, og behov for samme del slås sammen til
 * én linje med summert antall — to teknikere som trenger hver sin pakning
 * skal gi «2 stk», ikke to linjer leverandøren må tolke.
 *
 * Finnes det allerede et utkast til leverandøren, legges delene der i stedet
 * for å lage enda et. Ingen innkjøper vil ha fem halvferdige bestillinger til
 * samme firma.
 */
export async function bestillBehov(
  behovIder: string[],
): Promise<Resultat & { antall?: number }> {
  const { db, session } = await requireTenant();
  krev(session, "bestillinger", "administrere");

  if (behovIder.length === 0) return { ok: false, feil: "Velg minst ett behov." };

  const rader = await db.partRequest.findMany({
    where: { id: { in: behovIder }, status: "ONSKET" },
    include: {
      part: {
        select: {
          id: true,
          supplierId: true,
          unitCost: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });

  if (rader.length === 0) {
    return { ok: false, feil: "Fant ingen behov som fortsatt venter." };
  }

  const { klare, utenLeverandor, maaKobles } = grupperBehov(
    rader.map((r) => ({
      id: r.id,
      quantity: r.quantity,
      urgent: r.urgent,
      part: r.part
        ? {
            id: r.part.id,
            supplierId: r.part.supplierId,
            supplierNavn: r.part.supplier?.name ?? null,
            unitCost: toNumber(r.part.unitCost),
          }
        : null,
    })),
  );

  if (klare.length === 0) {
    return {
      ok: false,
      feil:
        maaKobles.length > 0
          ? "Behovene må kobles til en reservedel før de kan bestilles."
          : "Delene mangler leverandør. Sett leverandør på reservedelen først.",
    };
  }

  let antallBestillinger = 0;

  for (const gruppe of klare) {
    const linjer = slaaSammenLinjer(gruppe.behov);

    await db.$transaction(async (tx) => {
      // Legg på et utkast som allerede går til denne leverandøren, hvis det
      // finnes. Bare utkast — en sendt bestilling skal ikke endres i ryggen
      // på leverandøren.
      let bestilling = await tx.purchaseOrder.findFirst({
        where: { supplierId: gruppe.supplierId, status: "UTKAST" },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      // Om bestillingen fantes fra før, er dette en endring i noe en annen
      // allerede har sett på. Da må det merkes — ellers sender innkjøperen
      // av gårde noe annet enn det hen leste.
      const varFraFor = Boolean(bestilling);

      if (!bestilling) {
        const number = await nextCounterValue(
          session.organizationId,
          "purchaseOrder",
        );
        bestilling = await tx.purchaseOrder.create({
          data: {
            organizationId: session.organizationId,
            number,
            supplierId: gruppe.supplierId,
            createdById: session.userId,
            status: "UTKAST",
          },
          select: { id: true },
        });
      }

      for (const linje of linjer) {
        const finnes = await tx.purchaseOrderLine.findUnique({
          where: {
            purchaseOrderId_partId: {
              purchaseOrderId: bestilling.id,
              partId: linje.partId,
            },
          },
          select: { id: true, quantity: true, addedLater: true },
        });

        if (finnes) {
          // Delen står der fra før. Øk antallet i stedet for å prøve å legge
          // inn en linje til — det ville brutt den unike nøkkelen og stoppet
          // hele bestillingen. Et økt antall er like mye en endring som en ny
          // linje: bestillingen koster mer enn den gjorde.
          await tx.purchaseOrderLine.update({
            where: { id: finnes.id },
            data: {
              quantity: finnes.quantity + linje.quantity,
              addedLater: varFraFor ? true : finnes.addedLater,
            },
          });
        } else {
          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: bestilling.id,
              partId: linje.partId,
              quantity: linje.quantity,
              unitCost: linje.unitCost,
              addedLater: varFraFor,
            },
          });
        }

        if (varFraFor) {
          await tx.purchaseOrder.update({
            where: { id: bestilling.id },
            data: { pendingChanges: { increment: 1 } },
          });
        }

        await tx.partRequest.updateMany({
          where: { id: { in: linje.behovIder } },
          data: {
            status: "BESTILT",
            purchaseOrderId: bestilling.id,
            handledById: session.userId,
            handledAt: new Date(),
          },
        });
      }
    });

    antallBestillinger += 1;
  }

  revalidatePath("/bestillinger");
  revalidatePath("/bestillinger/behov");
  revalidatePath("/dashbord");
  for (const r of rader) {
    if (r.workOrderId) revalidatePath(`/arbeidsordre/${r.workOrderId}`);
  }

  const hoppet = utenLeverandor.length + maaKobles.length;
  const merknad =
    hoppet > 0
      ? ` ${hoppet} ble hoppet over fordi delen mangler leverandør eller ikke er koblet.`
      : "";

  return {
    ok: true,
    antall: antallBestillinger,
    melding: `La delene inn på ${antallBestillinger} ${
      antallBestillinger === 1 ? "bestilling" : "bestillinger"
    }.${merknad}`,
  };
}
