import type {
  AssetStatus,
  AssetType,
  BudgetCategory,
  PmTrigger,
  PurchaseOrderStatus,
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
  MELDT: { tekst: "Meldt", klasse: "bg-flate-dempet text-tekst ring-kant" },
  GODKJENT: { tekst: "Godkjent", klasse: "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30" },
  PLANLAGT: { tekst: "Planlagt", klasse: "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-500/30" },
  PAAGAAR: { tekst: "Pågår", klasse: "bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30" },
  VENTER_DELER: { tekst: "Venter på deler", klasse: "bg-orange-100 dark:bg-orange-500/15 text-orange-900 dark:text-orange-300 ring-orange-200 dark:ring-orange-500/30" },
  UTFORT: { tekst: "Utført", klasse: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30" },
  LUKKET: { tekst: "Lukket", klasse: "bg-flate-dempet text-tekst-svak ring-kant-sterk" },
  AVVIST: { tekst: "Avvist", klasse: "bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-rose-200 dark:ring-rose-500/30" },
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
  HOY: { tekst: "Høy", klasse: "bg-orange-100 dark:bg-orange-500/15 text-orange-900 dark:text-orange-300 ring-orange-300 dark:ring-orange-500/30" },
  NORMAL: { tekst: "Normal", klasse: "bg-flate-dempet text-tekst ring-kant" },
  LAV: { tekst: "Lav", klasse: "bg-flate-hover text-tekst-svak ring-kant" },
};

export const PRIORITET_REKKEFOLGE: Priority[] = ["KRITISK", "HOY", "NORMAL", "LAV"];

export const ORDRE_TYPE: Record<WorkOrderType, Etikett> = {
  KORREKTIV: { tekst: "Korrektiv", klasse: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-500/30" },
  FOREBYGGENDE: { tekst: "Forebyggende", klasse: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30" },
  INSPEKSJON: { tekst: "Inspeksjon", klasse: "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30" },
  FORBEDRING: { tekst: "Forbedring", klasse: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-500/30" },
};

export const ANLEGG_TYPE: Record<AssetType, string> = {
  ANLEGG: "Anlegg",
  SYSTEM: "System",
  UTSTYR: "Utstyr",
  KOMPONENT: "Komponent",
};

export const ANLEGG_STATUS: Record<AssetStatus, Etikett> = {
  I_DRIFT: { tekst: "I drift", klasse: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30" },
  STANSET: { tekst: "Stanset", klasse: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30" },
  UNDER_VEDLIKEHOLD: { tekst: "Under vedlikehold", klasse: "bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30" },
  UTRANGERT: { tekst: "Utrangert", klasse: "bg-flate-dempet text-tekst-svak ring-kant-sterk" },
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
  1: { tekst: "Ubetydelig", klasse: "bg-flate-dempet text-tekst-svak" },
  2: { tekst: "Liten", klasse: "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  3: { tekst: "Middels", klasse: "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  4: { tekst: "Høy", klasse: "bg-orange-100 dark:bg-orange-500/15 text-orange-900 dark:text-orange-300" },
  5: { tekst: "Kritisk", klasse: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300" },
};

export const BESTILLING_STATUS: Record<PurchaseOrderStatus, Etikett> = {
  UTKAST: {
    tekst: "Utkast",
    klasse: "bg-flate-dempet text-tekst-svak ring-kant",
  },
  SENDT: {
    tekst: "Sendt",
    klasse:
      "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  },
  DELVIS_MOTTATT: {
    tekst: "Delvis mottatt",
    klasse:
      "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  },
  MOTTATT: {
    tekst: "Mottatt",
    klasse:
      "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  },
  KANSELLERT: {
    tekst: "Kansellert",
    klasse:
      "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  },
};

/** Bestillinger som fortsatt venter på noe. */
export const APNE_BESTILLINGER: PurchaseOrderStatus[] = [
  "UTKAST",
  "SENDT",
  "DELVIS_MOTTATT",
];
