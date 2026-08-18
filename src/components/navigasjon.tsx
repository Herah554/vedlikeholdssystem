"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Network,
  Repeat2,
  Settings,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Hovedmenyen. Rekkefølgen følger arbeidsdagen til en tekniker:
 * først oversikt, så dagens jobber, så det man slår opp i.
 */
const LENKER = [
  { href: "/dashbord", tekst: "Dashbord", ikon: LayoutDashboard },
  { href: "/ukeplan", tekst: "Ukeplan", ikon: CalendarDays },
  { href: "/arbeidsordre", tekst: "Arbeidsordre", ikon: ClipboardList },
  { href: "/assistent", tekst: "Assistent", ikon: MessageSquareText },
  { href: "/anlegg", tekst: "Anlegg", ikon: Network },
  { href: "/reservedeler", tekst: "Reservedeler", ikon: Boxes },
  { href: "/forebyggende", tekst: "Forebyggende", ikon: Repeat2 },
  { href: "/budsjett", tekst: "Budsjett", ikon: Wallet },
  { href: "/rapporter", tekst: "Rapporter", ikon: ChartNoAxesCombined },
  { href: "/innstillinger", tekst: "Innstillinger", ikon: Settings },
] as const;

function Lenker({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {LENKER.map(({ href, tekst, ikon: Ikon }) => {
        // "/arbeidsordre/42" skal også markere "Arbeidsordre" som aktiv
        const aktiv = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              aktiv
                ? "bg-merke-50 text-merke-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Ikon className="size-4 shrink-0" aria-hidden />
            {tekst}
          </Link>
        );
      })}
    </nav>
  );
}

function Merke({ organisasjon }: { organisasjon: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-merke-600 text-white">
        <Wrench className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {organisasjon}
        </p>
        <p className="text-xs text-slate-500">Vedlikehold</p>
      </div>
    </div>
  );
}

/** Fast sidemeny på store skjermer. */
export function Sidemeny({ organisasjon }: { organisasjon: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <Merke organisasjon={organisasjon} />
      <Lenker />
    </aside>
  );
}

/** Uttrekkbar meny på nettbrett og mobil. */
export function MobilMeny({ organisasjon }: { organisasjon: string }) {
  const [åpen, settÅpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => settÅpen(true)}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Åpne meny"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {åpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => settÅpen(false)}
            aria-label="Lukk meny"
          />
          <div className="relative flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200">
              <div className="min-w-0 flex-1">
                <Merke organisasjon={organisasjon} />
              </div>
              <button
                type="button"
                onClick={() => settÅpen(false)}
                className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Lukk meny"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <Lenker onNavigate={() => settÅpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
