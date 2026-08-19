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
import { lagreOppsett } from "./tilpass/actions";

/**
 * Dashbordrutenettet med flyttbare widgets som kan dras i størrelse.
 *
 * Widgetene tegnes ferdig på serveren og sendes hit som barn. Denne
 * komponenten bytter bare om på rekkefølgen og størrelsen — den vet ingenting
 * om hva den enkelte widgeten viser, og trenger derfor ingen databasetilgang.
 *
 * Flytting og størrelse ligger bak en egen redigeringsmodus. Uten den ville
 * hvert forsøk på å dra en widget i stedet trykke på lenkene inni den.
 */

/**
 * Kolonnespennet må skrives ut som hele klassenavn.
 *
 * Tailwind leser kildekoden som tekst og finner ikke klasser som settes
 * sammen underveis, så `col-span-${w}` ville blitt borte i produksjonsbygget.
 */
const SPENN: Record<Bredde, string> = {
  1: "",
  2: "sm:col-span-2",
  3: "sm:col-span-2 xl:col-span-3",
  4: "sm:col-span-2 xl:col-span-4",
};

function klem(verdi: number, maks: number): number {
  return Math.min(maks, Math.max(1, verdi));
}

type Endring = {
  id: string;
  startX: number;
  startY: number;
  startW: Bredde;
  startH: Hoyde;
  /** Bredden på én kolonne pluss mellomrommet, målt idet dragingen startet. */
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
  const [drar, settDrar] = useState<string | null>(null);
  const [over, settOver] = useState<string | null>(null);
  const [endrer, settEndrer] = useState<Endring | null>(null);
  const [lagrer, startLagring] = useTransition();
  const [melding, settMelding] = useState<string>();
  const rutenett = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /**
   * Siste oppsett, tilgjengelig utenfor React sin gjengivelse.
   *
   * Når man slipper et hjørne må vi lagre det som nettopp ble dratt fram.
   * Å lese det ut av en tilstandsoppdatering ville betydd å kalle en
   * oppdatering inne i en annen, og det gjør React med rette opprør mot.
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

  function flyttTil(fraId: string, tilId: string) {
    if (fraId === tilId) return;
    const fra = oppsett.findIndex((w) => w.id === fraId);
    const til = oppsett.findIndex((w) => w.id === tilId);
    if (fra < 0 || til < 0) return;

    const kopi = [...oppsett];
    const [flyttet] = kopi.splice(fra, 1);
    kopi.splice(til, 0, flyttet);
    lagre(kopi);
  }

  function flyttMedTastatur(id: string, retning: -1 | 1) {
    const i = oppsett.findIndex((w) => w.id === id);
    const mål = i + retning;
    if (mål < 0 || mål >= oppsett.length) return;
    const kopi = [...oppsett];
    [kopi[i], kopi[mål]] = [kopi[mål], kopi[i]];
    lagre(kopi);
  }

  /** Setter størrelsen uten å lagre. Brukes mens man drar. */
  function settStorrelse(id: string, w: Bredde, h: Hoyde) {
    const nytt = sisteOppsett.current.map((el) =>
      el.id === id ? { ...el, w, h } : el,
    );
    sisteOppsett.current = nytt;
    settOppsett(nytt);
  }

  /** Endrer størrelsen ett hakk og lagrer. Tastaturets vei inn. */
  function endreStorrelse(id: string, dw: number, dh: number) {
    const nytt = oppsett.map((el) =>
      el.id === id
        ? {
            ...el,
            w: klem(el.w + dw, MAKS_BREDDE) as Bredde,
            h: klem(el.h + dh, MAKS_HOYDE) as Hoyde,
          }
        : el,
    );
    lagre(nytt);
  }

  function fjern(id: string) {
    if (oppsett.length <= 1) return;
    lagre(oppsett.filter((w) => w.id !== id));
    router.refresh();
  }

  /**
   * Starter en størrelsesendring.
   *
   * Kolonnebredden måles her og ikke ved hver musebevegelse. Rutenettet
   * endrer seg ikke mens man drar, og en måling per bevegelse ville tvunget
   * nettleseren til å regne om hele oppsettet på nytt førti ganger i sekundet.
   */
  function startEndring(e: React.PointerEvent, widget: WidgetOppsett) {
    e.preventDefault();
    e.stopPropagation();

    const el = rutenett.current;
    if (!el) return;

    const stil = getComputedStyle(el);
    const spor = stil.gridTemplateColumns
      .split(" ")
      .map(parseFloat)
      .filter(Number.isFinite);
    if (!spor.length) return;

    const mellomrom = parseFloat(stil.columnGap) || 0;

    settEndrer({
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: widget.w,
      startH: widget.h,
      kolonneBredde: spor[0] + mellomrom,
    });
  }

  // Musa forlater ofte det lille håndtaket mens man drar, så bevegelsene
  // må følges på hele vinduet — ikke bare på elementet man startet på.
  useEffect(() => {
    if (!endrer) return;

    function beveg(e: PointerEvent) {
      if (!endrer) return;
      const dx = e.clientX - endrer.startX;
      const dy = e.clientY - endrer.startY;

      settStorrelse(
        endrer.id,
        klem(
          endrer.startW + Math.round(dx / endrer.kolonneBredde),
          MAKS_BREDDE,
        ) as Bredde,
        klem(endrer.startH + Math.round(dy / RAD_PIKSLER), MAKS_HOYDE) as Hoyde,
      );
    }

    function slipp() {
      settEndrer(null);
      // Lagres først når man slipper. Å lagre for hver piksel ville sendt
      // hundrevis av forespørsler for én eneste endring.
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
            å endre størrelsen.
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
          "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
          // Mens man drar i et hjørne skal ikke teksten i andre widgets
          // bli markert av musebevegelsen.
          endrer && "select-none",
        )}
      >
        {oppsett.map((w) => {
          const meta = WIDGET_KATALOG.find((k) => k.type === w.type);
          const erOver = over === w.id && drar !== w.id;
          const endres = endrer?.id === w.id;

          return (
            <div
              key={w.id}
              draggable={redigerer && !endrer}
              onDragStart={() => settDrar(w.id)}
              onDragEnd={() => {
                settDrar(null);
                settOver(null);
              }}
              onDragOver={(e) => {
                if (!redigerer) return;
                e.preventDefault();
                settOver(w.id);
              }}
              onDragLeave={() => settOver((f) => (f === w.id ? null : f))}
              onDrop={(e) => {
                if (!redigerer) return;
                e.preventDefault();
                if (drar) flyttTil(drar, w.id);
                settDrar(null);
                settOver(null);
              }}
              style={{ minHeight: w.h * RAD_PIKSLER }}
              className={cn(
                "relative [&>*]:h-full",
                SPENN[w.w],
                !endrer && "transition-all",
                redigerer && !endrer && "cursor-grab active:cursor-grabbing",
                drar === w.id && "opacity-40",
                erOver && "scale-[1.02] rounded-xl ring-2 ring-merke-500",
                endres && "rounded-xl ring-2 ring-merke-500",
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
                    <span className="text-tekst-svakest tabular-nums">
                      {w.w}×{w.h}
                    </span>
                  </span>

                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => flyttMedTastatur(w.id, -1)}
                      className="rounded-md bg-flate p-1.5 text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-tekst"
                      aria-label={`Flytt ${meta?.navn} tidligere`}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => flyttMedTastatur(w.id, 1)}
                      className="rounded-md bg-flate p-1.5 text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-tekst"
                      aria-label={`Flytt ${meta?.navn} senere`}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => fjern(w.id)}
                      disabled={oppsett.length <= 1}
                      className="rounded-md bg-flate p-1.5 text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-red-600 disabled:opacity-30"
                      aria-label={`Fjern ${meta?.navn}`}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>

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
                      endreStorrelse(w.id, valg[0], valg[1]);
                    }}
                    aria-label={`Endre størrelse på ${meta?.navn}. Nå ${w.w} bred og ${w.h} høy. Bruk piltastene.`}
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
              <div
                className={cn("h-full", redigerer && "pointer-events-none")}
              >
                {innhold.get(w.id)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
