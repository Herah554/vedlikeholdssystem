"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Check,
  ClipboardCopy,
  Mail,
  PackageCheck,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { tall } from "@/lib/format";
import {
  endreLinje,
  fjernLinje,
  kansellerBestilling,
  markerSomSendt,
  mottaVarer,
  sendBestilling,
  type Resultat,
  type SendResultat,
} from "../actions";

function Feil({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {melding}
    </p>
  );
}

function Lagre({ tekst, ikon }: { tekst: string; ikon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {ikon}
      {pending ? "Lagrer …" : tekst}
    </Button>
  );
}

// ─── Sending ─────────────────────────────────────────────────

/**
 * Sender bestillingen.
 *
 * Har systemet en SMTP-server, går e-posten ut med én gang. Ellers vises den
 * ferdige teksten, og brukeren sender den fra sin egen klient — da slipper
 * små avdelinger å sette opp en e-postserver bare for å bestille lagerdeler.
 */
export function SendPanel({
  bestillingId,
  harEpostadresse,
  erSendt,
}: {
  bestillingId: string;
  harEpostadresse: boolean;
  erSendt: boolean;
}) {
  const [venter, start] = useTransition();
  const [svar, settSvar] = useState<SendResultat>();
  const [kopiert, settKopiert] = useState(false);
  const router = useRouter();

  function send() {
    start(async () => {
      const r = await sendBestilling(bestillingId);
      settSvar(r);
      if (r.ok && r.metode === "smtp") router.refresh();
    });
  }

  function marker() {
    start(async () => {
      await markerSomSendt(bestillingId);
      settSvar(undefined);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {!harEpostadresse && (
        <p className="flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Leverandøren mangler e-postadresse. Legg den inn på leverandøren, så
          kan bestillingen sendes herfra.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={send} disabled={venter}>
          <Send className="size-4" aria-hidden />
          {venter ? "Sender …" : erSendt ? "Send på nytt" : "Send bestilling"}
        </Button>
        {!erSendt && (
          <Button variant="sekundær" onClick={marker} disabled={venter}>
            <Check className="size-4" aria-hidden />
            Marker som sendt
          </Button>
        )}
      </div>

      {svar && !svar.ok && <Feil melding={svar.feil} />}

      {svar?.ok && svar.metode === "smtp" && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="size-4 shrink-0" aria-hidden />
          {svar.melding}
        </p>
      )}

      {svar?.ok && svar.metode === "manuell" && (
        <div className="space-y-3 rounded-lg border border-kant bg-flate-hover p-3">
          <p className="text-sm text-tekst-svak">
            Systemet er ikke satt opp med e-postserver, så her er den ferdige
            e-posten. Åpne den i din egen e-postklient, eller kopier teksten.
          </p>

          <div>
            <p className="text-xs font-medium text-tekst-svak">Emne</p>
            <p className="text-sm text-tekst">{svar.emne}</p>
          </div>

          <pre className="max-h-64 overflow-auto rounded-lg bg-flate p-3 font-mono text-xs whitespace-pre-wrap text-tekst ring-1 ring-kant ring-inset">
            {svar.tekst}
          </pre>

          <div className="flex flex-wrap gap-2">
            <a
              href={svar.mailto}
              className="inline-flex items-center gap-1.5 rounded-lg bg-merke-600 px-3 py-2 text-sm font-medium text-white hover:bg-merke-700"
            >
              <Mail className="size-4" aria-hidden />
              Åpne i e-postklient
            </a>
            <Button
              variant="sekundær"
              onClick={async () => {
                await navigator.clipboard.writeText(svar.tekst);
                settKopiert(true);
                setTimeout(() => settKopiert(false), 2000);
              }}
            >
              <ClipboardCopy className="size-4" aria-hidden />
              {kopiert ? "Kopiert" : "Kopier teksten"}
            </Button>
            <Button variant="sekundær" onClick={marker} disabled={venter}>
              <Check className="size-4" aria-hidden />
              Jeg har sendt den
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Linjer ──────────────────────────────────────────────────

export function LinjeHandlinger({
  bestillingId,
  linjeId,
  antall,
  laast,
}: {
  bestillingId: string;
  linjeId: string;
  antall: number;
  laast: boolean;
}) {
  const [venter, start] = useTransition();
  const [verdi, settVerdi] = useState(String(antall));
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  if (laast) return <span className="text-sm tabular-nums">{tall(antall)}</span>;

  function lagre(nytt: string) {
    const n = Number(nytt);
    if (!Number.isFinite(n) || n <= 0 || n === antall) return;
    start(async () => {
      const r = await endreLinje(bestillingId, linjeId, n);
      settFeil(r.ok ? undefined : r.feil);
      router.refresh();
    });
  }

  return (
    <span className="flex items-center justify-end gap-1">
      <input
        type="number"
        min="1"
        step="1"
        value={verdi}
        disabled={venter}
        onChange={(e) => settVerdi(e.target.value)}
        onBlur={() => lagre(verdi)}
        aria-label="Antall"
        title={feil}
        className="w-20 rounded-lg border-0 bg-flate px-2 py-1 text-right text-sm text-tekst ring-1 ring-kant-sterk ring-inset focus:ring-2 focus:ring-merke-600 focus:outline-none"
      />
      <button
        type="button"
        disabled={venter}
        onClick={() =>
          start(async () => {
            await fjernLinje(bestillingId, linjeId);
            router.refresh();
          })
        }
        className="rounded-lg p-1.5 text-tekst-svak hover:text-red-600 dark:hover:text-red-400"
        aria-label="Fjern linje"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </span>
  );
}

export function LeggTilLinjeSkjema({
  leggTil,
  deler,
}: {
  leggTil: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  deler: { id: string; number: string; name: string; unit: string }[];
}) {
  const [state, action] = useActionState(leggTil, { ok: true });

  if (deler.length === 0) {
    return <p className="text-sm text-tekst-svak">Ingen flere deler å legge til.</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <Field label="Legg til del">
          <Select name="partId" required defaultValue="">
            <option value="" disabled>
              Velg del …
            </option>
            {deler.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} — {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="w-28">
        <Field label="Antall">
          <Input name="quantity" type="number" min="1" step="1" defaultValue="1" required />
        </Field>
      </div>
      <Lagre tekst="Legg til" ikon={<Plus className="size-4" aria-hidden />} />
      <div className="w-full">
        <Feil melding={state.feil} />
      </div>
    </form>
  );
}

// ─── Opplysninger ────────────────────────────────────────────

export function DetaljerSkjema({
  lagre,
  verdier,
}: {
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  verdier: { reference: string | null; note: string | null; expectedAt: string | null };
}) {
  const [state, action] = useActionState(lagre, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <Field label="Vår referanse" hint="Rekvisisjonsnummer eller liknende">
        <Input name="reference" defaultValue={verdier.reference ?? ""} />
      </Field>
      <Field label="Ønsket leveringsdato">
        <Input name="expectedAt" type="date" defaultValue={verdier.expectedAt ?? ""} />
      </Field>
      <Field label="Merknad til leverandør">
        <Textarea name="note" rows={3} defaultValue={verdier.note ?? ""} />
      </Field>
      <Feil melding={state.feil} />
      {state.melding && (
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-300">
          {state.melding}
        </p>
      )}
      <Lagre tekst="Lagre" ikon={<Save className="size-4" aria-hidden />} />
    </form>
  );
}

// ─── Mottak ──────────────────────────────────────────────────

export function MottakSkjema({
  bestillingId,
  linjer,
}: {
  bestillingId: string;
  linjer: {
    id: string;
    navn: string;
    nummer: string;
    enhet: string;
    bestilt: number;
    mottatt: number;
  }[];
}) {
  const [venter, start] = useTransition();
  const [verdier, settVerdier] = useState<Record<string, string>>({});
  const [svar, settSvar] = useState<Resultat>();
  const router = useRouter();

  const gjenstaaende = linjer.filter((l) => l.bestilt - l.mottatt > 0.001);

  if (gjenstaaende.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
        <PackageCheck className="size-4 shrink-0" aria-hidden />
        Alt på bestillingen er mottatt.
      </p>
    );
  }

  function registrer() {
    const mottak = gjenstaaende
      .map((l) => ({ linjeId: l.id, antall: Number(verdier[l.id] ?? 0) }))
      .filter((m) => Number.isFinite(m.antall) && m.antall > 0);

    start(async () => {
      const r = await mottaVarer(bestillingId, mottak);
      settSvar(r);
      if (r.ok) {
        settVerdier({});
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-tekst-svak">
        Skriv inn hvor mye som faktisk kom. Delleveranser er normalt — resten
        blir stående som utestående.
      </p>

      <ul className="space-y-2">
        {gjenstaaende.map((l) => {
          const igjen = l.bestilt - l.mottatt;
          return (
            <li key={l.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-tekst">{l.navn}</p>
                <p className="font-mono text-xs text-tekst-svak">
                  {l.nummer} · {tall(igjen)} {l.enhet} utestående
                </p>
              </div>
              <input
                type="number"
                min="0"
                max={igjen}
                step="1"
                value={verdier[l.id] ?? ""}
                onChange={(e) =>
                  settVerdier((f) => ({ ...f, [l.id]: e.target.value }))
                }
                placeholder="0"
                aria-label={`Mottatt antall for ${l.navn}`}
                className="w-24 rounded-lg border-0 bg-flate px-2 py-1.5 text-right text-sm text-tekst ring-1 ring-kant-sterk ring-inset focus:ring-2 focus:ring-merke-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => settVerdier((f) => ({ ...f, [l.id]: String(igjen) }))}
                className="text-xs text-aksent hover:underline"
              >
                alt
              </button>
            </li>
          );
        })}
      </ul>

      {svar && !svar.ok && <Feil melding={svar.feil} />}
      {svar?.ok && svar.melding && (
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-300">
          {svar.melding}
        </p>
      )}

      <Button onClick={registrer} disabled={venter}>
        <PackageCheck className="size-4" aria-hidden />
        {venter ? "Registrerer …" : "Registrer mottak"}
      </Button>
    </div>
  );
}

export function KansellerKnapp({ bestillingId }: { bestillingId: string }) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const [bekreft, settBekreft] = useState(false);
  const router = useRouter();

  if (!bekreft) {
    return (
      <Button variant="sekundær" onClick={() => settBekreft(true)}>
        <Ban className="size-4" aria-hidden />
        Kanseller
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-tekst">Sikker? Bestillingen kan ikke gjenåpnes.</p>
      <div className="flex gap-2">
        <Button
          variant="fare"
          disabled={venter}
          onClick={() =>
            start(async () => {
              const r = await kansellerBestilling(bestillingId);
              settFeil(r.ok ? undefined : r.feil);
              settBekreft(false);
              router.refresh();
            })
          }
        >
          Ja, kanseller
        </Button>
        <Button variant="sekundær" onClick={() => settBekreft(false)}>
          Avbryt
        </Button>
      </div>
      <Feil melding={feil} />
    </div>
  );
}
