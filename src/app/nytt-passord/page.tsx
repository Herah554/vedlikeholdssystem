import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, LinkIcon } from "lucide-react";
import { gyldigSesjon } from "@/lib/auth";
import { sjekkToken } from "@/lib/passord";
import { NyttPassordSkjema } from "./skjema";

export const metadata: Metadata = { title: "Nytt passord" };

const FORKLARING: Record<string, string> = {
  utlopt: "Lenka er mer enn én time gammel og virker ikke lenger.",
  brukt: "Lenka er allerede brukt. Hver lenke virker bare én gang.",
  ukjent: "Lenka er ikke gyldig. Den kan være skrevet av feil, eller kontoen kan være deaktivert.",
};

export default async function NyttPassordSide(
  props: PageProps<"/nytt-passord">,
) {
  if (await gyldigSesjon()) redirect("/dashbord");

  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const sjekk = await sjekkToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-flate-dempet px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-merke-600 text-white">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-tekst">
            {sjekk.gyldig ? `Hei ${sjekk.navn.split(" ")[0]}` : "Lenka virker ikke"}
          </h1>
          {sjekk.gyldig && (
            <p className="mt-1 text-sm text-tekst-svak">
              Velg et nytt passord til kontoen din
            </p>
          )}
        </div>

        <div className="kort p-6">
          {sjekk.gyldig ? (
            <NyttPassordSkjema token={token} />
          ) : (
            <div className="flex items-start gap-3">
              <LinkIcon className="mt-0.5 size-5 shrink-0 text-tekst-svakest" aria-hidden />
              <div className="text-sm">
                <p className="text-tekst-svak">{FORKLARING[sjekk.grunn]}</p>
                <Link
                  href="/glemt-passord"
                  className="mt-3 inline-block font-medium text-aksent hover:underline"
                >
                  Be om en ny lenke
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-tekst-svak">
          <Link href="/logg-inn" className="font-medium text-aksent hover:underline">
            Tilbake til innlogging
          </Link>
        </p>
      </div>
    </main>
  );
}
