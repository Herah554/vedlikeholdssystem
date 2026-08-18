import type { TenantDb } from "@/lib/tenant";
import { WIDGET_KATALOG, type WidgetOppsett, type WidgetType } from "@/components/widget-katalog";

const GYLDIGE_TYPER = new Set<string>(WIDGET_KATALOG.map((w) => w.type));

/**
 * Leser dashbordoppsettet fra databasen.
 *
 * Oppsettet ligger som JSON, og JSON i en database kan inneholde hva som
 * helst — for eksempel en widget-type som er fjernet i en senere versjon.
 * Derfor vaskes innholdet her i stedet for å stoles på blindt.
 */
export function tolkOppsett(rå: unknown): WidgetOppsett[] | null {
  if (!Array.isArray(rå)) return null;

  const rensket = rå.flatMap((element, i): WidgetOppsett[] => {
    if (!element || typeof element !== "object") return [];
    const o = element as Record<string, unknown>;
    if (typeof o.type !== "string" || !GYLDIGE_TYPER.has(o.type)) return [];

    return [
      {
        id: typeof o.id === "string" ? o.id : `w${i}`,
        type: o.type as WidgetType,
        w: o.w === 2 ? 2 : 1,
      },
    ];
  });

  return rensket.length ? rensket : null;
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
