import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, Minus, Package, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";
import {
  FUNKSJONER,
  PLANER,
  PLAN_REKKEFOLGE,
  harFunksjon,
  lesUnntak,
} from "@/lib/planer";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { settAktiv, settFunksjon, settPlan } from "../actions";
import { SlettKort } from "./slettkort";

export const metadata: Metadata = { title: "Kunde" };

export default async function KundeSide(props: PageProps<"/plattform/[id]">) {
  const session = await requireSuperadmin();
  const { id } = await props.params;

  // Direkte mot prisma: dette er plattformsiden, som med hensikt ser på
  // tvers av kunder. requireSuperadmin() over er sperren.
  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      orgNumber: true,
      isActive: true,
      plan: true,
      features: true,
      createdAt: true,
      _count: {
        select: { users: true, assets: true, workOrders: true, deviations: true },
      },
    },
  });

  if (!org) notFound();

  const meg = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { organizationId: true },
  });

  const unntak = lesUnntak(org.features);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/plattform"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle bedrifter
      </Link>

      <PageHeader
        title={org.name}
        description={
          org.orgNumber ? `Org.nr. ${org.orgNumber} · ${org.slug}` : org.slug
        }
        action={
          !org.isActive && (
            <Badge className="bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">
              deaktivert
            </Badge>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Brukere" value={org._count.users} />
        <StatCard label="Utstyr" value={org._count.assets} />
        <StatCard label="Arbeidsordre" value={org._count.workOrders} />
        <StatCard label="Avvik" value={org._count.deviations} />
      </div>

      <Card className="mb-5">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Package className="size-4 text-tekst-svak" aria-hidden />
              Plan
            </span>
          }
          description="Utgangspunktet for hva kunden har tilgang til."
        />
        <CardBody className="space-y-4">
          <form action={settPlan} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={org.id} />
            <div>
              <label
                htmlFor="plan"
                className="mb-1.5 block text-sm font-medium text-tekst"
              >
                Velg plan
              </label>
              <Select id="plan" name="plan" defaultValue={org.plan}>
                {PLAN_REKKEFOLGE.map((p) => (
                  <option key={p} value={p}>
                    {PLANER[p].navn}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-merke-600 px-3 py-2 text-sm font-medium text-white hover:bg-merke-700"
            >
              Lagre plan
            </button>
          </form>

          <ul className="space-y-1.5 text-sm">
            {PLAN_REKKEFOLGE.map((p) => (
              <li
                key={p}
                className={
                  p === org.plan
                    ? "rounded-lg bg-merke-50 px-3 py-2 dark:bg-merke-500/15"
                    : "px-3 py-2"
                }
              >
                <span className="font-medium text-tekst">{PLANER[p].navn}</span>
                <span className="text-tekst-svak"> — {PLANER[p].beskrivelse}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Funksjoner"
          description="«Følg planen» er normalen. Slå en enkelt funksjon på for en prøveperiode, eller av hvis kunden ikke skal ha den."
        />
        <CardBody>
          <ul className="divide-y divide-kant">
            {FUNKSJONER.map((f) => {
              const paa = harFunksjon(org.plan, unntak, f.id);
              const overstyrt = typeof unntak[f.id] === "boolean";
              const valgt = overstyrt ? (unntak[f.id] ? "pa" : "av") : "plan";

              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span
                    aria-hidden
                    className={
                      paa
                        ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "flex size-6 shrink-0 items-center justify-center rounded-full bg-flate-dempet text-tekst-svakest"
                    }
                  >
                    {paa ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </span>

                  <div className="min-w-48 flex-1">
                    <p className="text-sm font-medium text-tekst">
                      {f.navn}
                      {overstyrt && (
                        <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                          overstyrt
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-tekst-svak">{f.beskrivelse}</p>
                  </div>

                  <form action={settFunksjon} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={org.id} />
                    <input type="hidden" name="funksjon" value={f.id} />
                    <Select
                      name="verdi"
                      defaultValue={valgt}
                      aria-label={`Tilgang til ${f.navn}`}
                      className="w-auto py-1 text-xs"
                    >
                      <option value="plan">Følg planen</option>
                      <option value="pa">Slå på</option>
                      <option value="av">Slå av</option>
                    </Select>
                    <button
                      type="submit"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-tekst-svak ring-1 ring-kant-sterk ring-inset hover:bg-flate-hover hover:text-tekst"
                    >
                      Lagre
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 flex items-start gap-2 text-xs text-tekst-svak">
            <Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Arbeidsordre, anlegg, reservedeler, ukeplan, forebyggende og
            rapporter er med i alle planer. Et vedlikeholdssystem uten
            arbeidsordre er ikke et vedlikeholdssystem.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Download className="size-4 text-tekst-svak" aria-hidden />
              Ta en kopi
            </span>
          }
          description="Hele bedriften i én fil"
        />
        <CardBody>
          <p className="mb-3 text-sm text-tekst-svak">
            Sikkerhetskopien du kan forklare på ett minutt. Ta den før du
            gjør noe som ikke kan angres.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/plattform/${org.id}/eksport`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tekst ring-1 ring-kant-sterk ring-inset hover:bg-flate-hover"
            >
              <Download className="size-4" aria-hidden />
              JSON
            </a>
            <a
              href={`/plattform/${org.id}/eksport?format=xlsx`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tekst-svak ring-1 ring-kant ring-inset hover:bg-flate-hover hover:text-tekst"
            >
              Regneark
            </a>
          </div>
        </CardBody>
      </Card>

      {org.id !== meg.organizationId && (
        <SlettKort
          id={org.id}
          navn={org.name}
          aktiv={org.isActive}
          innhold={{
            brukere: org._count.users,
            anlegg: org._count.assets,
            arbeidsordre: org._count.workOrders,
            avvik: org._count.deviations,
          }}
          deaktiver={settAktiv}
        />
      )}
    </main>
  );
}
