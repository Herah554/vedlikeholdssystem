import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Mail, Truck } from "lucide-react";
import { kanSession, requireModul } from "@/lib/auth";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { NyLeverandorSkjema } from "./skjema";

export const metadata: Metadata = { title: "Leverandører" };

export default async function LeverandorerSide() {
  const { db, session } = await requireModul("leverandorer");
  const kanEndre = kanSession(session, "leverandorer", "administrere");

  const leverandorer = await db.supplier.findMany({
    include: {
      _count: { select: { parts: true, purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  const utenEpost = leverandorer.filter((l) => !l.email).length;

  return (
    <>
      <PageHeader
        title="Leverandører"
        description="Kontaktopplysningene bestillingene sendes til"
      />

      {utenEpost > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {utenEpost} {utenEpost === 1 ? "leverandør mangler" : "leverandører mangler"}{" "}
            e-postadresse. Uten adresse kan bestillingen lages, men ikke sendes
            herfra.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Registrerte leverandører"
              description={`${leverandorer.length} totalt`}
            />
            {leverandorer.length === 0 ? (
              <EmptyState
                icon={<Truck className="size-10" />}
                title="Ingen leverandører ennå"
                description="Legg inn den første for å kunne sende bestillinger på deler."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Firma</Th>
                    <Th className="hidden sm:table-cell">Kontakt</Th>
                    <Th>E-post</Th>
                    <Th className="hidden text-right lg:table-cell">Deler</Th>
                    <Th className="hidden text-right lg:table-cell">Bestillinger</Th>
                  </tr>
                </thead>
                <tbody>
                  {leverandorer.map((l) => (
                    <Tr key={l.id}>
                      <Td>
                        {kanEndre ? (
                          <Link
                            href={`/leverandorer/${l.id}`}
                            className="text-sm font-medium text-tekst hover:text-aksent"
                          >
                            {l.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-tekst">{l.name}</span>
                        )}
                        {l.phone && (
                          <div className="text-xs text-tekst-svak">{l.phone}</div>
                        )}
                      </Td>
                      <Td className="hidden text-sm text-tekst-svak sm:table-cell">
                        {l.contactName ?? "–"}
                      </Td>
                      <Td>
                        {l.email ? (
                          <a
                            href={`mailto:${l.email}`}
                            className="inline-flex items-center gap-1.5 text-sm text-aksent hover:underline"
                          >
                            <Mail className="size-3.5" aria-hidden />
                            {l.email}
                          </a>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                            mangler
                          </Badge>
                        )}
                      </Td>
                      <Td className="hidden text-right text-sm text-tekst-svak tabular-nums lg:table-cell">
                        {l._count.parts}
                      </Td>
                      <Td className="hidden text-right text-sm text-tekst-svak tabular-nums lg:table-cell">
                        {l._count.purchaseOrders}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {kanEndre && (
          <Card className="h-fit">
            <CardHeader title="Ny leverandør" />
            <CardBody>
              <NyLeverandorSkjema />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
