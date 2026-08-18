"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Globalt søk i toppen. Sender brukeren til arbeidsordrelista med
 * søketeksten som filter — det er der teknikere leter oftest.
 */
export function Sok() {
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const felt = new FormData(e.currentTarget).get("q");
        const tekst = String(felt ?? "").trim();
        if (tekst) router.push(`/arbeidsordre?sok=${encodeURIComponent(tekst)}`);
      }}
      className="relative max-w-md flex-1"
      role="search"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tekst-svakest"
        aria-hidden
      />
      <input
        name="q"
        type="search"
        placeholder="Søk i arbeidsordre …"
        aria-label="Søk i arbeidsordre"
        className="w-full rounded-lg border-0 bg-flate-dempet py-2 pr-3 pl-9 text-sm text-tekst placeholder:text-tekst-svak focus:bg-flate focus:ring-2 focus:ring-merke-600 focus:ring-inset focus:outline-none"
      />
    </form>
  );
}
