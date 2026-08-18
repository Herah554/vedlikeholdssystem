"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  GripVertical,
  Maximize2,
  Minimize2,
  Move,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import { WIDGET_KATALOG, type WidgetOppsett } from "@/components/widget-katalog";
import { lagreOppsett } from "./tilpass/actions";

/**
 * Dashbordrutenettet med flyttbare widgets.
 *
 * Widgetene tegnes ferdig på serveren og sendes hit som barn. Denne
 * komponenten bytter bare om på rekkefølgen — den vet ingenting om hva den
 * enkelte widgeten viser, og trenger derfor ingen databasetilgang.
 *
 * Flytting ligger bak en egen redigeringsmodus. Uten den ville hvert forsøk
 * på å dra en widget i stedet trykke på lenkene inni den.
 */
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
  const [lagrer, startLagring] = useTransition();
  const [melding, settMelding] = useState<string>();
  const router = useRouter();

  // Widgetene kom i samme rekkefølge som det opprinnelige oppsettet
  const innhold = new Map(start.map((w, i) => [w.id, widgets[i]]));

  function lagre(nytt: WidgetOppsett[]) {
    settOppsett(nytt);
    startLagring(async () => {
      const svar = await lagreOppsett(JSON.stringify(nytt));
      settMelding(svar.ok ? "Lagret" : svar.feil);
      if (svar.ok) setTimeout(() => settMelding(undefined), 2000);
    });
  }

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

  function byttBredde(id: string) {
    lagre(
      oppsett.map((w) => (w.id === id ? { ...w, w: w.w === 2 ? 1 : 2 } : w)),
    );
  }

  function fjern(id: string) {
    if (oppsett.length <= 1) return;
    lagre(oppsett.filter((w) => w.id !== id));
    router.refresh();
  }

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
              Flytt widgets
            </>
          )}
        </button>

        {redigerer && (
          <p className="text-sm text-tekst-svak">
            Dra widgetene dit du vil ha dem. Endringen lagres med én gang.
          </p>
        )}

        {melding && (
          <span aria-live="polite" className="text-sm text-emerald-600 dark:text-emerald-400">
            {melding}
          </span>
        )}
        {lagrer && !melding && (
          <span aria-live="polite" className="text-sm text-tekst-svak">
            Lagrer …
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {oppsett.map((w) => {
          const meta = WIDGET_KATALOG.find((k) => k.type === w.type);
          const erOver = over === w.id && drar !== w.id;

          return (
            <div
              key={w.id}
              draggable={redigerer}
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
              className={cn(
                "relative transition-all",
                w.w === 2 && "sm:col-span-2",
                redigerer && "cursor-grab active:cursor-grabbing",
                drar === w.id && "opacity-40",
                erOver && "scale-[1.02] ring-2 ring-merke-500 rounded-xl",
              )}
            >
              {redigerer && (
                <div className="absolute inset-0 z-10 flex items-start justify-between rounded-xl bg-flate/70 p-2 backdrop-blur-[1px]">
                  <span className="flex items-center gap-1.5 rounded-lg bg-flate px-2 py-1 text-xs font-medium text-tekst shadow-sm ring-1 ring-kant ring-inset">
                    <GripVertical className="size-3.5 text-tekst-svakest" aria-hidden />
                    {meta?.navn}
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
                      onClick={() => byttBredde(w.id)}
                      className="rounded-md bg-flate p-1.5 text-tekst-svak shadow-sm ring-1 ring-kant ring-inset hover:text-tekst"
                      aria-label={w.w === 2 ? "Gjør smal" : "Gjør bred"}
                      title={w.w === 2 ? "Gjør smal" : "Gjør bred"}
                    >
                      {w.w === 2 ? (
                        <Minimize2 className="size-3.5" aria-hidden />
                      ) : (
                        <Maximize2 className="size-3.5" aria-hidden />
                      )}
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
                </div>
              )}

              {/* Innholdet er ferdig tegnet på serveren og røres ikke her */}
              <div className={redigerer ? "pointer-events-none" : undefined}>
                {innhold.get(w.id)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
