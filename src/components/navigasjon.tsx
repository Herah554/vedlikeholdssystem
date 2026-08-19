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
  SlidersHorizontal,
  ShoppingCart,
  Truck,
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
  { href: "/bestillinger", tekst: "Bestillinger", ikon: ShoppingCart },
  { href: "/leverandorer", tekst: "Leverandører", ikon: Truck },
  { href: "/forebyggende", tekst: "Forebyggende", ikon: Repeat2 },
  { href: "/budsjett", tekst: "Budsjett", ikon: Wallet },
  { href: "/rapporter", tekst: "Rapporter", ikon: ChartNoAxesCombined },
  { href: "/oppsett", tekst: "Oppsett", ikon: SlidersHorizontal },
  { href: "/innstillinger", tekst: "Innstillinger", ikon: Settings },
] as const;

/**
 * Menyen viser bare det rollen har lov til å åpne.
 *
 * Dette er ikke sikkerheten — den ligger i server-handlingene og på hver side.
 * Men en meny full av lenker som gir avvisning er et dårlig arbeidsverktøy.
 */
function Lenker({
  synlige,
  onNavigate,
}: {
  synlige: readonly string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const tillatt = new Set(synlige);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {LENKER.filter((l) => tillatt.has(l.href)).map(({ href, tekst, ikon: Ikon }) => {
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
                ? "bg-merke-50 text-aksent"
                : "text-tekst-svak hover:bg-flate-dempet hover:text-tekst",
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
    <div className="flex items-center gap-2.5 border-b border-kant px-5 py-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-merke-600 text-white">
        <Wrench className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-tekst">
          {organisasjon}
        </p>
        <p className="text-xs text-tekst-svak">Vedlikehold</p>
      </div>
    </div>
  );
}

/** Fast sidemeny på store skjermer. */
export function Sidemeny({
  organisasjon,
  synlige,
}: {
  organisasjon: string;
  synlige: readonly string[];
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-kant bg-flate lg:flex">
      <Merke organisasjon={organisasjon} />
      <Lenker synlige={synlige} />
    </aside>
  );
}

/** Uttrekkbar meny på nettbrett og mobil. */
export function MobilMeny({
  organisasjon,
  synlige,
}: {
  organisasjon: string;
  synlige: readonly string[];
}) {
  const [åpen, settÅpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => settÅpen(true)}
        className="rounded-lg p-2 text-tekst-svak hover:bg-flate-dempet lg:hidden"
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
          <div className="relative flex h-full w-64 flex-col bg-flate shadow-xl">
            <div className="flex items-center justify-between border-b border-kant">
              <div className="min-w-0 flex-1">
                <Merke organisasjon={organisasjon} />
              </div>
              <button
                type="button"
                onClick={() => settÅpen(false)}
                className="mr-3 rounded-lg p-2 text-tekst-svak hover:bg-flate-dempet"
                aria-label="Lukk meny"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <Lenker synlige={synlige} onNavigate={() => settÅpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
