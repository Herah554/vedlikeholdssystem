import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Image as Bilde } from "lucide-react";
import { harFunksjonSession, kanSession, requireModul } from "@/lib/auth";
import {
  APNE_AVVIK,
  AVVIK_ALVOR,
  AVVIK_STATUS,
  AVVIK_TYPE,
  NESTE_AVVIK_STATUS,
  avviksNummer,
} from "@/lib/domene";
import { datoTid, ordreNummer } from "@/lib/format";
import { hentListe } from "@/lib/lister";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { Vedleggsliste } from "@/components/vedlegg";
import { lagreBehandling } from "../actions";
import { Behandling } from "./behandling";

export async function generateMetadata(
  props: PageProps<"/avvik/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireModul("avvik");
  const a = await db.deviation.findFirst({
    where: { id },
    select: { number: true, title: true },
  });
  return { title: a ? `${avviksNummer(a.number)} ${a.title}` : "Avvik" };
}

/** Dato på formatet et date-felt vil ha. */
function somDatoFelt(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function AvvikSide(props: PageProps<"/avvik/[id]">) {
  const { id } = await props.params;
  const { db, session } = await requireModul("avvik");

  const avvik = await db.deviation.findFirst({
    where: { id },
    include: {
      asset: { select: { id: true, code: true, name: true } },
      reportedBy: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      workOrder: { select: { id: true, number: true, title: true } },
      attachments: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!avvik) notFound();

  const kanBehandle = kanSession(session, "avvik", "administrere");
  const kanEndre = kanSession(session, "avvik", "endre");

  const dokumenttyper = await hentListe(db, "dokumenttype", true);

  const ansvarlige = kanBehandle
    ? await db.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const overFrist =
    avvik.deadline !== null &&
    avvik.deadline < new Date() &&
    APNE_AVVIK.includes(avvik.status);

  return (
    <>
      <Link
        href="/avvik"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tilbake til avvik
      </Link>

      <PageHeader
        title={avvik.title}
        description={`${avviksNummer(avvik.number)} · meldt av ${avvik.reportedBy.name} · skjedde ${datoTid(avvik.occurredAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge className={AVVIK_TYPE[avvik.type].klasse}>
              {AVVIK_TYPE[avvik.type].tekst}
            </Badge>
            <Badge className={AVVIK_ALVOR[avvik.severity].klasse}>
              {AVVIK_ALVOR[avvik.severity].tekst}
            </Badge>
            <Badge className={AVVIK_STATUS[avvik.status].klasse}>
              {AVVIK_STATUS[avvik.status].tekst}
            </Badge>
          </div>
        }
      />

      {overFrist && avvik.deadline && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">
          Fristen gikk ut {datoTid(avvik.deadline)}, og avviket står fortsatt
          åpent.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Hva skjedde" />
            <CardBody className="space-y-4">
              <p className="text-sm whitespace-pre-wrap text-tekst">
                {avvik.description}
              </p>

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {avvik.asset && (
                  <div>
                    <dt className="text-tekst-svak">Utstyr</dt>
                    <dd>
                      <Link
                        href={`/anlegg/${avvik.asset.id}`}
                        className="font-medium text-aksent hover:underline"
                      >
                        {avvik.asset.code} · {avvik.asset.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {avvik.location && (
                  <div>
                    <dt className="text-tekst-svak">Sted</dt>
                    <dd className="font-medium text-tekst">{avvik.location}</dd>
                  </div>
                )}
                {avvik.assignedTo && (
                  <div>
                    <dt className="text-tekst-svak">Ansvarlig</dt>
                    <dd className="font-medium text-tekst">
                      {avvik.assignedTo.name}
                    </dd>
                  </div>
                )}
                {avvik.closedAt && (
                  <div>
                    <dt className="text-tekst-svak">Lukket</dt>
                    <dd className="font-medium text-tekst">
                      {datoTid(avvik.closedAt)}
                    </dd>
                  </div>
                )}
              </dl>

              {avvik.workOrder && (
                <div className="rounded-lg bg-flate-dempet p-3">
                  <p className="mb-1 text-xs font-medium text-tekst-svak">
                    Arbeidsordre opprettet for å rette dette
                  </p>
                  <Link
                    href={`/arbeidsordre/${avvik.workOrder.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-aksent hover:underline"
                  >
                    <ClipboardList className="size-4" aria-hidden />
                    {ordreNummer(avvik.workOrder.number)} {avvik.workOrder.title}
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          {!kanBehandle &&
            (avvik.immediateAction || avvik.rootCause || avvik.correctiveAction) && (
              <Card>
                <CardHeader title="Behandling" />
                <CardBody className="space-y-3 text-sm">
                  {avvik.immediateAction && (
                    <div>
                      <p className="text-tekst-svak">Strakstiltak</p>
                      <p className="whitespace-pre-wrap text-tekst">
                        {avvik.immediateAction}
                      </p>
                    </div>
                  )}
                  {avvik.rootCause && (
                    <div>
                      <p className="text-tekst-svak">Årsak</p>
                      <p className="whitespace-pre-wrap text-tekst">
                        {avvik.rootCause}
                      </p>
                    </div>
                  )}
                  {avvik.correctiveAction && (
                    <div>
                      <p className="text-tekst-svak">Tiltak</p>
                      <p className="whitespace-pre-wrap text-tekst">
                        {avvik.correctiveAction}
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

          {harFunksjonSession(session, "vedlegg") && (
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Bilde className="size-4 text-tekst-svak" aria-hidden />
                    Bilder og dokumenter
                  </span>
                }
                description="Et bilde forklarer som regel mer enn beskrivelsen."
              />
              <CardBody>
                <Vedleggsliste
                  feste={{ type: "avvik", id: avvik.id }}
                  kanEndre={kanEndre}
                dokumenttyper={dokumenttyper}
                  vedlegg={avvik.attachments.map((v) => ({
                    id: v.id,
                    fileName: v.fileName,
                    url: v.url,
                    mimeType: v.mimeType,
                    sizeBytes: v.sizeBytes,
                    lastetOppAv: v.uploadedBy?.name ?? null,
                  }))}
                />
              </CardBody>
            </Card>
          )}
        </div>

        {kanBehandle && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader
                title="Behandling"
                description="Årsak og tiltak må fylles ut før avviket kan lukkes."
              />
              <CardBody>
                <Behandling
                  avvikId={avvik.id}
                  lagre={lagreBehandling.bind(null, avvik.id)}
                  standard={{
                    assignedToId: avvik.assignedToId,
                    severity: avvik.severity,
                    immediateAction: avvik.immediateAction,
                    rootCause: avvik.rootCause,
                    correctiveAction: avvik.correctiveAction,
                    deadline: somDatoFelt(avvik.deadline),
                  }}
                  ansvarlige={ansvarlige}
                  neste={NESTE_AVVIK_STATUS[avvik.status]}
                  harArbeidsordre={Boolean(avvik.workOrderId)}
                />
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
