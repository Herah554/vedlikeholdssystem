import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { gyldigSesjon } from "@/lib/auth";
import { GlemtSkjema } from "./skjema";

export const metadata: Metadata = { title: "Glemt passord" };

export default async function GlemtPassordSide() {
  if (await gyldigSesjon()) redirect("/dashbord");

  return (
    <main className="flex min-h-screen items-center justify-center bg-flate-dempet px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-merke-600 text-white">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-tekst">Glemt passord</h1>
          <p className="mt-1 text-sm text-tekst-svak">
            Skriv inn e-postadressen du logger inn med
          </p>
        </div>

        <div className="kort p-6">
          <GlemtSkjema />
        </div>

        <p className="mt-6 text-center text-sm text-tekst-svak">
          <Link
            href="/logg-inn"
            className="font-medium text-aksent hover:underline"
          >
            Tilbake til innlogging
          </Link>
        </p>
      </div>
    </main>
  );
}
