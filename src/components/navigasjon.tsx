"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  FileSpreadsheet,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Network,
  Repeat2,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  ShoppingCart,
  Truck,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Hovedmenyen, delt i bolker.
 *
 * Femten lenker på rad blir en vegg. Bolkene følger hva man holder på med —
 * dagens arbeid øverst, det man slår opp i under, og administrasjon nederst
 * fordi man er der sjelden.
 *
 * Dashbordet står alene uten overskrift. Det er inngangen, ikke en av
 * kategoriene.
 */
const BOLKER = [
  {
    navn: null,
    lenker: [{ href: "/dashbord", tekst: "Dashbord", ikon: LayoutDashboard }],
  },
  {
    navn: "Arbeid",
    lenker: [
      { href: "/ukeplan", tekst: "Ukeplan", ikon: CalendarDays },
      { href: "/arbeidsordre", tekst: "Arbeidsordre", ikon: ClipboardList },
      { href: "/forebyggende", tekst: "Forebyggende", ikon: Repeat2 },
      { href: "/avvik", tekst: "Avvik", ikon: ShieldAlert },
    ],
  },
  {
    navn: "Anlegg og deler",
    lenker: [
      { href: "/anlegg", tekst: "Anlegg", ikon: Network },
      { href: "/reservedeler", tekst: "Reservedeler", ikon: Boxes },
      { href: "/bestillinger", tekst: "Bestillinger", ikon: ShoppingCart },
      { href: "/leverandorer", tekst: "Leverandører", ikon: Truck },
    ],
  },
  {
    navn: "Oppfølging",
    lenker: [
      { href: "/rapporter", tekst: "Rapporter", ikon: ChartNoAxesCombined },
      { href: "/budsjett", tekst: "Budsjett", ikon: Wallet },
      { href: "/assistent", tekst: "Assistent", ikon: MessageSquareText },
    ],
  },
  {
    navn: "Administrasjon",
    lenker: [
      { href: "/import", tekst: "Import", ikon: FileSpreadsheet },
      { href: "/oppsett", tekst: "Oppsett", ikon: SlidersHorizontal },
      { href: "/innstillinger", tekst: "Innstillinger", ikon: Settings },
    ],
  },
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

  // En bolk der alt er stengt av planen eller rollen skal ikke etterlate
  // en overskrift som svever over ingenting.
  const bolker = BOLKER.map((b) => ({
    ...b,
    lenker: b.lenker.filter((l) => tillatt.has(l.href)),
  })).filter((b) => b.lenker.length > 0);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {bolker.map((bolk, i) => (
        <div key={bolk.navn ?? "start"} className={i > 0 ? "mt-5" : undefined}>
          {bolk.navn && (
            <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-tekst-svakest uppercase">
              {bolk.navn}
            </p>
          )}

          <div className="space-y-0.5">
            {bolk.lenker.map(({ href, tekst, ikon: Ikon }) => {
              // "/arbeidsordre/42" skal også markere "Arbeidsordre" som aktiv
              const aktiv =
                pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={aktiv ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    aktiv
                      ? "bg-merke-50 text-aksent dark:bg-merke-500/15"
                      : "text-tekst-svak hover:bg-flate-dempet hover:text-tekst",
                  )}
                >
                  <Ikon className="size-4 shrink-0" aria-hidden />
                  {tekst}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
    // sticky + full skjermhøyde: menyen står stille mens innholdet ruller.
    // Uten dette forsvinner den oppover så snart siden er lengre enn skjermen,
    // og man må bla helt til topps for å komme seg videre.
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-start overflow-hidden border-r border-kant bg-flate lg:flex">
      <Merke organisasjon={organisasjon} />
      <Lenker synlige={synlige} />
    </aside>
  );
}

/**
 * Uttrekkbar meny på nettbrett og mobil.
 *
 * Panelet legges i document.body med en portal, ikke der knappen står. Det
 * ser omstendelig ut, men er nødvendig: knappen ligger inne i sidetoppen, og
 * sidetoppen har backdrop-blur. Et element med backdrop-filter blir
 * «containing block» for alt med position: fixed inni seg — så «fixed inset-0»
 * ble målt mot sidetoppen og ikke mot vinduet.
 *
 * Følgen var at hele menyen ble klemt inn i en stripe på 68 piksler: firmanavn
 * og lukkekryss så vidt synlig, ingen lenker, og innholdet bak ikke mørklagt.
 * På mobil satt man dermed helt uten meny og måtte bla seg fram.
 *
 * Fjerner noen backdrop-blur fra sidetoppen senere, virker dette fortsatt.
 */
export function MobilMeny({
  organisasjon,
  synlige,
}: {
  organisasjon: string;
  synlige: readonly string[];
}) {
  const [åpen, settÅpen] = useState(false);

  // Escape lukker, og siden bak skal ikke kunne rulle mens menyen dekker den
  useEffect(() => {
    if (!åpen) return;

    function tast(e: KeyboardEvent) {
      if (e.key === "Escape") settÅpen(false);
    }

    const forrige = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", tast);

    return () => {
      document.body.style.overflow = forrige;
      document.removeEventListener("keydown", tast);
    };
  }, [åpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => settÅpen(true)}
        className="flex size-11 items-center justify-center rounded-lg text-tekst-svak hover:bg-flate-dempet lg:hidden"
        aria-label="Åpne meny"
        aria-expanded={åpen}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {/* Panelet tegnes bare etter et klikk, altså aldri på serveren — derfor
          trengs ingen egen sjekk på at document finnes. */}
      {åpen &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => settÅpen(false)}
              aria-label="Lukk meny"
            />
            <div className="relative flex h-full w-64 max-w-[85vw] flex-col bg-flate shadow-xl">
              <div className="flex items-center justify-between border-b border-kant">
                <div className="min-w-0 flex-1">
                  <Merke organisasjon={organisasjon} />
                </div>
                <button
                  type="button"
                  onClick={() => settÅpen(false)}
                  className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-tekst-svak hover:bg-flate-dempet"
                  aria-label="Lukk meny"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <Lenker synlige={synlige} onNavigate={() => settÅpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
