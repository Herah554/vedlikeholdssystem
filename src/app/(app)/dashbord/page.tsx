import { Suspense } from "react";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { ButtonLink, PageHeader } from "@/components/ui";
import { Widget } from "@/components/widgets";
import {
  STANDARD_OPPSETT,
  type WidgetOppsett,
} from "@/components/widget-katalog";
import { hentOppsett } from "./oppsett";

export const metadata: Metadata = { title: "Dashbord" };

/** Plassholder mens en widget henter tallene sine. */
function Skjelett({ bred }: { bred: boolean }) {
  return (
    <div
      className={`kort animate-pulse ${bred ? "sm:col-span-2" : ""} ${bred ? "h-72" : "h-24"}`}
      aria-hidden
    />
  );
}

export default async function DashbordSide() {
  const { db, session } = await requireTenant();
  const oppsett: WidgetOppsett[] = (await hentOppsett(db, session.userId)) ?? STANDARD_OPPSETT;

  const time = new Date().getHours();
  const hilsen = time < 10 ? "God morgen" : time < 17 ? "God dag" : "God kveld";

  return (
    <>
      <PageHeader
        title={`${hilsen}, ${session.name.split(" ")[0]}`}
        description="Oversikt over driften akkurat nå"
        action={
          <ButtonLink href="/dashbord/tilpass" variant="sekundær">
            <SlidersHorizontal className="size-4" aria-hidden />
            Tilpass dashbord
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {oppsett.map((w) => (
          <div key={w.id} className={w.w === 2 ? "sm:col-span-2" : ""}>
            {/* Hver widget strømmes inn for seg, så trege spørringer ikke
                holder igjen resten av siden. */}
            <Suspense fallback={<Skjelett bred={w.w === 2} />}>
              <Widget type={w.type} db={db} session={session} />
            </Suspense>
          </div>
        ))}
      </div>
    </>
  );
}
