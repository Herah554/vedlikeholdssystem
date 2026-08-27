"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, ShoppingCart, Undo2 } from "lucide-react";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { DeleSok } from "@/components/delesok";
import { BEHOV_NESTE, BEHOV_STATUS } from "@/lib/domene";
import { relativTid, tall } from "@/lib/format";
import type { Deletreff, Resultat } from "../../reservedeler/behov-actions";
import type { PartRequestStatus } from "@/generated/prisma/client";

/**
 * «Jeg mangler en del» — meldt der jobben står.
 *
 * Teknikeren skal slippe å gå ut av arbeidsordren, finne delelageret og
 * forklare hvilken jobb det gjaldt. Behovet skrives her og dukker opp hos
 * den som bestiller med jobben, personen og kommentaren allerede på plass.
 *
 * Statusen går andre veien igjen: når bestillingen er mottatt, står det her
 * at delen ligger på lager. Uten den returen måtte teknikeren spurt likevel,
 * og da hadde ingenting vært vunnet.
 */

export type Behov = {
  id: string;
  status: PartRequestStatus;
  quantity: number;
  note: string | null;
  description: string | null;
  urgent: boolean;
  createdAt: Date;
  handledNote: string | null;
  eget: boolean;
  del: { number: string; name: string; unit: string } | null;
  bestilling: { id: string; nummer: string } | null;
  meldtAv: string;
};

export function Delebehov({
  behov,
  meld,
  trekk,
  sok,
  kanMelde,
}: {
  behov: Behov[];
  meld: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  trekk: (id: string) => Promise<Resultat>;
  sok: (tekst: string) => Promise<Deletreff[]>;
  kanMelde: boolean;
}) {
  const [state, action] = useActionState(meld, { ok: true });
  const [valgt, settValgt] = useState<Deletreff | null>(null);
  const [beskriver, settBeskriver] = useState(false);
  const [nokkel, settNokkel] = useState(0);

  return (
    <div className="space-y-4">
      {behov.length > 0 && (
        <ul className="space-y-2.5">
          {behov.map((b) => (
            <BehovRad key={b.id} behov={b} trekk={trekk} />
          ))}
        </ul>
      )}

      {kanMelde && (
        <form
          action={action}
          // Ny nøkkel etter en vellykket melding tømmer feltene. Uten det
          // blir forrige del stående, og neste behov meldes ved et uhell på
          // samme delenummer.
          key={`${nokkel}-${state.ok && state.melding ? "ny" : "samme"}`}
          className="space-y-3 border-t border-kant pt-4"
        >
          {beskriver ? (
            <Field
              label="Hva trenger du?"
              required
              hint="Skriv så nøyaktig du klarer. Delelageret finner delenummeret."
            >
              <Textarea
                name="description"
                rows={2}
                required
                placeholder="Akseltetning til matepumpe 3, den store på drivsiden"
              />
            </Field>
          ) : (
            <DeleSok navn="partId" sok={sok} paavalgt={settValgt} />
          )}

          <button
            type="button"
            onClick={() => {
              settBeskriver((v) => !v);
              settValgt(null);
            }}
            className="text-xs text-aksent hover:underline"
          >
            {beskriver
              ? "Søk i delelageret i stedet"
              : "Finner du den ikke? Beskriv den med ord"}
          </button>

          {valgt && valgt.beholdning > 0 && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              Det ligger {tall(valgt.beholdning)} {valgt.unit} på lager. Trenger du
              den nå, kan du ta den ut under «Deler brukt» i stedet for å bestille.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Antall" required>
              <Input
                name="quantity"
                type="number"
                step="any"
                min="0.01"
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Kommentar" hint="Hvorfor trengs den?">
              <Input name="note" placeholder="Lekker, må byttes før oppstart" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-tekst">
            <input
              type="checkbox"
              name="urgent"
              className="size-4 rounded border-kant text-aksent focus:ring-aksent/30"
            />
            Haster — produksjonen står
          </label>

          {state.feil && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.feil}
            </p>
          )}
          {state.ok && state.melding && (
            <p className="flex items-start gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.melding}
            </p>
          )}

          <Send naa={() => settNokkel((n) => n + 1)} />
        </form>
      )}
    </div>
  );
}

function Send({ naa }: { naa: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} onClick={naa}>
      <ShoppingCart className="size-4" aria-hidden />
      {pending ? "Sender …" : "Meld behov til delelager"}
    </Button>
  );
}

function BehovRad({
  behov,
  trekk,
}: {
  behov: Behov;
  trekk: (id: string) => Promise<Resultat>;
}) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();
  const etikett = BEHOV_STATUS[behov.status];

  return (
    <li className="rounded-lg border border-kant p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {behov.del ? (
            <>
              <span className="font-mono text-xs text-tekst-svak">
                {behov.del.number}
              </span>
              <div className="text-sm font-medium text-tekst">{behov.del.name}</div>
            </>
          ) : (
            <div className="text-sm font-medium text-tekst">{behov.description}</div>
          )}
          <div className="text-xs text-tekst-svak">
            {tall(behov.quantity)} {behov.del?.unit ?? "stk"} · meldt av{" "}
            {behov.meldtAv} {relativTid(behov.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {behov.urgent && behov.status === "ONSKET" && (
            <Badge className="bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">
              Haster
            </Badge>
          )}
          <Badge className={etikett.klasse}>{etikett.tekst}</Badge>
        </div>
      </div>

      {behov.note && (
        <p className="mt-1.5 text-sm text-tekst-svak">«{behov.note}»</p>
      )}

      <p className="mt-1.5 text-xs text-tekst-svak">
        {BEHOV_NESTE[behov.status]}
        {behov.bestilling && (
          <>
            {" "}
            <Link
              href={`/bestillinger/${behov.bestilling.id}`}
              className="text-aksent hover:underline"
            >
              {behov.bestilling.nummer}
            </Link>
          </>
        )}
      </p>

      {behov.handledNote && (
        <p className="mt-1 text-xs text-tekst-svak">
          Begrunnelse: {behov.handledNote}
        </p>
      )}

      {/* Bare den som meldte behovet kan trekke det, og bare før noen har
          brukt penger på det. Serveren sjekker det samme. */}
      {behov.status === "ONSKET" && behov.eget && (
        <button
          type="button"
          disabled={venter}
          onClick={() =>
            start(async () => {
              const svar = await trekk(behov.id);
              if (svar.ok) router.refresh();
              else settFeil(svar.feil);
            })
          }
          className="mt-2 inline-flex items-center gap-1 text-xs text-tekst-svak hover:text-tekst disabled:opacity-50"
        >
          <Undo2 className="size-3.5" aria-hidden />
          {venter ? "Trekker …" : "Trekk behovet"}
        </button>
      )}

      {feil && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
          {feil}
        </p>
      )}
    </li>
  );
}
