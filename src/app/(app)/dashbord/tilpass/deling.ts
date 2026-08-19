import type { TenantDb } from "@/lib/tenant";

/**
 * Deling av dashbordoppsett.
 *
 * Alle oppslag her går gjennom dashboards og aldri direkte på
 * dashboard_shares. Delingstabellen har ingen organizationId — den arver
 * tilhørigheten fra dashbordet — og er derfor ikke dekket av flerklient-
 * filteret. Spurte vi rett på den, ville «delt med hele bedriften» plukket
 * opp rader fra alle kunder på serveren.
 */

export type DeltDashbord = {
  id: string;
  navn: string;
  eier: string;
  medHeleFirmaet: boolean;
  antallWidgets: number;
};

/** Oppsett andre har delt med deg, enten direkte eller med hele bedriften. */
export async function deltMedMeg(
  db: TenantDb,
  userId: string,
): Promise<DeltDashbord[]> {
  const rader = await db.dashboard.findMany({
    where: {
      // Egne dashbord hører ikke hjemme i «delt med meg»
      userId: { not: userId },
      shares: {
        some: { OR: [{ userId }, { userId: null }] },
      },
    },
    include: {
      user: { select: { name: true } },
      shares: { select: { userId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return rader.map((d) => ({
    id: d.id,
    navn: d.name,
    eier: d.user?.name ?? "Bedriften",
    medHeleFirmaet: d.shares.some((s) => s.userId === null),
    antallWidgets: Array.isArray(d.layout) ? d.layout.length : 0,
  }));
}

export type Kollega = { id: string; navn: string; harTilgang: boolean };

/** Kollegene du kan dele med, og hvem som allerede har fått. */
export async function delingsStatus(
  db: TenantDb,
  userId: string,
): Promise<{ kolleger: Kollega[]; heleFirmaet: boolean; harEget: boolean }> {
  const [eget, andre] = await Promise.all([
    db.dashboard.findFirst({
      where: { userId },
      include: { shares: { select: { userId: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { isActive: true, id: { not: userId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const delt = new Set(eget?.shares.map((s) => s.userId) ?? []);

  return {
    harEget: Boolean(eget),
    heleFirmaet: delt.has(null),
    kolleger: andre.map((u) => ({
      id: u.id,
      navn: u.name,
      harTilgang: delt.has(u.id),
    })),
  };
}
