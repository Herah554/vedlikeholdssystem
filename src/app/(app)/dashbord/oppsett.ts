import type { TenantDb } from "@/lib/tenant";
import {
  MAKS_BREDDE,
  MAKS_HOYDE,
  WIDGET_KATALOG,
  type Bredde,
  type Hoyde,
  type WidgetOppsett,
  type WidgetType,
} from "@/components/widget-katalog";
import { fyllUtPlassering } from "@/lib/plassering";

const KATALOG = new Map(WIDGET_KATALOG.map((w) => [w.type as string, w]));

/** Klemmer et tall inn i et lovlig intervall og runder av. */
function iOmraade(verdi: unknown, maks: number, standard: number): number {
  const n = Math.round(Number(verdi));
  if (!Number.isFinite(n)) return standard;
  return Math.min(maks, Math.max(1, n));
}

/**
 * Leser dashbordoppsettet fra databasen.
 *
 * Oppsettet ligger som JSON, og JSON i en database kan inneholde hva som
 * helst — for eksempel en widget-type som er fjernet i en senere versjon,
 * eller en bredde på 40 fra noen som redigerte forespørselen for hånd.
 * Derfor vaskes innholdet her i stedet for å stoles på blindt.
 *
 * Oppsett lagret før widgetene fikk høyde mangler feltet. De får høyden
 * widgeten har som standard, slik at gamle dashbord ser riktige ut uten at
 * noen må røre dem.
 */
export function tolkOppsett(rå: unknown): WidgetOppsett[] | null {
  if (!Array.isArray(rå)) return null;

  const rensket = rå.flatMap((element, i): WidgetOppsett[] => {
    if (!element || typeof element !== "object") return [];
    const o = element as Record<string, unknown>;
    if (typeof o.type !== "string") return [];

    const meta = KATALOG.get(o.type);
    if (!meta) return [];

    // x og y er valgfrie i det lagrede oppsettet. Mangler de, er dette et
    // dashbord fra før fri plassering fantes, og fyllUtPlassering() legger
    // dem ut i samme flyt som rutenettet hadde da.
    const harX = typeof o.x === "number" && Number.isFinite(o.x);
    const harY = typeof o.y === "number" && Number.isFinite(o.y);

    return [
      {
        id: typeof o.id === "string" ? o.id : `w${i}`,
        type: o.type as WidgetType,
        w: iOmraade(o.w, MAKS_BREDDE, meta.bredde) as Bredde,
        h: iOmraade(o.h, MAKS_HOYDE, meta.hoyde) as Hoyde,
        ...(harX ? { x: Math.max(0, Math.round(Number(o.x))) } : {}),
        ...(harY ? { y: Math.max(0, Math.round(Number(o.y))) } : {}),
      } as WidgetOppsett,
    ];
  });

  if (rensket.length === 0) return null;

  // Løser opp overlapp og fjerner hull, uansett hva som sto lagret.
  return fyllUtPlassering(rensket);
}

/**
 * Henter brukerens eget dashbord hvis hen har laget et,
 * ellers organisasjonens felles oppsett.
 */
export async function hentOppsett(
  db: TenantDb,
  userId: string,
): Promise<WidgetOppsett[] | null> {
  const eget = await db.dashboard.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (eget) return tolkOppsett(eget.layout);

  const felles = await db.dashboard.findFirst({
    where: { userId: null, isDefault: true },
  });
  return felles ? tolkOppsett(felles.layout) : null;
}
