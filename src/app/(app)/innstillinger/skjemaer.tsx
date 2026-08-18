"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Plus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { ROLLE, ROLLE_BESKRIVELSE } from "@/lib/domene";
import type { Role } from "@/generated/prisma/client";
import {
  endreRolle,
  opprettBruker,
  opprettBudsjett,
  opprettKostnadssted,
  oppdaterOrganisasjon,
  settAktiv,
  type Resultat,
} from "./actions";

function Tilbakemelding({ state }: { state: Resultat }) {
  if (state.feil) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.feil}
      </p>
    );
  }
  if (state.melding) {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
        <Check className="size-4 shrink-0" aria-hidden />
        {state.melding}
      </p>
    );
  }
  return null;
}

function Lagre({ tekst }: { tekst: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Lagrer …" : tekst}
    </Button>
  );
}

export function RolleVelger({
  brukerId,
  rolle,
  kanEndre,
}: {
  brukerId: string;
  rolle: Role;
  kanEndre: boolean;
}) {
  const [venter, start] = useTransition();
  const router = useRouter();

  if (!kanEndre) {
    return <span className="text-sm text-tekst-svak">{ROLLE[rolle]}</span>;
  }

  return (
    <Select
      value={rolle}
      disabled={venter}
      aria-label="Rolle"
      className="w-auto py-1 text-xs"
      onChange={(e) =>
        start(async () => {
          const svar = await endreRolle(brukerId, e.target.value as Role);
          if (!svar.ok && svar.feil) alert(svar.feil);
          router.refresh();
        })
      }
    >
      {Object.entries(ROLLE).map(([verdi, tekst]) => (
        <option key={verdi} value={verdi}>{tekst}</option>
      ))}
    </Select>
  );
}

export function AktivBryter({
  brukerId,
  aktiv,
  kanEndre,
}: {
  brukerId: string;
  aktiv: boolean;
  kanEndre: boolean;
}) {
  const [venter, start] = useTransition();
  const router = useRouter();

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-tekst-svak">
      <input
        type="checkbox"
        checked={aktiv}
        disabled={venter || !kanEndre}
        onChange={(e) =>
          start(async () => {
            const svar = await settAktiv(brukerId, e.target.checked);
            if (!svar.ok && svar.feil) alert(svar.feil);
            router.refresh();
          })
        }
        className="size-4 rounded border-kant-sterk text-aksent focus:ring-merke-600 disabled:opacity-40"
      />
      Aktiv
    </label>
  );
}

export function NyBrukerSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(opprettBruker, { ok: true });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Navn" required>
          <Input name="name" required placeholder="Ola Nordmann" autoComplete="off" />
        </Field>
        <Field label="E-post" required>
          <Input name="email" type="email" required placeholder="ola@firma.no" autoComplete="off" />
        </Field>
      </div>

      <Field label="Rolle" required hint={ROLLE_BESKRIVELSE.TEKNIKER}>
        <Select name="role" defaultValue="TEKNIKER" required>
          {Object.entries(ROLLE).map(([verdi, tekst]) => (
            <option key={verdi} value={verdi}>{tekst}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <Input name="phone" placeholder="900 00 000" autoComplete="off" />
        </Field>
        <Field label="Timepris (kr)" hint="La stå tom for å bruke firmaets sats">
          <Input name="hourlyRate" type="number" min="0" step="10" placeholder="950" />
        </Field>
      </div>

      <Field
        label="Midlertidig passord"
        required
        hint="Minst åtte tegn. Gi det til brukeren på en trygg måte, og be hen bytte det."
      >
        <Input name="password" type="text" required minLength={8} autoComplete="new-password" />
      </Field>

      <Tilbakemelding state={state} />
      <Lagre tekst="Opprett bruker" />
    </form>
  );
}

export function NyttKostnadsstedSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(opprettKostnadssted, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Kode" required>
          <Input name="code" required maxLength={20} placeholder="400" className="font-mono" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Navn" required>
            <Input name="name" required placeholder="Lager og logistikk" />
          </Field>
        </div>
      </div>
      <Tilbakemelding state={state} />
      <Lagre tekst="Legg til kostnadssted" />
    </form>
  );
}

export function NyBudsjettSkjema({
  kostnadssteder,
}: {
  kostnadssteder: { id: string; etikett: string }[];
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettBudsjett, {
    ok: true,
  });
  const iAr = new Date().getFullYear();

  if (kostnadssteder.length === 0) {
    return (
      <p className="text-sm text-tekst-svak">
        Opprett et kostnadssted først — budsjettet knyttes til det.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field label="Navn" required>
        <Input name="name" required placeholder={`Teknisk drift ${iAr}`} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kostnadssted" required>
          <Select name="costCenterId" required defaultValue="">
            <option value="" disabled>Velg …</option>
            {kostnadssteder.map((k) => (
              <option key={k.id} value={k.id}>{k.etikett}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kategori" required>
          <Select name="category" defaultValue="TOTALT" required>
            <option value="TOTALT">Totalt</option>
            <option value="ARBEID">Arbeid</option>
            <option value="DELER">Deler</option>
            <option value="TJENESTER">Innleide tjenester</option>
          </Select>
        </Field>
        <Field label="År" required>
          <Input name="year" type="number" min="2000" max="2100" defaultValue={iAr} required />
        </Field>
        <Field label="Beløp (kr)" required>
          <Input name="amount" type="number" min="0" step="1000" required placeholder="1200000" />
        </Field>
      </div>
      <Tilbakemelding state={state} />
      <Lagre tekst="Legg til budsjett" />
    </form>
  );
}

export function OrganisasjonSkjema({
  organisasjon,
}: {
  organisasjon: {
    name: string;
    orgNumber: string | null;
    hourlyRate: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
  };
}) {
  const [state, action] = useActionState<Resultat, FormData>(
    oppdaterOrganisasjon,
    { ok: true },
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firmanavn" required>
          <Input name="name" defaultValue={organisasjon.name} required />
        </Field>
        <Field label="Organisasjonsnummer">
          <Input
            name="orgNumber"
            defaultValue={organisasjon.orgNumber ?? ""}
            placeholder="912345678"
          />
        </Field>
      </div>

      <Field
        label="Standard timepris (kr)"
        required
        hint="Brukes for brukere som ikke har egen sats. Endringen gjelder bare nye timeføringer — historiske kostnader står som de er."
      >
        <Input
          name="hourlyRate"
          type="number"
          min="0"
          step="10"
          defaultValue={organisasjon.hourlyRate}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-post" hint="Avsender på bestillinger til leverandør">
          <Input name="email" type="email" defaultValue={organisasjon.email ?? ""} />
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={organisasjon.phone ?? ""} />
        </Field>
      </div>

      <Field label="Adresse" hint="Leveringsadresse på bestillinger">
        <Input name="address" defaultValue={organisasjon.address ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postnummer">
          <Input name="postalCode" defaultValue={organisasjon.postalCode ?? ""} />
        </Field>
        <Field label="Sted">
          <Input name="city" defaultValue={organisasjon.city ?? ""} />
        </Field>
      </div>

      <Tilbakemelding state={state} />
      <Lagre tekst="Lagre organisasjon" />
    </form>
  );
}
