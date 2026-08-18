import type {
  AssetStatus,
  AssetType,
  BudgetCategory,
  PmTrigger,
  Priority,
  Role,
  StockMovementType,
  WorkOrderStatus,
  WorkOrderType,
} from "@/generated/prisma/client";

/**
 * Databasen lagrer engelske enum-verdier, men brukeren skal se norsk tekst.
 * All oversetting og fargesetting samles her, slik at et statusnavn ser likt
 * ut uansett hvor i systemet det vises.
 */

type Etikett = { tekst: string; klasse: string };

export const ORDRE_STATUS: Record<WorkOrderStatus, Etikett> = {
  MELDT: { tekst: "Meldt", klasse: "bg-slate-100 text-slate-700 ring-slate-200" },
  GODKJENT: { tekst: "Godkjent", klasse: "bg-sky-100 text-sky-800 ring-sky-200" },
  PLANLAGT: { tekst: "Planlagt", klasse: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  PAAGAAR: { tekst: "Pågår", klasse: "bg-amber-100 text-amber-900 ring-amber-200" },
  VENTER_DELER: { tekst: "Venter på deler", klasse: "bg-orange-100 text-orange-900 ring-orange-200" },
  UTFORT: { tekst: "Utført", klasse: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  LUKKET: { tekst: "Lukket", klasse: "bg-slate-200 text-slate-600 ring-slate-300" },
  AVVIST: { tekst: "Avvist", klasse: "bg-rose-100 text-rose-800 ring-rose-200" },
};

/** Statuser der jobben regnes som avsluttet. */
export const AVSLUTTEDE_STATUSER: WorkOrderStatus[] = ["UTFORT", "LUKKET", "AVVIST"];

/** Statuser der jobben fortsatt krever oppfølging. */
export const APNE_STATUSER: WorkOrderStatus[] = [
  "MELDT",
  "GODKJENT",
  "PLANLAGT",
  "PAAGAAR",
  "VENTER_DELER",
];

/**
 * Lovlige neste steg i arbeidsflyten. Hindrer at en ordre hopper fra
 * "Meldt" rett til "Lukket" uten å ha vært innom utførelse.
 */
export const NESTE_STATUS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  MELDT: ["GODKJENT", "AVVIST"],
  GODKJENT: ["PLANLAGT", "PAAGAAR", "AVVIST"],
  PLANLAGT: ["PAAGAAR", "GODKJENT", "AVVIST"],
  PAAGAAR: ["VENTER_DELER", "UTFORT"],
  VENTER_DELER: ["PAAGAAR", "UTFORT"],
  UTFORT: ["LUKKET", "PAAGAAR"],
  LUKKET: [],
  AVVIST: ["MELDT"],
};

export const PRIORITET: Record<Priority, Etikett> = {
  KRITISK: { tekst: "Kritisk", klasse: "bg-red-600 text-white ring-red-700" },
  HOY: { tekst: "Høy", klasse: "bg-orange-100 text-orange-900 ring-orange-300" },
  NORMAL: { tekst: "Normal", klasse: "bg-slate-100 text-slate-700 ring-slate-200" },
  LAV: { tekst: "Lav", klasse: "bg-slate-50 text-slate-500 ring-slate-200" },
};

export const PRIORITET_REKKEFOLGE: Priority[] = ["KRITISK", "HOY", "NORMAL", "LAV"];

export const ORDRE_TYPE: Record<WorkOrderType, Etikett> = {
  KORREKTIV: { tekst: "Korrektiv", klasse: "bg-rose-50 text-rose-700 ring-rose-200" },
  FOREBYGGENDE: { tekst: "Forebyggende", klasse: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  INSPEKSJON: { tekst: "Inspeksjon", klasse: "bg-sky-50 text-sky-700 ring-sky-200" },
  FORBEDRING: { tekst: "Forbedring", klasse: "bg-violet-50 text-violet-700 ring-violet-200" },
};

export const ANLEGG_TYPE: Record<AssetType, string> = {
  ANLEGG: "Anlegg",
  SYSTEM: "System",
  UTSTYR: "Utstyr",
  KOMPONENT: "Komponent",
};

export const ANLEGG_STATUS: Record<AssetStatus, Etikett> = {
  I_DRIFT: { tekst: "I drift", klasse: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  STANSET: { tekst: "Stanset", klasse: "bg-red-100 text-red-800 ring-red-200" },
  UNDER_VEDLIKEHOLD: { tekst: "Under vedlikehold", klasse: "bg-amber-100 text-amber-900 ring-amber-200" },
  UTRANGERT: { tekst: "Utrangert", klasse: "bg-slate-200 text-slate-600 ring-slate-300" },
};

export const ROLLE: Record<Role, string> = {
  ADMIN: "Administrator",
  LEDER: "Leder",
  PLANLEGGER: "Planlegger",
  TEKNIKER: "Tekniker",
  GJEST: "Gjest",
};

export const ROLLE_BESKRIVELSE: Record<Role, string> = {
  ADMIN: "Full tilgang, kan administrere brukere og innstillinger",
  LEDER: "Ser alt, godkjenner arbeid og eier budsjettet",
  PLANLEGGER: "Planlegger arbeid og forebyggende vedlikehold",
  TEKNIKER: "Utfører arbeid, fører timer og tar ut deler",
  GJEST: "Kun lesetilgang",
};

export const LAGER_BEVEGELSE: Record<StockMovementType, string> = {
  INN: "Innkjøp",
  UT: "Uttak",
  JUSTERING: "Justering",
};

export const PM_UTLOSER: Record<PmTrigger, string> = {
  TID: "Fast intervall (dager)",
  DRIFTSTIMER: "Driftstimer",
};

export const BUDSJETT_KATEGORI: Record<BudgetCategory, string> = {
  ARBEID: "Arbeid",
  DELER: "Deler",
  TJENESTER: "Innleide tjenester",
  TOTALT: "Totalt",
};

/** 1–5, der 5 er mest kritisk for driften. */
export const KRITIKALITET: Record<number, Etikett> = {
  1: { tekst: "Ubetydelig", klasse: "bg-slate-100 text-slate-600" },
  2: { tekst: "Liten", klasse: "bg-sky-100 text-sky-700" },
  3: { tekst: "Middels", klasse: "bg-amber-100 text-amber-800" },
  4: { tekst: "Høy", klasse: "bg-orange-100 text-orange-900" },
  5: { tekst: "Kritisk", klasse: "bg-red-100 text-red-800" },
};
