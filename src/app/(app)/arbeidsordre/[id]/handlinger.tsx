"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Clock, Package, Send } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ORDRE_STATUS } from "@/lib/domene";
import type { Resultat } from "../actions";
import type { WorkOrderStatus } from "@/generated/prisma/client";

/** Felles feilvisning for alle skjemaene på siden. */
function Feil({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {melding}
    </p>
  );
}

function Lagre({ tekst, ikon }: { tekst: string; ikon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {ikon}
      {pending ? "Lagrer …" : tekst}
    </Button>
  );
}

// ─── Statusflyt ───────────────────────────────────────────────

export function StatusKnapper({
  nåværende,
  muligeSteg,
  endre,
}: {
  nåværende: WorkOrderStatus;
  muligeSteg: WorkOrderStatus[];
  endre: (status: WorkOrderStatus) => Promise<Resultat>;
}) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  if (muligeSteg.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Ordren er {ORDRE_STATUS[nåværende].tekst.toLowerCase()} og kan ikke
        endres videre.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {muligeSteg.map((steg) => (
          <Button
            key={steg}
            variant={steg === "AVVIST" ? "fare" : "sekundær"}
            disabled={venter}
            onClick={() =>
              start(async () => {
                const r = await endre(steg);
                settFeil(r.ok ? undefined : r.feil);
                if (r.ok) router.refresh();
              })
            }
          >
            {ORDRE_STATUS[steg].tekst}
          </Button>
        ))}
      </div>
      <div className="mt-2">
        <Feil melding={feil} />
      </div>
    </div>
  );
}

// ─── Timeføring ───────────────────────────────────────────────

export function TimeSkjema({
  registrer,
  iDag,
}: {
  registrer: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  iDag: string;
}) {
  const [state, action] = useActionState(registrer, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timer" required>
          <Input
            name="hours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            required
            placeholder="2,5"
          />
        </Field>
        <Field label="Dato" required>
          <Input name="workedOn" type="date" defaultValue={iDag} required />
        </Field>
      </div>
      <Field label="Notat">
        <Input name="note" placeholder="Hva ble gjort?" />
      </Field>
      <Feil melding={state.feil} />
      <Lagre tekst="Før timer" ikon={<Clock className="size-4" aria-hidden />} />
    </form>
  );
}

// ─── Deleuttak ────────────────────────────────────────────────

export function DeleSkjema({
  registrer,
  deler,
}: {
  registrer: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  deler: { id: string; number: string; name: string; unit: string; beholdning: number }[];
}) {
  const [state, action] = useActionState(registrer, { ok: true });

  if (deler.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Ingen reservedeler er registrert ennå.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field label="Reservedel" required>
        <Select name="partId" required defaultValue="">
          <option value="" disabled>
            Velg del …
          </option>
          {deler.map((d) => (
            <option key={d.id} value={d.id} disabled={d.beholdning <= 0}>
              {d.number} — {d.name} ({d.beholdning} {d.unit} på lager)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Antall" required>
        <Input name="quantity" type="number" step="1" min="1" defaultValue="1" required />
      </Field>
      <Feil melding={state.feil} />
      <Lagre tekst="Ta ut del" ikon={<Package className="size-4" aria-hidden />} />
    </form>
  );
}

// ─── Løsning ──────────────────────────────────────────────────

export function LosningSkjema({
  lagre,
  standard,
}: {
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  standard: {
    resolution: string | null;
    failureCode: string | null;
    downtimeMinutes: number | null;
  };
}) {
  const [state, action] = useActionState(lagre, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Hva løste problemet?"
        required
        hint="Skriv konkret. Denne teksten er det assistenten finner igjen neste gang noen møter samme feil."
      >
        <Textarea
          name="resolution"
          defaultValue={standard.resolution ?? ""}
          required
          rows={5}
          placeholder="Fant slitt lager på drivsiden. Byttet lager og tetning, smurte og målte vibrasjon etterpå: 2,4 mm/s."
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Feilkode" hint="F.eks. LAGERSKADE">
          <Input
            name="failureCode"
            defaultValue={standard.failureCode ?? ""}
            placeholder="LAGERSKADE"
            className="uppercase"
          />
        </Field>
        <Field label="Nedetid (minutter)" hint="Hvor lenge sto produksjonen">
          <Input
            name="downtimeMinutes"
            type="number"
            min="0"
            defaultValue={standard.downtimeMinutes ?? ""}
            placeholder="120"
          />
        </Field>
      </div>
      <Feil melding={state.feil} />
      <div className="flex items-center gap-3">
        <Lagre tekst="Lagre løsning" ikon={<Check className="size-4" aria-hidden />} />
        {state.ok && state.feil === undefined && (
          <span className="text-sm text-emerald-600" aria-live="polite" />
        )}
      </div>
    </form>
  );
}

// ─── Kommentarer ──────────────────────────────────────────────

export function KommentarSkjema({
  leggTil,
}: {
  leggTil: (forrige: Resultat, data: FormData) => Promise<Resultat>;
}) {
  const [state, action] = useActionState(leggTil, { ok: true });

  return (
    <form action={action} className="space-y-2">
      <Textarea
        name="body"
        rows={3}
        required
        placeholder="Skriv en kommentar til de andre på laget …"
        aria-label="Ny kommentar"
      />
      <Feil melding={state.feil} />
      <Lagre tekst="Legg til" ikon={<Send className="size-4" aria-hidden />} />
    </form>
  );
}

// ─── Sjekkliste ───────────────────────────────────────────────

export function Sjekkliste({
  punkter,
  kryss,
}: {
  punkter: { id: string; text: string; isDone: boolean }[];
  kryss: (punktId: string, ferdig: boolean) => Promise<Resultat>;
}) {
  const [venter, start] = useTransition();
  const router = useRouter();

  return (
    <ul className="space-y-1">
      {punkter.map((p) => (
        <li key={p.id}>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={p.isDone}
              disabled={venter}
              onChange={(e) =>
                start(async () => {
                  await kryss(p.id, e.target.checked);
                  router.refresh();
                })
              }
              className="mt-0.5 size-4 rounded border-slate-300 text-merke-600 focus:ring-merke-600"
            />
            <span
              className={
                p.isDone ? "text-sm text-slate-400 line-through" : "text-sm text-slate-700"
              }
            >
              {p.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
