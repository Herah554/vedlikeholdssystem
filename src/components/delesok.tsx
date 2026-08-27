"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Package, Search, X } from "lucide-react";
import { cn } from "@/lib/format";
import { tall } from "@/lib/format";
import type { Deletreff } from "@/app/(app)/reservedeler/behov-actions";

/**
 * Søkefelt for reservedeler.
 *
 * Erstatter nedtrekkslista som inneholdt hele delelageret. Den fungerte til
 * hundre deler; ved tusen er den ubrukelig, og tusen deler er det normale
 * hos dem systemet skal selges til. Her spørres databasen mens man skriver,
 * så sida laster like fort uansett hvor stort lageret er.
 *
 * Valget legges i et skjult felt, slik at skjemaet rundt fortsatt er et
 * helt vanlig skjema som sender inn et delenummer.
 */

export function DeleSok({
  navn,
  sok,
  label = "Reservedel",
  paavalgt,
  visBeholdning = true,
}: {
  /** Navnet det valgte delenummeret sendes inn under. */
  navn: string;
  sok: (tekst: string) => Promise<Deletreff[]>;
  label?: string;
  /** Kalles når valget endrer seg, slik at skjemaet rundt kan reagere. */
  paavalgt?: (del: Deletreff | null) => void;
  visBeholdning?: boolean;
}) {
  const [tekst, settTekst] = useState("");
  const [treff, settTreff] = useState<Deletreff[]>([]);
  const [leter, settLeter] = useState(false);
  const [valgt, settValgt] = useState<Deletreff | null>(null);
  const [markert, settMarkert] = useState(0);
  const [apen, settApen] = useState(false);

  const listeId = useId();
  const boks = useRef<HTMLDivElement>(null);

  /**
   * Teller som gjør at et tregt søk ikke kan overskrive et ferskere.
   *
   * Uten den kan svaret på «pak» komme tilbake etter svaret på «pakning» og
   * legge de dårligere treffene øverst — en feil som bare viser seg på
   * treg linje, og som er nesten umulig å forstå når den gjør det.
   */
  const utgave = useRef(0);

  const q = tekst.trim();
  const forKort = q.length < 2;

  /**
   * Treffene som faktisk skal vises.
   *
   * Utledes framfor å nullstilles i effekten. Å kalle setState rett i en
   * effekt gir en ekstra gjengivelse for hvert tastetrykk — og for et felt
   * man skriver i, er det nettopp der det merkes.
   */
  const synlige = valgt || forKort ? [] : treff;

  useEffect(() => {
    if (valgt || forKort) return;

    const min = (utgave.current += 1);

    // Venter til fingrene står stille. Uten dette blir det ett databasekall
    // per tastetrykk.
    const timer = setTimeout(async () => {
      settLeter(true);
      try {
        const svar = await sok(q);
        if (utgave.current !== min) return;
        settTreff(svar);
        settMarkert(0);
        settApen(true);
      } catch {
        if (utgave.current === min) settTreff([]);
      } finally {
        if (utgave.current === min) settLeter(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      settLeter(false);
    };
  }, [q, valgt, forKort, sok]);

  // Klikk utenfor lukker lista. Ellers blir den stående oppå resten av
  // skjemaet og dekker knappen man prøver å nå.
  useEffect(() => {
    if (!apen) return;
    function utenfor(e: MouseEvent) {
      if (boks.current && !boks.current.contains(e.target as Node)) {
        settApen(false);
      }
    }
    document.addEventListener("mousedown", utenfor);
    return () => document.removeEventListener("mousedown", utenfor);
  }, [apen]);

  function velg(del: Deletreff) {
    settValgt(del);
    settApen(false);
    settTekst("");
    settTreff([]);
    paavalgt?.(del);
  }

  function nullstill() {
    settValgt(null);
    settTekst("");
    settTreff([]);
    paavalgt?.(null);
  }

  if (valgt) {
    return (
      <div>
        <input type="hidden" name={navn} value={valgt.id} />
        <span className="mb-1.5 block text-sm font-medium text-tekst">{label}</span>
        <div className="flex items-start justify-between gap-3 rounded-lg border border-kant bg-flate-dempet px-3 py-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-tekst-svak">{valgt.number}</div>
            <div className="truncate text-sm font-medium text-tekst">{valgt.name}</div>
            {visBeholdning && (
              <div className="text-xs text-tekst-svak">
                {valgt.beholdning > 0
                  ? `${tall(valgt.beholdning)} ${valgt.unit} på lager`
                  : "Ikke på lager"}
                {valgt.leverandor ? ` · ${valgt.leverandor}` : ""}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={nullstill}
            className="shrink-0 rounded p-1 text-tekst-svak hover:bg-flate hover:text-tekst"
            aria-label="Velg en annen del"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boks} className="relative">
      <label
        htmlFor={`${listeId}-felt`}
        className="mb-1.5 block text-sm font-medium text-tekst"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tekst-svakest"
          aria-hidden
        />
        <input
          id={`${listeId}-felt`}
          type="text"
          value={tekst}
          onChange={(e) => settTekst(e.target.value)}
          onFocus={() => synlige.length > 0 && settApen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              settApen(true);
              settMarkert((i) => Math.min(i + 1, synlige.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              settMarkert((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && apen && synlige[markert]) {
              // Uten dette ville Enter sendt inn skjemaet med tom del
              e.preventDefault();
              velg(synlige[markert]);
            } else if (e.key === "Escape") {
              settApen(false);
            }
          }}
          role="combobox"
          aria-expanded={apen}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Søk på navn, delenummer eller fabrikat …"
          className="w-full min-h-11 rounded-lg border border-kant bg-flate py-2 pr-9 pl-9 text-sm text-tekst placeholder:text-tekst-svakest focus:border-aksent focus:ring-2 focus:ring-aksent/30 focus:outline-none"
        />
        {leter && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-tekst-svakest"
            aria-hidden
          />
        )}
      </div>

      {apen && (
        <ul
          id={listeId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-kant bg-flate shadow-lg"
        >
          {synlige.length === 0 ? (
            <li className="px-3 py-3 text-sm text-tekst-svak">
              Ingen deler passer på «{q}».
            </li>
          ) : (
            synlige.map((d, i) => (
              <li key={d.id} role="option" aria-selected={i === markert}>
                <button
                  type="button"
                  onClick={() => velg(d)}
                  onMouseEnter={() => settMarkert(i)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                    i === markert ? "bg-flate-dempet" : "",
                  )}
                >
                  <Package
                    className="mt-0.5 size-4 shrink-0 text-tekst-svakest"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-tekst-svak">
                      {d.number}
                    </span>
                    <span className="block truncate text-sm text-tekst">{d.name}</span>
                  </span>
                  {visBeholdning && (
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        d.beholdning > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {d.beholdning > 0 ? `${tall(d.beholdning)} ${d.unit}` : "tomt"}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
