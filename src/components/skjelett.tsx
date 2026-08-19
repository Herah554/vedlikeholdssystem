import { cn } from "@/lib/format";

/**
 * Gråtoner som vises mens siden henter data.
 *
 * Poenget er ikke å underholde, men å svare med én gang. Uten noe som dukker
 * opp i det du klikker, blir du stående på den forrige siden og tror
 * systemet henger — selv om ventetiden bare er noen tideler.
 *
 * Formene skal ligne det som kommer, slik at siden ikke hopper når dataene
 * lander.
 */
export function Skjelett({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-flate-dempet", className)}
      aria-hidden
    />
  );
}

/** Sidetopp: overskrift med undertekst. */
export function SkjelettTopp() {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Skjelett className="h-6 w-44" />
        <Skjelett className="mt-2 h-4 w-64" />
      </div>
      <Skjelett className="h-9 w-32" />
    </div>
  );
}

/** Rad med nøkkeltallskort. */
export function SkjelettTall({ antall = 4 }: { antall?: number }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: antall }, (_, i) => (
        <div key={i} className="kort p-4">
          <Skjelett className="h-4 w-24" />
          <Skjelett className="mt-2 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Tabell med et gitt antall rader. */
export function SkjelettTabell({ rader = 8 }: { rader?: number }) {
  return (
    <div className="kort divide-y divide-kant">
      {Array.from({ length: rader }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <Skjelett className="h-4 w-20 shrink-0" />
          <Skjelett className="h-4 flex-1" />
          <Skjelett className="hidden h-5 w-20 shrink-0 sm:block" />
        </div>
      ))}
    </div>
  );
}
