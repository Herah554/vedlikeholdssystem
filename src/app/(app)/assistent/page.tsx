import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Chat } from "./chat";
import type { Kilde } from "@/app/api/assistent/route";

export const metadata: Metadata = { title: "Assistent" };

export default async function AssistentSide() {
  const { db, session } = await requireTenant();

  // Fortsett siste samtale, slik at teknikeren kan gå ut i anlegget,
  // komme tilbake og finne igjen tråden.
  const samtale = await db.conversation.findFirst({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
  });

  const harNokkel = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <PageHeader
        title="Assistent"
        description="Søker i all historikk og hjelper med feilsøking"
      />

      {!harNokkel && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 ring-inset">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">AI-en er ikke koblet til ennå</p>
            <p className="mt-0.5 text-sky-800">
              Søket i arbeidsordrehistorikken virker allerede — prøv å beskrive en
              feil nedenfor. For forslag til feilsøking og søk på nettet, legg inn{" "}
              <code className="rounded bg-sky-100 px-1 py-0.5 font-mono text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              i <code className="font-mono text-xs">.env</code> og start serveren på nytt.
            </p>
          </div>
        </div>
      )}

      <Chat
        startSamtale={samtale?.id}
        startMeldinger={
          samtale?.messages.map((m) => ({
            id: m.id,
            rolle: m.role === "USER" ? ("bruker" as const) : ("assistent" as const),
            tekst: m.content,
            kilder: Array.isArray(m.citations) ? (m.citations as Kilde[]) : [],
          })) ?? []
        }
      />
    </>
  );
}
