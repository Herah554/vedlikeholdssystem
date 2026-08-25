"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/format";

export type Utstyrsvalg = {
  id: string;
  kode: string;
  navn: string;
  type: string;
  /** Nivå i anleggstreet, brukes til innrykk */
  dybde: number;
};

/**
 * Søkbar velger for utstyr.
 *
 * En vanlig nedtrekksliste fungerer til femten enheter. En kunde med et ekte
 * anlegg har fem hundre, og da er lista ubrukelig — særlig på en telefon ute i
 * hallen, som er nettopp der en feil meldes.
 *
 * Det søkes i både kode og navn, fordi folk husker det ene eller det andre:
 * noen leter etter «PU-101», andre etter «matepumpe».
 */
export function Utstyrsvelger({
  utstyr,
  navn = "assetId",
  start,
  etikett = "Utstyr",
  hint,
}: {
  utstyr: Utstyrsvalg[];
  navn?: string;
  start?: string;
  etikett?: string;
  hint?: string;
}) {
  const [valgt, settValgt] = useState<string>(start ?? "");
  const [sok, settSok] = useState("");
  const [apen, settApen] = useState(false);
  const [merket, settMerket] = useState(0);
  const boks = useRef<HTMLDivElement>(null);
  const listeId = useId();

  const valgtEnhet = utstyr.find((u) => u.id === valgt);

  const treff = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return utstyr.slice(0, 50);

    return utstyr
      .filter(
        (u) =>
          u.kode.toLowerCase().includes(q) || u.navn.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [sok, utstyr]);

  function velg(id: string) {
    settValgt(id);
    settApen(false);
    settSok("");
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      settApen(true);
      settMerket((m) => Math.min(m + 1, treff.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      settMerket((m) => Math.max(m - 1, 0));
    } else if (e.key === "Enter" && apen) {
      e.preventDefault();
      const t = treff[merket];
      if (t) velg(t.id);
    } else if (e.key === "Escape") {
      settApen(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-tekst">{etikett}</span>

      {/* Verdien som faktisk sendes inn. Selve søkefeltet har ikke navn,
          slik at et halvskrevet søk aldri havner i skjemaet. */}
      <input type="hidden" name={navn} value={valgt} />

      <div ref={boks} className="relative">
        {valgtEnhet ? (
          <div className="flex items-center gap-2 rounded-lg bg-flate px-3 py-2 ring-1 ring-kant-sterk ring-inset">
            <Check
              className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm text-tekst">
              <span className="font-medium">{valgtEnhet.kode}</span>
              <span className="text-tekst-svak"> · {valgtEnhet.navn}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                settValgt("");
                settApen(true);
              }}
              className="rounded-md p-1 text-tekst-svak hover:text-tekst"
              aria-label="Velg annet utstyr"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tekst-svakest"
              aria-hidden
            />
            <input
              type="text"
              role="combobox"
              aria-expanded={apen}
              aria-controls={listeId}
              aria-autocomplete="list"
              value={sok}
              onChange={(e) => {
                settSok(e.target.value);
                settApen(true);
                settMerket(0);
              }}
              onFocus={() => settApen(true)}
              onBlur={() => window.setTimeout(() => settApen(false), 150)}
              onKeyDown={tastetrykk}
              placeholder="Søk på kode eller navn …"
              className="w-full rounded-lg bg-flate py-2 pr-9 pl-9 text-sm text-tekst ring-1 ring-kant-sterk ring-inset placeholder:text-tekst-svakest focus:ring-2 focus:ring-merke-500"
            />
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tekst-svakest"
              aria-hidden
            />
          </div>
        )}

        {apen && !valgtEnhet && (
          <ul
            id={listeId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-flate py-1 shadow-lg ring-1 ring-kant-sterk"
          >
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => velg("")}
                className="w-full px-3 py-2 text-left text-sm text-tekst-svak hover:bg-flate-hover"
              >
                Ikke knyttet til utstyr
              </button>
            </li>

            {treff.length === 0 ? (
              <li className="px-3 py-3 text-sm text-tekst-svak">
                Fant ingenting som passer «{sok}».
              </li>
            ) : (
              treff.map((u, i) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === merket}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => settMerket(i)}
                    onClick={() => velg(u.id)}
                    className={cn(
                      "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm",
                      i === merket ? "bg-flate-hover" : "",
                    )}
                    style={{ paddingLeft: `${0.75 + u.dybde * 0.75}rem` }}
                  >
                    <span className="font-mono text-xs text-tekst-svakest">
                      {u.kode}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-tekst">
                      {u.navn}
                    </span>
                    <span className="shrink-0 text-xs text-tekst-svakest">
                      {u.type}
                    </span>
                  </button>
                </li>
              ))
            )}

            {utstyr.length > treff.length && sok.trim() === "" && (
              <li className="px-3 py-2 text-xs text-tekst-svak">
                Viser de {treff.length} første av {utstyr.length}. Skriv for å
                søke.
              </li>
            )}
          </ul>
        )}
      </div>

      {hint && <p className="text-sm text-tekst-svak">{hint}</p>}
    </div>
  );
}
