"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import {
  WIDGET_IKON,
  WIDGET_KATALOG,
  type Bredde,
  type Hoyde,
  type WidgetOppsett,
  type WidgetType,
} from "@/components/widget-katalog";
import { lagreOppsett, tilbakestillOppsett } from "./actions";

/**
 * Lar brukeren sette sammen sitt eget dashbord.
 *
 * Endringer holdes lokalt til man trykker Lagre, slik at man kan prøve seg
 * fram uten at dashbordet endrer seg under føttene på en.
 */
export function Velger({ start }: { start: WidgetOppsett[] }) {
  const [valgte, settValgte] = useState<WidgetOppsett[]>(start);
  const [venter, startOvergang] = useTransition();
  const [melding, settMelding] = useState<string>();
  const [drar, settDrar] = useState<string | null>(null);
  const [over, settOver] = useState<string | null>(null);
  const router = useRouter();

  /** Flytter en widget dit den ble sluppet. */
  function slippPa(tilId: string) {
    if (!drar || drar === tilId) return;
    settValgte((f) => {
      const fra = f.findIndex((v) => v.id === drar);
      const til = f.findIndex((v) => v.id === tilId);
      if (fra < 0 || til < 0) return f;
      const kopi = [...f];
      const [flyttet] = kopi.splice(fra, 1);
      kopi.splice(til, 0, flyttet);
      return kopi;
    });
    settMelding(undefined);
  }

  const brukte = new Set(valgte.map((v) => v.type));
  const ledige = WIDGET_KATALOG.filter((w) => !brukte.has(w.type));

  function leggTil(type: WidgetType, bredde: Bredde, hoyde: Hoyde) {
    settValgte((f) => {
      // Nye widgets legges nederst til venstre. Å prøve å finne et ledig hull
      // høyere oppe ville flyttet dem et sted brukeren ikke ser dem.
      const nederst = f.reduce((m, w) => Math.max(m, w.y + w.h), 0);

      return [
        ...f,
        {
          id: `w${Date.now().toString(36)}`,
          type,
          w: bredde,
          h: hoyde,
          x: 0,
          y: nederst,
        },
      ];
    });
    settMelding(undefined);
  }

  function fjern(id: string) {
    settValgte((f) => f.filter((v) => v.id !== id));
    settMelding(undefined);
  }

  function flytt(index: number, retning: -1 | 1) {
    settValgte((f) => {
      const mål = index + retning;
      if (mål < 0 || mål >= f.length) return f;
      const kopi = [...f];
      [kopi[index], kopi[mål]] = [kopi[mål], kopi[index]];
      return kopi;
    });
    settMelding(undefined);
  }

  function lagre() {
    startOvergang(async () => {
      const svar = await lagreOppsett(JSON.stringify(valgte));
      settMelding(svar.ok ? "Dashbordet er lagret." : svar.feil);
      if (svar.ok) router.push("/dashbord");
    });
  }

  function tilbakestill() {
    startOvergang(async () => {
      await tilbakestillOppsett();
      router.push("/dashbord");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Ditt dashbord"
          description={`${valgte.length} widget${valgte.length === 1 ? "" : "er"} — dra dem i rekkefølgen du vil ha`}
        />
        {valgte.length === 0 ? (
          <CardBody>
            <p className="py-6 text-center text-sm text-tekst-svak">
              Ingen widgets valgt. Legg til noen fra lista til høyre.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-kant">
            {valgte.map((v, i) => {
              const meta = WIDGET_KATALOG.find((w) => w.type === v.type);
              const Ikon = WIDGET_IKON[v.type];
              return (
                <li
                  key={v.id}
                  draggable
                  onDragStart={() => settDrar(v.id)}
                  onDragEnd={() => {
                    settDrar(null);
                    settOver(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    settOver(v.id);
                  }}
                  onDragLeave={() => settOver((f) => (f === v.id ? null : f))}
                  onDrop={(e) => {
                    e.preventDefault();
                    slippPa(v.id);
                    settDrar(null);
                    settOver(null);
                  }}
                  className={`flex cursor-grab items-center gap-3 px-5 py-3 active:cursor-grabbing ${
                    drar === v.id ? "opacity-40" : ""
                  } ${over === v.id && drar !== v.id ? "bg-merke-50" : ""}`}
                >
                  <GripVertical className="size-4 shrink-0 text-tekst-svakest" aria-hidden />
                  <Ikon className="size-4 shrink-0 text-tekst-svakest" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-tekst">{meta?.navn}</p>
                    <p className="text-xs text-tekst-svak">
                      {v.w === 2 ? "Bred" : "Smal"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => flytt(i, -1)}
                      disabled={i === 0}
                      className="rounded-lg p-1.5 text-tekst-svak hover:bg-flate-dempet disabled:opacity-30"
                      aria-label={`Flytt ${meta?.navn} opp`}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => flytt(i, 1)}
                      disabled={i === valgte.length - 1}
                      className="rounded-lg p-1.5 text-tekst-svak hover:bg-flate-dempet disabled:opacity-30"
                      aria-label={`Flytt ${meta?.navn} ned`}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => fjern(v.id)}
                      className="rounded-lg p-1.5 text-tekst-svak hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Fjern ${meta?.navn}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <CardBody className="flex flex-wrap items-center gap-3 border-t border-kant">
          <Button onClick={lagre} disabled={venter || valgte.length === 0}>
            <Check className="size-4" aria-hidden />
            {venter ? "Lagrer …" : "Lagre dashbord"}
          </Button>
          <Button variant="sekundær" onClick={tilbakestill} disabled={venter}>
            <RotateCcw className="size-4" aria-hidden />
            Bruk firmaets standard
          </Button>
          {melding && (
            <span aria-live="polite" className="text-sm text-tekst-svak">
              {melding}
            </span>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Tilgjengelige widgets"
          description="Trykk for å legge til"
        />
        {ledige.length === 0 ? (
          <CardBody>
            <p className="py-6 text-center text-sm text-tekst-svak">
              Du har lagt til alt som finnes.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-kant">
            {ledige.map((w) => {
              const Ikon = WIDGET_IKON[w.type];
              return (
                <li key={w.type}>
                  <button
                    type="button"
                    onClick={() => leggTil(w.type, w.bredde, w.hoyde)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-flate-hover"
                  >
                    <Ikon className="size-4 shrink-0 text-tekst-svakest" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-tekst">{w.navn}</p>
                      <p className="text-xs text-tekst-svak">{w.beskrivelse}</p>
                    </div>
                    <Plus className="size-4 shrink-0 text-aksent" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
