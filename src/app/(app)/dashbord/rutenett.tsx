"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, Move, X } from "lucide-react";
import { cn } from "@/lib/format";
import {
  MAKS_BREDDE,
  MAKS_HOYDE,
  RAD_PIKSLER,
  WIDGET_KATALOG,
  type Bredde,
  type Hoyde,
  type WidgetOppsett,
} from "@/components/widget-katalog";
import { klemInn, pakk, ruteFraPunkt } from "@/lib/plassering";
import { lagreOppsett } from "./tilpass/actions";

/**
 * Dashbordrutenettet med fritt plasserbare widgets.
 *
 * Widgetene tegnes ferdig på serveren og sendes hit som barn. Denne
 * komponenten styrer bare hvor de ligger og hvor store de er — den vet
 * ingenting om hva den enkelte viser, og trenger derfor ingen databasetilgang.
 *
 * Plasseringen ligger i x og y på hver widget, ikke i rekkefølgen. Det er det
 * som gjør at man kan legge én i høyre hjørne og la det stå tomt til venstre.
 * Selve regnestykket for kollisjon og pakking ligger i src/lib/plassering.ts.
 *
 * Flytting og størrelse ligger bak en egen redigeringsmodus. Uten den ville
 * hvert forsøk på å dra en widget i stedet trykke på lenkene inni den.
 */

/** Mellomrommet mellom rutene, i piksler. Må stemme med gap-4 under. */
const MELLOMROM = 16;

type Draging = {
  id: string;
  /** Hvor i widgeten man tok tak, i ruter. Ellers ville den hoppet til musa. */
  grepX: number;
  grepY: number;
};

type Endring = {
  id: string;
  startX: number;
  startY: number;
  startW: Bredde;
  startH: Hoyde;
  kolonneBredde: number;
};

