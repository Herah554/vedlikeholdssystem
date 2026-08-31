import type { PersonMaling } from "@/generated/prisma/client";
import type { TenantDb } from "@/lib/tenant";
import { arbeidsdager, malMedarbeidere, type Maling } from "@/lib/medarbeidere";

/**
 * Henter målene fra databasen.
 *
 * Ligger her og ikke i hver av de to sidene, slik at ledervisningen og den
 * enkeltes egen visning aldri kan komme i utakt. Ser man ett tall om seg selv
 * og lederen ser et annet, er begge verdiløse.
 */
export async function hentMaling(
  db: TenantDb,
  fra: Date,
  til: Date,
  /** Sett for å hente bare én person. Brukes av «mine tall». */
  bareBruker?: string,
): Promise<Maling[]> {
  const [ordrer, timeforing, folk, korrektive] = await Promise.all([
    db.workOrder.findMany({
      where: {
        completedAt: { gte: fra, lte: til },
        ...(bareBruker ? { assignedToId: bareBruker } : {}),
      },
      select: {
        id: true,
        assignedToId: true,
        assetId: true,
        priority: true,
        estimatedHours: true,
        dueDate: true,
        completedAt: true,
        resolution: true,
      },
    }),
    db.timeEntry.groupBy({
      by: ["userId"],
      _sum: { hours: true },
      where: {
        workedOn: { gte: fra, lte: til },
        ...(bareBruker ? { userId: bareBruker } : {}),
      },
    }),
    db.user.findMany({
      where: bareBruker
        ? { id: bareBruker }
        : {
            isActive: true,
            role: { in: ["TEKNIKER", "DELELAGER", "PLANLEGGER"] },
          },
      select: { id: true, name: true, dailyHours: true },
      orderBy: { name: "asc" },
    }),
    // Korrektive jobber fra perioden og framover, slik at en reparasjon helt
    // i slutten av perioden også kan få en omgang mot seg. Denne filtreres
    // ikke på person: en annens jobb på samme maskin teller like fullt.
    db.workOrder.findMany({
      where: { type: "KORREKTIV", createdAt: { gte: fra } },
      select: { id: true, assetId: true, createdAt: true },
    }),
  ]);

  return malMedarbeidere(
    ordrer,
    folk.map((b) => ({ id: b.id, navn: b.name, timerPerDag: b.dailyHours })),
    new Map(timeforing.map((t) => [t.userId, t._sum.hours ?? 0])),
    korrektive,
    arbeidsdager(fra, til),
  );
}

/**
 * Hva innstillingen i bedriften tillater.
 *
 * Skillet går mellom å se sine egne tall og at andre ser dem, og det er
 * nettopp der forskjellen ligger: egne tall om eget arbeid er tilbakemelding,
 * mens en oversikt over kolleger er et kontrolltiltak etter
 * arbeidsmiljøloven kapittel 9.
 */
export function maalingTillater(innstilling: PersonMaling) {
  return {
    egne: innstilling !== "AV",
    andres: innstilling === "ALLE",
  };
}
