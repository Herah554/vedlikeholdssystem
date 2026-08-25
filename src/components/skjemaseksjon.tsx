"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { Skjemautfylling, type UtfyltSkjema } from "@/components/skjemautfylling";
import { startSkjema } from "@/app/(app)/skjema/actions";

export type Skjemamal = {
  id: string;
  name: string;
  description: string | null;
};

/**
 * Skjemaene på én jobb eller ett avvik.
 *
 * Malvelgeren vises bare når det finnes noe å velge. En tom nedtrekksliste
 * med en knapp ved siden av er verre enn ingenting — den lover noe systemet
 * ikke kan levere før noen har laget en mal.
 */
export function Skjemaseksjon({
  feste,
  skjemaer,
  maler,
  kanEndre,
  kanAdministrere,
}: {
  feste: { type: "arbeidsordre" | "avvik"; id: string };
  skjemaer: UtfyltSkjema[];
  maler: Skjemamal[];
  kanEndre: boolean;
  kanAdministrere: boolean;
}) {
  const [valgt, settValgt] = useState(maler[0]?.id ?? "");

  return (
    <div className="space-y-4">
      {skjemaer.length > 0 ? (
        <div className="space-y-2">
          {skjemaer.map((s) => (
            <Skjemautfylling
              key={s.id}
              skjema={s}
              kanAdministrere={kanAdministrere}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-tekst-svak">
          Ingen skjemaer på denne jobben ennå.
        </p>
      )}

      {kanEndre && maler.length > 0 && (
        <form
          action={startSkjema}
          className="flex flex-wrap items-end gap-2 border-t border-kant pt-4"
        >
          <input type="hidden" name="festeType" value={feste.type} />
          <input type="hidden" name="festeId" value={feste.id} />

          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-tekst">
              Legg til skjema
            </span>
            <Select
              name="malId"
              value={valgt}
              onChange={(e) => settValgt(e.target.value)}
              className="w-auto"
            >
              {maler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </label>

          <Button type="submit" variant="sekundær">
            <Plus className="size-4" aria-hidden />
            Start
          </Button>

          {maler.find((m) => m.id === valgt)?.description && (
            <p className="w-full text-xs text-tekst-svak">
              {maler.find((m) => m.id === valgt)?.description}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
