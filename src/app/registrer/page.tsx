import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Sparkles, Wrench } from "lucide-react";
import { gyldigSesjon } from "@/lib/auth";
import { registreringStatus } from "@/lib/registrering";
import { RegistrerSkjema } from "./skjema";

export const metadata: Metadata = { title: "Registrer bedrift" };

export default async function RegistrerSide() {
  if (await gyldigSesjon()) redirect("/dashbord");

  const status = await registreringStatus();

  return (
    <main className="flex min-h-screen items-center justify-center bg-flate-dempet px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-merke-600 text-white">
            <Wrench className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-tekst">
            {status.apen ? "Registrer bedriften din" : "Registrering er stengt"}
          </h1>
          {status.apen && (
            <p className="mt-1 text-sm text-tekst-svak">
              Bedriften får sitt eget adskilte område. Ingen andre kunder ser
              dataene dine.
            </p>
          )}
        </div>

        {status.apen ? (
          <>
            {status.forstegangsoppsett && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 ring-inset dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
                <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Førstegangsoppsett</p>
                  <p className="mt-0.5">
                    Databasen er tom, så denne siden er åpen for å få opprettet
                    den første bedriften. Etterpå stenges den automatisk.
                  </p>
                </div>
              </div>
            )}

            <div className="kort p-6">
              <RegistrerSkjema />
            </div>
          </>
        ) : (
          <div className="kort p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-flate-dempet text-tekst-svak">
                <Lock className="size-4" aria-hidden />
              </div>
              <div className="text-sm text-tekst-svak">
                <p className="font-medium text-tekst">
                  Denne serveren tar ikke imot nye bedrifter
                </p>
                <p className="mt-1">
                  Jobber du her, be administratoren i firmaet ditt om en konto.
                </p>
                <p className="mt-3">
                  Skal bedriften din begynne å bruke systemet, tar du kontakt
                  med den som drifter det. Kontoene opprettes derfra.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-tekst-svak">
          Har dere allerede en konto?{" "}
          <Link href="/logg-inn" className="font-medium text-aksent hover:underline">
            Logg inn
          </Link>
        </p>
      </div>
    </main>
  );
}
