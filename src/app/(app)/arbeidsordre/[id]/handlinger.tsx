"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Clock, Package, Send } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { DeleSok } from "@/components/delesok";
import { STATUS_FORKLARING, ORDRE_STATUS } from "@/lib/domene";
import type { Deletreff } from "../../reservedeler/behov-actions";
import type { Resultat } from "../actions";
import type { WorkOrderStatus } from "@/generated/prisma/client";

/** Felles feilvisning for alle skjemaene på siden. */
function Feil({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
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

  const forklaring = STATUS_FORKLARING[nåværende];

  if (muligeSteg.length === 0) {
    return (
      <div className="text-sm">
        <p className="text-tekst">{forklaring.naa}</p>
        <p className="mt-1 text-tekst-svak">{forklaring.neste}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Statusen alene sier hvor ordren er, ikke hvor den skal. Uten dette
          må man kjenne arbeidsflyten fra før for å vite hva man skal trykke. */}
      <div className="mb-3 text-sm">
        <p className="text-tekst">{forklaring.naa}</p>
        <p className="mt-0.5 text-tekst-svak">
          <span className="font-medium">Neste steg:</span> {forklaring.neste}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {muligeSteg.map((steg) => (
          <Button
            key={steg}
            variant={
              steg === "AVVIST"
                ? "fare"
                : steg === forklaring.vanlig
                  ? "primær"
                  : "sekundær"
            }
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

/**
 * Uttak av del fra lageret.
 *
 * Delen søkes opp i stedet for å velges fra en liste over hele lageret. Et
 * delelager med tusen deler gjorde nedtrekkslista ubrukelig — og tusen deler
 * er det normale hos dem systemet skal selges til.
 */
export function DeleSkjema({
  registrer,
  sok,
}: {
  registrer: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  sok: (tekst: string) => Promise<Deletreff[]>;
}) {
  const [state, action] = useActionState(registrer, { ok: true });
  const [valgt, settValgt] = useState<Deletreff | null>(null);

  return (
    <form action={action} className="space-y-3">
      <DeleSok navn="partId" sok={sok} paavalgt={settValgt} />
      {valgt && valgt.beholdning <= 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Ingenting på lager. Meld den under «Deler som må bestilles» i stedet,
          så får delelageret beskjed.
        </p>
      )}
      <Field label="Antall" required>
        <Input name="quantity" type="number" step="any" min="0.01" defaultValue="1" required />
      </Field>
      <Feil melding={state.feil} />
      <Lagre tekst="Ta ut del" ikon={<Package className="size-4" aria-hidden />} />
    </form>
  );
}

// ─── Løsning ──────────────────────────────────────────────────

/** Årsakene firmaet har satt opp under Oppsett. */
export type Aarsak = { code: string; name: string };

export function LosningSkjema({
  lagre,
  aarsaker,
  standard,
}: {
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  aarsaker: Aarsak[];
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
        {/* Har firmaet satt opp årsaker, skal teknikeren velge blant dem —
            fritekst gir statistikk full av skrivefeil og synonymer. Har de
            ikke gjort det ennå, er et åpent felt bedre enn ingenting. */}
        {aarsaker.length > 0 ? (
          <Field label="Årsak" hint="Settes opp under Oppsett">
            <Select name="failureCode" defaultValue={standard.failureCode ?? ""}>
              <option value="">Ikke angitt</option>
              {aarsaker.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
              {/* Er ordren merket med en årsak som siden er tatt ut av lista,
                  skal valget stå igjen i stedet for å bli borte ved lagring. */}
              {standard.failureCode &&
                !aarsaker.some((a) => a.code === standard.failureCode) && (
                  <option value={standard.failureCode}>
                    {standard.failureCode} (utgått)
                  </option>
                )}
            </Select>
          </Field>
        ) : (
          <Field label="Feilkode" hint="F.eks. LAGERSKADE">
            <Input
              name="failureCode"
              defaultValue={standard.failureCode ?? ""}
              placeholder="LAGERSKADE"
              className="uppercase"
            />
          </Field>
        )}
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
          <span className="text-sm text-emerald-600 dark:text-emerald-400" aria-live="polite" />
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
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-flate-hover">
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
              className="mt-0.5 size-4 rounded border-kant-sterk text-aksent focus:ring-merke-600"
            />
            <span
              className={
                p.isDone ? "text-sm text-tekst-svakest line-through" : "text-sm text-tekst"
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
