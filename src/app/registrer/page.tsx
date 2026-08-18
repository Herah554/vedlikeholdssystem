import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getSession } from "@/lib/auth";
import { RegistrerSkjema } from "./skjema";

export const metadata: Metadata = { title: "Registrer bedrift" };

export default async function RegistrerSide() {
  if (await getSession()) redirect("/dashbord");

  return (
    <main className="flex min-h-screen items-center justify-center bg-flate-dempet px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-merke-600 text-white">
            <Wrench className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-tekst">Registrer bedriften din</h1>
          <p className="mt-1 text-sm text-tekst-svak">
            Bedriften får sitt eget adskilte område. Ingen andre kunder ser
            dataene dine.
          </p>
        </div>

        <div className="kort p-6">
          <RegistrerSkjema />
        </div>

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