export function Rutenett({
  oppsett: start,
  widgets,
}: {
  oppsett: WidgetOppsett[];
  widgets: ReactNode[];
}) {
  const [oppsett, settOppsett] = useState<WidgetOppsett[]>(start);
  const [redigerer, settRedigerer] = useState(false);
  const [drar, settDrar] = useState<Draging | null>(null);
  const [endrer, settEndrer] = useState<Endring | null>(null);
  const [lagrer, startLagring] = useTransition();
  const [melding, settMelding] = useState<string>();
  const rutenett = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /**
   * Siste oppsett, tilgjengelig utenfor React sin gjengivelse.
   *
   * Når man slipper må vi lagre det som nettopp ble dratt fram. Å lese det ut
   * av en tilstandsoppdatering ville betydd å kalle en oppdatering inne i en
   * annen, og det gjør React med rette opprør mot.
   */
  const sisteOppsett = useRef<WidgetOppsett[]>(start);

  // Widgetene kom i samme rekkefølge som det opprinnelige oppsettet
  const innhold = new Map(start.map((w, i) => [w.id, widgets[i]]));

  const lagre = useCallback((nytt: WidgetOppsett[]) => {
    sisteOppsett.current = nytt;
    settOppsett(nytt);
    startLagring(async () => {
      const svar = await lagreOppsett(JSON.stringify(nytt));
      settMelding(svar.ok ? "Lagret" : svar.feil);
      if (svar.ok) setTimeout(() => settMelding(undefined), 2000);
    });
  }, []);

  /** Setter oppsettet uten å lagre. Brukes mens man drar. */
  function visMidlertidig(nytt: WidgetOppsett[]) {
    sisteOppsett.current = nytt;
    settOppsett(nytt);
  }

  /** Flytter én widget til en rute og rydder opp etter seg. */
  function flyttTil(id: string, x: number, y: number) {
    const nytt = pakk(
      sisteOppsett.current.map((w) =>
        w.id === id ? klemInn({ ...w, x, y }) : w,
      ),
      id,
    );

    // Ingen grunn til å tegne på nytt hvis ingenting flyttet seg
    const likt = nytt.every((n) => {
      const f = sisteOppsett.current.find((w) => w.id === n.id);
      return f && f.x === n.x && f.y === n.y;
    });
    if (likt) return;

    visMidlertidig(nytt);
  }

  function endreStorrelse(id: string, w: Bredde, h: Hoyde, lagreNaa: boolean) {
    const nytt = pakk(
      sisteOppsett.current.map((el) =>
        el.id === id ? klemInn({ ...el, w, h }) : el,
      ),
      id,
    );

    if (lagreNaa) lagre(nytt);
    else visMidlertidig(nytt);
  }

  function fjern(id: string) {
    if (oppsett.length <= 1) return;
    lagre(pakk(sisteOppsett.current.filter((w) => w.id !== id)));
    router.refresh();
  }

  /** Måler rutenettet én gang, ved starten av en draging. */
  function malRutenett() {
    const el = rutenett.current;
    if (!el) return null;

    const stil = getComputedStyle(el);
    const spor = stil.gridTemplateColumns
      .split(" ")
      .map(parseFloat)
      .filter(Number.isFinite);

    return {
      rect: el.getBoundingClientRect(),
      kolonner: spor.length,
      kolonneBredde: spor[0] + MELLOMROM,
    };
  }

  function startDraging(e: React.PointerEvent, w: WidgetOppsett) {
    if (!redigerer || endrer) return;

    const mal = malRutenett();
    // Under fire kolonner ligger widgetene i flyt, og fri plassering gir
    // ingen mening. Da er dra-og-slipp slått av med vilje.
    if (!mal || mal.kolonner < MAKS_BREDDE) return;

    e.preventDefault();

    const rute = ruteFraPunkt(
      mal.rect,
      mal.kolonner,
      RAD_PIKSLER - MELLOMROM,
      MELLOMROM,
      e.clientX,
      e.clientY,
    );

    settDrar({ id: w.id, grepX: rute.x - w.x, grepY: rute.y - w.y });
  }

  function startEndring(e: React.PointerEvent, widget: WidgetOppsett) {
    e.preventDefault();
    e.stopPropagation();

    const mal = malRutenett();
    if (!mal) return;

    settEndrer({
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: widget.w,
      startH: widget.h,
      kolonneBredde: mal.kolonneBredde,
    });
  }

  // Musa forlater ofte widgeten mens man drar, så bevegelsene må følges på
  // hele vinduet — ikke bare på elementet man startet på.
  useEffect(() => {
    if (!drar) return;

    function beveg(e: PointerEvent) {
      if (!drar) return;
      const mal = malRutenett();
      if (!mal) return;

      const rute = ruteFraPunkt(
        mal.rect,
        mal.kolonner,
        RAD_PIKSLER - MELLOMROM,
        MELLOMROM,
        e.clientX,
        e.clientY,
      );

      flyttTil(drar.id, rute.x - drar.grepX, rute.y - drar.grepY);
    }

    function slipp() {
      settDrar(null);
      lagre(sisteOppsett.current);
    }

    window.addEventListener("pointermove", beveg);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);

    return () => {
      window.removeEventListener("pointermove", beveg);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
    };
  }, [drar, lagre]);

  useEffect(() => {
    if (!endrer) return;

    function beveg(e: PointerEvent) {
      if (!endrer) return;
      const dx = e.clientX - endrer.startX;
      const dy = e.clientY - endrer.startY;

      endreStorrelse(
        endrer.id,
        Math.min(
          MAKS_BREDDE,
          Math.max(1, endrer.startW + Math.round(dx / endrer.kolonneBredde)),
        ) as Bredde,
        Math.min(
          MAKS_HOYDE,
          Math.max(1, endrer.startH + Math.round(dy / RAD_PIKSLER)),
        ) as Hoyde,
        false,
      );
    }

    function slipp() {
      settEndrer(null);
      lagre(sisteOppsett.current);
    }

    window.addEventListener("pointermove", beveg);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);

    return () => {
      window.removeEventListener("pointermove", beveg);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
    };
  }, [endrer, lagre]);

  const aktiv = drar?.id ?? endrer?.id;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => settRedigerer((f) => !f)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            redigerer
              ? "bg-merke-600 text-white hover:bg-merke-700"
              : "bg-flate text-tekst ring-1 ring-kant-sterk ring-inset hover:bg-flate-hover",
          )}
        >
          {redigerer ? (
            <>
              <Check className="size-4" aria-hidden />
              Ferdig
            </>
          ) : (
            <>
              <Move className="size-4" aria-hidden />
              Tilpass widgets
            </>
          )}
        </button>

        {redigerer && (
          <p className="text-sm text-tekst-svak">
            Dra widgetene dit du vil ha dem, og dra i hjørnet nede til høyre for
            å endre størrelsen. Fri plassering krever full bredde på skjermen.
          </p>
        )}

        {melding && (
          <span
            aria-live="polite"
            className="text-sm text-emerald-600 dark:text-emerald-400"
          >
            {melding}
          </span>
        )}
        {lagrer && !melding && (
          <span aria-live="polite" className="text-sm text-tekst-svak">
            Lagrer …
          </span>
        )}
      </div>

      <div
        ref={rutenett}
        className={cn(
          "grid auto-rows-[7rem] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
          // Mens man drar skal ikke teksten i andre widgets bli markert
          aktiv && "touch-none select-none",
        )}
      >
        {oppsett.map((w) => {
          const meta = WIDGET_KATALOG.find((k) => k.type === w.type);
          const dennes = aktiv === w.id;

          return (
            <div
              key={w.id}
              onPointerDown={(e) => startDraging(e, w)}
              /**
               * Plasseringen settes som variabler og brukes bare når rutenettet
               * faktisk har fire kolonner — se .widget-plassert i globals.css.
               * På smalere skjermer flyter widgetene i stedet, sortert etter
               * hvor de ligger. Fri plassering på en telefon ville gitt et
               * dashbord man må rulle sidelengs i.
               */
              style={
                {
                  "--wx": w.x + 1,
                  "--wy": w.y + 1,
                  "--ww": w.w,
                  "--wh": w.h,
                } as React.CSSProperties
              }
              className={cn(
                "widget-plassert relative min-h-0 [&>*]:h-full",
                w.w >= 2 && "sm:col-span-2",
                !aktiv && "transition-all",
                redigerer && !dennes && "cursor-grab",
                dennes && "z-10 cursor-grabbing",
                dennes &&
                  "rounded-xl opacity-90 outline-2 outline-dashed outline-merke-500 outline-offset-2",
              )}
            >
              {redigerer && (
                <div className="absolute inset-0 z-10 flex items-start justify-between rounded-xl bg-flate/70 p-2 backdrop-blur-[1px]">
                  <span className="flex items-center gap-1.5 rounded-lg bg-flate px-2 py-1 text-xs font-medium text-tekst shadow-sm ring-1 ring-kant ring-inset">
                    <GripVertical
                      className="size-3.5 text-tekst-svakest"
                      aria-hidden
                    />
                    {meta?.navn}
                    <span
                      className={cn(
                        "tabular-nums",
                        dennes ? "font-semibold text-aksent" : "text-tekst-svakest",
                      )}
                    >
                      {w.w}×{w.h}
                    </span>
                  </span>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => fjern(w.id)}
                    disabled={oppsett.length <= 1}
                    className="rounded-md bg-flate p-1.5 text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-red-600 disabled:opacity-30"
                    aria-label={`Fjern ${meta?.navn}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>

                  {/*
                    Håndtaket er en knapp og ikke bare et hjørne, slik at det
                    kan nås med tabulator. Piltastene gjør samme jobb som
                    dragingen for den som ikke bruker mus.
                  */}
                  <button
                    type="button"
                    onPointerDown={(e) => startEndring(e, w)}
                    onKeyDown={(e) => {
                      const steg: Record<string, [number, number]> = {
                        ArrowRight: [1, 0],
                        ArrowLeft: [-1, 0],
                        ArrowDown: [0, 1],
                        ArrowUp: [0, -1],
                      };
                      const valg = steg[e.key];
                      if (!valg) return;
                      e.preventDefault();

                      // Med skift flytter man widgeten i stedet for å endre
                      // størrelsen, slik at alt kan gjøres uten mus.
                      if (e.shiftKey) {
                        flyttTil(w.id, w.x + valg[0], w.y + valg[1]);
                        lagre(sisteOppsett.current);
                      } else {
                        endreStorrelse(
                          w.id,
                          Math.min(MAKS_BREDDE, Math.max(1, w.w + valg[0])) as Bredde,
                          Math.min(MAKS_HOYDE, Math.max(1, w.h + valg[1])) as Hoyde,
                          true,
                        );
                      }
                    }}
                    aria-label={`Endre ${meta?.navn}. Nå ${w.w} bred og ${w.h} høy, i kolonne ${w.x + 1}, rad ${w.y + 1}. Piltaster endrer størrelsen, skift og piltaster flytter.`}
                    className="absolute right-1 bottom-1 flex size-6 cursor-nwse-resize touch-none items-center justify-center rounded-md bg-flate text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-tekst focus-visible:ring-2 focus-visible:ring-merke-500"
                  >
                    <svg
                      viewBox="0 0 10 10"
                      className="size-3 fill-current"
                      aria-hidden
                    >
                      <path d="M9 1v8H1z" opacity=".35" />
                      <path d="M9 5v4H5z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Innholdet er ferdig tegnet på serveren og røres ikke her */}
              <div className={cn("h-full", redigerer && "pointer-events-none")}>
                {innhold.get(w.id)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
