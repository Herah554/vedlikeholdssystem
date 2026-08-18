import { Suspense } from "react";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { ButtonLink, PageHeader } from "@/components/ui";
import { Widget } from "@/components/widgets";
import { STANDARD_OPPSETT, type WidgetOppsett } from "@/components/widget-katalog";
import { hentOppsett } from "./oppsett";
import { Rutenett } from "./rutenett";

export const metadata: Metadata = { title: "Dashbord" };

/** Plassholder mens en widget henter tallene sine. */
function Skjelett({ bred }: { bred: boolean }) {
  return (
    <div
      className={`kort animate-pulse ${bred ? "h-72" : "h-24"}`}
      aria-hidden
    />
  );
}

export default async function DashbordSide() {
  const { db, session } = await requireTenant();
  const oppsett: WidgetOppsett[] =
    (await hentOppsett(db, session.userId)) ?? STANDARD_OPPSETT;

  const time = new Date().getHours();
  const hilsen = time < 10 ? "God morgen" : time < 17 ? "God dag" : "God kveld";

  // Widgetene tegnes ferdig her på serveren og sendes videre til rutenettet,
  // som bare styrer plasseringen. Da slipper klientkoden å vite noe om data.
  const widgets = oppsett.map((w) => (
    <Suspense key={w.id} fallback={<Skjelett bred={w.w === 2} />}>
      <Widget type={w.type} db={db} session={session} />
    </Suspense>
  ));

  return (
    <>
      <PageHeader
        title={`${hilsen}, ${session.name.split(" ")[0]}`}
        description="Oversikt over driften akkurat nå"
        action={
          <ButtonLink href="/dashbord/tilpass" variant="sekundær">
            <SlidersHorizontal className="size-4" aria-hidden />
            Legg til widgets
          </ButtonLink>
        }
      />

      <Rutenett oppsett={oppsett} widgets={widgets} />
    </>
  );
}
