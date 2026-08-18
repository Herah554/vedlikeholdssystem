import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Slår sammen Tailwind-klasser og lar senere klasser overstyre tidligere. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const nb = "nb-NO";

/** 12 500 kr */
export function kroner(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return new Intl.NumberFormat(nb, {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(n);
}

/** 12 500,50 */
export function tall(
  value: number | string | null | undefined,
  desimaler = 0,
): string {
  return new Intl.NumberFormat(nb, {
    minimumFractionDigits: desimaler,
    maximumFractionDigits: desimaler,
  }).format(toNumber(value));
}

/** 18. aug. 2026 */
export function dato(value: Date | string | null | undefined): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(nb, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/** 18. aug. 2026, 21:44 */
export function datoTid(value: Date | string | null | undefined): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(nb, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "for 3 dager siden", "om 2 uker" */
export function relativTid(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const ms = new Date(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(nb, { numeric: "auto" });

  const enheter: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600_000],
    ["month", 30 * 24 * 3600_000],
    ["week", 7 * 24 * 3600_000],
    ["day", 24 * 3600_000],
    ["hour", 3600_000],
    ["minute", 60_000],
  ];

  for (const [enhet, lengde] of enheter) {
    if (Math.abs(ms) >= lengde) {
      return rtf.format(Math.round(ms / lengde), enhet);
    }
  }
  return "nå nettopp";
}

/** 2 t 30 min */
export function timer(value: number | null | undefined): string {
  if (value == null) return "–";
  const t = Math.floor(value);
  const m = Math.round((value - t) * 60);
  if (t === 0) return `${m} min`;
  if (m === 0) return `${t} t`;
  return `${t} t ${m} min`;
}

/** ISO-ukenummer, brukt i ukeplanen. */
export function ukeNummer(d: Date): number {
  const dato = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  );
  // Torsdag i inneværende uke avgjør hvilket år uka tilhører
  const ukedag = dato.getUTCDay() || 7;
  dato.setUTCDate(dato.getUTCDate() + 4 - ukedag);
  const nyttår = new Date(Date.UTC(dato.getUTCFullYear(), 0, 1));
  return Math.ceil(((dato.getTime() - nyttår.getTime()) / 86400000 + 1) / 7);
}

/**
 * Prisma leverer Decimal-felter som objekter, ikke tall.
 * Denne gjør om alt til et vanlig JavaScript-tall.
 */
export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  if (typeof value === "object" && "toString" in value) {
    return Number.parseFloat(String(value)) || 0;
  }
  return 0;
}

/** AO-1042 */
export function ordreNummer(n: number): string {
  return `AO-${String(n).padStart(4, "0")}`;
}
