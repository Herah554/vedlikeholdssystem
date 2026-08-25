"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/format";

export type Tema = "lys" | "mork" | "system";

const KAPSEL = "tema";

/**
 * Temaet ligger i en informasjonskapsel, ikke i localStorage.
 *
 * Grunnen er at serveren må kjenne valget når den lager HTML-en. Leser vi det
 * først i nettleseren, rekker siden å bli tegnet lys før JavaScript slår inn,
 * og brukeren får et hvitt glimt i ansiktet hver gang hen laster en side i
 * mørkt tema.
 */
function skrivKapsel(tema: Tema) {
  const etAr = 60 * 60 * 24 * 365;
  document.cookie = `${KAPSEL}=${tema}; path=/; max-age=${etAr}; samesite=lax`;
}

/** Setter klassen på <html> med én gang, uten å laste siden på nytt. */
function bruk(tema: Tema) {
  const el = document.documentElement;
  el.classList.remove("lys", "dark");
  if (tema === "lys") el.classList.add("lys");
  if (tema === "mork") el.classList.add("dark");
}

const VALG: { verdi: Tema; navn: string; ikon: typeof Sun }[] = [
  { verdi: "lys", navn: "Lyst", ikon: Sun },
  { verdi: "mork", navn: "Mørkt", ikon: Moon },
  { verdi: "system", navn: "Følg systemet", ikon: Monitor },
];

export function TemaVelger({ start }: { start: Tema }) {
  const [tema, settTema] = useState<Tema>(start);

  function velg(nytt: Tema) {
    settTema(nytt);
    skrivKapsel(nytt);
    bruk(nytt);
  }

  return (
    <div
      role="group"
      aria-label="Fargetema"
      className="flex items-center gap-0.5 rounded-lg bg-flate-dempet p-0.5"
    >
      {VALG.map(({ verdi, navn, ikon: Ikon }) => (
        <button
          key={verdi}
          type="button"
          onClick={() => velg(verdi)}
          title={navn}
          aria-pressed={tema === verdi}
          className={cn(
            // 44 piksler er minstemålet for noe som skal treffes med en
            // finger. På store skjermer holder det med mindre, siden en
            // musepeker er nøyaktig.
            "flex size-11 items-center justify-center rounded-md transition-colors sm:size-auto sm:p-1.5",
            tema === verdi
              ? "bg-flate text-tekst shadow-sm"
              : "text-tekst-svak hover:text-tekst",
          )}
        >
          <Ikon className="size-4" aria-hidden />
          <span className="sr-only">{navn}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Forteller om det mørke temaet er aktivt akkurat nå.
 *
 * Diagrammene trenger konkrete fargeverdier — SVG-attributter regner ikke ut
 * CSS-variabler — så de må vite hvilket tema som gjelder. Kroken lytter både
 * på klassen som temavelgeren setter og på operativsystemets innstilling.
 */
export function useErMorkt(): boolean {
  const [morkt, settMorkt] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const beregn = () => {
      if (el.classList.contains("dark")) return true;
      if (el.classList.contains("lys")) return false;
      return mq.matches;
    };

    const oppdater = () => settMorkt(beregn());
    oppdater();

    const obs = new MutationObserver(oppdater);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    mq.addEventListener("change", oppdater);

    return () => {
      obs.disconnect();
      mq.removeEventListener("change", oppdater);
    };
  }, []);

  return morkt;
}
