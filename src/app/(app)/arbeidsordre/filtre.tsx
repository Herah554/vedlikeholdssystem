"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { ORDRE_STATUS, PRIORITET } from "@/lib/domene";
import { Select } from "@/components/ui";

type Verdier = {
  sok: string;
  status?: string;
  prioritet?: string;
  type?: string;
  mine: boolean;
  apne: boolean;
};

/**
 * Filterlinja over arbeidsordrelista.
 *
 * Alle valg legges i adressen, ikke i komponenttilstand. Da kan en tekniker
 * lagre eller dele en filtrert liste som en helt vanlig lenke.
 */
export function Filtre({
  verdier,
  typer,
}: {
  verdier: Verdier;
  /** Typene firmaet har satt opp. Se src/lib/lister.ts. */
  typer: { code: string; name: string }[];
}) {
  const router = useRouter();
  const skjema = useRef<HTMLFormElement>(null);

  function oppdater(endring: Partial<Record<string, string | null>>) {
    const params = new URLSearchParams();
    const neste = {
      sok: verdier.sok || null,
      status: verdier.status ?? null,
      prioritet: verdier.prioritet ?? null,
      type: verdier.type ?? null,
      mine: verdier.mine ? "1" : null,
      apne: verdier.apne ? "1" : null,
      ...endring,
    };

    for (const [nøkkel, verdi] of Object.entries(neste)) {
      if (verdi) params.set(nøkkel, verdi);
    }
    const spørring = params.toString();
    router.push(spørring ? `/arbeidsordre?${spørring}` : "/arbeidsordre");
  }

  const harFilter =
    verdier.sok || verdier.status || verdier.prioritet || verdier.type ||
    verdier.mine || verdier.apne;

  return (
    <div className="kort flex flex-wrap items-center gap-2 p-3">
      <form
        ref={skjema}
        onSubmit={(e) => {
          e.preventDefault();
          const felt = new FormData(e.currentTarget).get("sok");
          oppdater({ sok: String(felt ?? "").trim() || null });
        }}
        className="relative min-w-56 flex-1"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tekst-svakest"
          aria-hidden
        />
        <input
          name="sok"
          type="search"
          defaultValue={verdier.sok}
          placeholder="Søk i tittel, beskrivelse og løsning …"
          aria-label="Søk i arbeidsordre"
          className="w-full rounded-lg border-0 bg-flate py-2 pr-3 pl-9 text-sm ring-1 ring-kant-sterk ring-inset placeholder:text-tekst-svakest focus:ring-2 focus:ring-merke-600 focus:outline-none"
        />
      </form>

      <Select
        aria-label="Status"
        value={verdier.status ?? ""}
        onChange={(e) => oppdater({ status: e.target.value || null })}
        className="w-auto"
      >
        <option value="">Alle statuser</option>
        {Object.entries(ORDRE_STATUS).map(([verdi, e]) => (
          <option key={verdi} value={verdi}>{e.tekst}</option>
        ))}
      </Select>

      <Select
        aria-label="Prioritet"
        value={verdier.prioritet ?? ""}
        onChange={(e) => oppdater({ prioritet: e.target.value || null })}
        className="w-auto"
      >
        <option value="">Alle prioriteter</option>
        {Object.entries(PRIORITET).map(([verdi, e]) => (
          <option key={verdi} value={verdi}>{e.tekst}</option>
        ))}
      </Select>

      <Select
        aria-label="Type"
        value={verdier.type ?? ""}
        onChange={(e) => oppdater({ type: e.target.value || null })}
        className="w-auto"
      >
        <option value="">Alle typer</option>
        {typer.map((t) => (
          <option key={t.code} value={t.code}>{t.name}</option>
        ))}
      </Select>

      <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-tekst hover:bg-flate-hover">
        <input
          type="checkbox"
          checked={verdier.mine}
          onChange={(e) => oppdater({ mine: e.target.checked ? "1" : null })}
          className="size-4 rounded border-kant-sterk text-aksent focus:ring-merke-600"
        />
        Mine
      </label>

      <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-tekst hover:bg-flate-hover">
        <input
          type="checkbox"
          checked={verdier.apne}
          onChange={(e) => oppdater({ apne: e.target.checked ? "1" : null })}
          className="size-4 rounded border-kant-sterk text-aksent focus:ring-merke-600"
        />
        Kun åpne
      </label>

      {harFilter && (
        <button
          type="button"
          onClick={() => router.push("/arbeidsordre")}
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-tekst-svak hover:bg-flate-dempet hover:text-tekst"
        >
          <X className="size-4" aria-hidden />
          Nullstill
        </button>
      )}
    </div>
  );
}
