import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireModul } from "@/lib/auth";
import { etikettOppslag, hentListe } from "@/lib/lister";
import { sokArbeidsordre } from "@/lib/sok";
import {
  APNE_STATUSER,
  ORDRE_STATUS,
  PRIORITET,
} from "@/lib/domene";
import { dato, ordreNummer, relativTid } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { Filtre } from "./filtre";
import type {
  Priority,
  WorkOrderStatus,
} from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Arbeidsordre" };

function somEnum<T extends string>(verdi: unknown, gyldige: readonly T[]): T | undefined {
  return typeof verdi === "string" && (gyldige as readonly string[]).includes(verdi)
    ? (verdi as T)
    : undefined;
}

export default async function ArbeidsordreSide(props: PageProps<"/arbeidsordre">) {
  const { db, session } = await requireModul("arbeidsordre");
  const sp = await props.searchParams;

  const sok = typeof sp.sok === "string" ? sp.sok.trim() : "";
  const status = somEnum<WorkOrderStatus>(sp.status, [
    "MELDT", "GODKJENT", "PLANLAGT", "PAAGAAR", "VENTER_DELER", "UTFORT", "LUKKET", "AVVIST",
  ]);
  const prioritet = somEnum<Priority>(sp.prioritet, ["KRITISK", "HOY", "NORMAL", "LAV"]);
  // Typene er ikke lenger faste. Filteret kontrolleres mot det firmaet
  // faktisk har satt opp, slik at en adresse med en oppdiktet type ikke
  // gir en tom liste uten forklaring.
  const typer = await hentListe(db, "ordretype");
  const type = typer.some((t) => t.code === sp.type)
    ? (sp.type as string)
    : undefined;
  const typeEtikett = etikettOppslag(typer);
  const kunMine = sp.mine === "1";
  const kunApne = sp.apne === "1";

  // Fritekstsøket går gjennom Postgres sin rangering, så når brukeren søker
  // henter vi id-ene derfra og beholder rekkefølgen på treffene.
  let idFilter: string[] | undefined;
  if (sok) {
    const treff = await sokArbeidsordre(session.organizationId, sok, { antall: 100 });
    idFilter = treff.map((t) => t.id);
    if (idFilter.length === 0) idFilter = ["ingen-treff"];
  }

  const ordrer = await db.workOrder.findMany({
    where: {
      ...(idFilter ? { id: { in: idFilter } } : {}),
      ...(status ? { status } : {}),
      ...(kunApne && !status ? { status: { in: APNE_STATUSER } } : {}),
      ...(prioritet ? { priority: prioritet } : {}),
      ...(type ? { type } : {}),
      ...(kunMine ? { assignedToId: session.userId } : {}),
    },
    include: {
      asset: { select: { code: true, name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: sok ? undefined : [{ createdAt: "desc" }],
    take: 200,
  });

  // Behold treffrekkefølgen fra søket
  const sortert = idFilter
    ? [...ordrer].sort(
        (a, b) => idFilter!.indexOf(a.id) - idFilter!.indexOf(b.id),
      )
    : ordrer;

  return (
    <>
      <PageHeader
        title="Arbeidsordre"
        description={
          sok
            ? `${sortert.length} treff for «${sok}»`
            : `${sortert.length} ordre${sortert.length === 200 ? " (viser de nyeste)" : ""}`
        }
        action={
          <ButtonLink href="/arbeidsordre/ny">
            <Plus className="size-4" aria-hidden />
            Ny arbeidsordre
          </ButtonLink>
        }
      />

      <Filtre
        typer={typer.filter((t) => t.isActive)}
        verdier={{ sok, status, prioritet, type, mine: kunMine, apne: kunApne }}
      />

      <Card className="mt-4">
        {sortert.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-10" />}
            title={sok ? "Ingen treff" : "Ingen arbeidsordre"}
            description={
              sok
                ? "Prøv færre eller andre ord. Søket leter i tittel, beskrivelse og løsning."
                : "Opprett den første arbeidsordren for å komme i gang."
            }
            action={
              !sok && (
                <ButtonLink href="/arbeidsordre/ny">
                  <Plus className="size-4" aria-hidden />
                  Ny arbeidsordre
                </ButtonLink>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-24">Nummer</Th>
                <Th>Tittel</Th>
                <Th className="hidden md:table-cell">Utstyr</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Prioritet</Th>
                <Th className="hidden lg:table-cell">Tildelt</Th>
                <Th className="hidden lg:table-cell">Frist</Th>
              </tr>
            </thead>
            <tbody>
              {sortert.map((o) => (
                <Tr key={o.id}>
                  <Td className="font-mono text-xs text-tekst-svak">
                    <Link href={`/arbeidsordre/${o.id}`} className="hover:text-aksent">
                      {ordreNummer(o.number)}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/arbeidsordre/${o.id}`}
                      className="font-medium text-tekst hover:text-aksent"
                    >
                      {o.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge className={typeEtikett(o.type).klasse}>
                        {typeEtikett(o.type).tekst}
                      </Badge>
                      <span className="text-xs text-tekst-svakest">
                        {relativTid(o.createdAt)}
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden text-sm text-tekst-svak md:table-cell">
                    {o.asset ? (
                      <span className="whitespace-nowrap">
                        <span className="font-mono text-xs">{o.asset.code}</span>
                        <br />
                        <span className="text-xs text-tekst-svak">{o.asset.name}</span>
                      </span>
                    ) : (
                      <span className="text-tekst-svakest">–</span>
                    )}
                  </Td>
                  <Td>
                    <Badge className={ORDRE_STATUS[o.status].klasse}>
                      {ORDRE_STATUS[o.status].tekst}
                    </Badge>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Badge className={PRIORITET[o.priority].klasse}>
                      {PRIORITET[o.priority].tekst}
                    </Badge>
                  </Td>
                  <Td className="hidden text-sm text-tekst-svak lg:table-cell">
                    {o.assignedTo?.name ?? <span className="text-tekst-svakest">Ikke tildelt</span>}
                  </Td>
                  <Td className="hidden text-sm whitespace-nowrap lg:table-cell">
                    {o.dueDate ? (
                      <span
                        className={
                          o.dueDate < new Date() && APNE_STATUSER.includes(o.status)
                            ? "font-medium text-red-600 dark:text-red-400"
                            : "text-tekst-svak"
                        }
                      >
                        {dato(o.dueDate)}
                      </span>
                    ) : (
                      <span className="text-tekst-svakest">–</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
