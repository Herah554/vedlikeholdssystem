import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { kanSession, krevFunksjon, requireTenant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Importskjema } from "./skjema";

export const metadata: Metadata = { title: "Importer fra regneark" };

export default async function ImportSide() {
  const { session } = await requireTenant();
  krevFunksjon(session, "import");

  // Den som ikke kan administrere hverken utstyr eller deler, har ingenting
  // her å gjøre. Selve valget kontrolleres på nytt i server-handlingen.
  const kanNoe =
    kanSession(session, "anlegg", "administrere") ||
    kanSession(session, "reservedeler", "administrere");
  if (!kanNoe) notFound();

  return (
    <>
      <PageHeader
        title="Importer fra regneark"
        description="Få inn utstyrslista og reservedelene uten å skrive dem inn på nytt."
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 ring-inset dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Importen kan kjøres om igjen</p>
          <p className="mt-0.5">
            Koden og delenummeret er nøkkelen. Finnes raden fra før, blir den
            oppdatert — ikke lagt inn på nytt. Rett en feil i regnearket og last
            opp den samme fila igjen.
          </p>
        </div>
      </div>

      <Importskjema />
    </>
  );
}
