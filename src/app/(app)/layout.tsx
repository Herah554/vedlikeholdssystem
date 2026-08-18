import { cookies } from "next/headers";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { tilbakeTilEgen } from "@/app/plattform/actions";
import { ROLLE } from "@/lib/domene";
import { MobilMeny, Sidemeny } from "@/components/navigasjon";
import { Sok } from "@/components/sok";
import { TemaVelger, type Tema } from "@/components/tema";
import { loggUt } from "@/app/logg-inn/actions";

/**
 * Skallet rundt alle innloggede sider.
 *
 * requireSession() kjører før noe innhold vises, så en utlogget bruker blir
 * sendt til innloggingssiden uansett hvilken adresse hen prøver seg på.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const lagretTema = (await cookies()).get("tema")?.value;
  const tema: Tema =
    lagretTema === "lys" || lagretTema === "mork" ? lagretTema : "system";

  // Satt bare når du som plattformeier ser på en annen bedrift enn din egen.
  // Da skal det være umulig å glemme hvem sitt system man står i.
  const besoker = session.hjemOrganisasjonId ? session.hjemOrganisasjonNavn : null;

  return (
    <div className="flex min-h-screen flex-col">
      {besoker && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            Du ser på <strong>{session.organizationName}</strong> som
            plattformeier
          </span>
          <form action={tilbakeTilEgen}>
            <button
              type="submit"
              className="underline underline-offset-2 hover:no-underline"
            >
              Tilbake til {besoker}
            </button>
          </form>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <Sidemeny organisasjon={session.organizationName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-kant bg-flate/95 px-4 py-2.5 backdrop-blur">
          <MobilMeny organisasjon={session.organizationName} />

          <Sok />

          <div className="ml-auto flex items-center gap-3">
            {session.superadmin && (
              <Link
                href="/plattform"
                title="Plattform"
                className="rounded-lg p-2 text-tekst-svak transition-colors hover:bg-flate-dempet hover:text-tekst"
              >
                <ShieldCheck className="size-4" aria-hidden />
                <span className="sr-only">Plattform</span>
              </Link>
            )}

            <TemaVelger start={tema} />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-tekst">{session.name}</p>
              <p className="text-xs text-tekst-svak">{ROLLE[session.role]}</p>
            </div>
            <form action={loggUt}>
              <button
                type="submit"
                className="rounded-lg p-2 text-tekst-svak transition-colors hover:bg-flate-dempet hover:text-tekst"
                title="Logg ut"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only">Logg ut</span>
              </button>
            </form>
          </div>
        </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
