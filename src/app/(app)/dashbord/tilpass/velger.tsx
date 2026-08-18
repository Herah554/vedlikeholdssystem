"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, X } from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import {
  WIDGET_IKON,
  WIDGET_KATALOG,
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
  const router = useRouter();

  const brukte = new Set(valgte.map((v) => v.type));
  const ledige = WIDGET_KATALOG.filter((w) => !brukte.has(w.type));

  function leggTil(type: WidgetType, bredde: 1 | 2) {
    settValgte((f) => [
      ...f,
      { id: `w${Date.now().toString(36)}`, type, w: bredde },
    ]);
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
          description={`${valgte.length} widget${valgte.length === 1 ? "" : "er"} — rekkefølgen her er rekkefølgen på dashbordet`}
        />
        {valgte.length === 0 ? (
          <CardBody>
            <p className="py-6 text-center text-sm text-slate-500">
              Ingen widgets valgt. Legg til noen fra lista til høyre.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {valgte.map((v, i) => {
              const meta = WIDGET_KATALOG.find((w) => w.type === v.type);
              const Ikon = WIDGET_IKON[v.type];
              return (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <Ikon className="size-4 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{meta?.navn}</p>
                    <p className="text-xs text-slate-500">
                      {v.w === 2 ? "Bred" : "Smal"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => flytt(i, -1)}
                      disabled={i === 0}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label={`Flytt ${meta?.navn} opp`}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => flytt(i, 1)}
                      disabled={i === valgte.length - 1}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label={`Flytt ${meta?.navn} ned`}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => fjern(v.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
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
        <CardBody className="flex flex-wrap items-center gap-3 border-t border-slate-100">
          <Button onClick={lagre} disabled={venter || valgte.length === 0}>
            <Check className="size-4" aria-hidden />
            {venter ? "Lagrer …" : "Lagre dashbord"}
          </Button>
          <Button variant="sekundær" onClick={tilbakestill} disabled={venter}>
            <RotateCcw className="size-4" aria-hidden />
            Bruk firmaets standard
          </Button>
          {melding && (
            <span aria-live="polite" className="text-sm text-slate-600">
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
            <p className="py-6 text-center text-sm text-slate-500">
              Du har lagt til alt som finnes.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ledige.map((w) => {
              const Ikon = WIDGET_IKON[w.type];
              return (
                <li key={w.type}>
                  <button
                    type="button"
                    onClick={() => leggTil(w.type, w.bredde)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                  >
                    <Ikon className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{w.navn}</p>
                      <p className="text-xs text-slate-500">{w.beskrivelse}</p>
                    </div>
                    <Plus className="size-4 shrink-0 text-merke-600" aria-hidden />
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
