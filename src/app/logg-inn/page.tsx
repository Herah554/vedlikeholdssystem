import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginSkjema } from "./skjema";

export const metadata: Metadata = { title: "Logg inn" };

export default async function LoggInnSide() {
  // Allerede innlogget? Da er det ingen grunn til å vise skjemaet.
  if (await getSession()) redirect("/dashbord");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-merke-600 text-white">
            <Wrench className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Vedlikeholdssystem
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Logg inn for å se arbeidsordrene dine
          </p>
        </div>

        <div className="kort p-6">
          <LoginSkjema />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Har du ikke konto? Be administratoren i firmaet ditt om tilgang.
        </p>
      </div>
    </main>
  );
}
