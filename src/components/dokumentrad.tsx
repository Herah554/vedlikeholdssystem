"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { TONER } from "@/lib/lister";
import { settDokumentinfo, slettVedlegg } from "@/app/(app)/vedlegg/actions";

export type Dokument = {
  id: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  docType: string | null;
  reference: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

export type Dokumenttype = { code: string; name: string; tone: string };

function lesbarStorrelse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const norskDato = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" });

/**
 * Hvor lenge er det igjen, og haster det?
 *
 * Tretti dager er valgt fordi det er omtrent tida det tar å få bestilt og
 * utført en kalibrering. Får man beskjed dagen det går ut, er det for sent.
 */
function gyldighet(til: string | null): {
  tekst: string;
  klasse: string;
} | null {
  if (!til) return null;

  const dato = new Date(til);
  const dager = Math.ceil((dato.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (dager < 0) {
    return {
      tekst: `Gikk ut ${norskDato.format(dato)}`,
      klasse:
        "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30",
    };
  }

  if (dager <= 30) {
    return {
      tekst: `Går ut om ${dager} ${dager === 1 ? "dag" : "dager"}`,
      klasse:
        "bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
    };
  }

  return {
    tekst: `Gyldig til ${norskDato.format(dato)}`,
    klasse: "bg-flate-dempet text-tekst-svak ring-kant",
  };
}

/**
 * Ett dokument med gyldighet.
 *
 * Vises som en linje til vanlig, og åpnes for redigering ved behov. Å ha
 * feltene framme hele tiden ville gjort en liste med ti sertifikater
 * uleselig.
 */
export function Dokumentrad({
  dokument,
  typer,
  kanEndre,
}: {
  dokument: Dokument;
  typer: Dokumenttype[];
  kanEndre: boolean;
}) {
  const [redigerer, settRedigerer] = useState(false);
  const [venter, start] = useTransition();
  const router = useRouter();

  const type = typer.find((t) => t.code === dokument.docType);
  const status = gyldighet(dokument.validUntil);

  function lagre(data: FormData) {
    start(async () => {
      data.set("id", dokument.id);
      await settDokumentinfo({ ok: true }, data);
      settRedigerer(false);
      router.refresh();
    });
  }

  function fjern() {
    start(async () => {
      await slettVedlegg(dokument.id);
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="size-4 shrink-0 text-tekst-svakest" aria-hidden />

        <a
          href={dokument.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-sm font-medium text-aksent hover:underline"
        >
          {dokument.fileName}
        </a>

        {type && (
          <Badge className={(TONER[type.tone] ?? TONER.noytral).klasse}>
            {type.name}
          </Badge>
        )}

        {dokument.reference && (
          <span className="font-mono text-xs text-tekst-svakest">
            {dokument.reference}
          </span>
        )}

        {status && (
          <Badge className={status.klasse}>
            <CalendarClock className="size-3" aria-hidden />
            {status.tekst}
          </Badge>
        )}

        <span className="text-xs text-tekst-svak">
          {lesbarStorrelse(dokument.sizeBytes)}
        </span>

        {kanEndre && (
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => settRedigerer((f) => !f)}
              disabled={venter}
              aria-label={`Rediger opplysninger om ${dokument.fileName}`}
              className="rounded-md p-1.5 text-tekst-svak hover:text-tekst"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={fjern}
              disabled={venter}
              aria-label={`Slett ${dokument.fileName}`}
              className="rounded-md p-1.5 text-tekst-svak hover:text-red-600"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </span>
        )}
      </div>

      {redigerer && kanEndre && (
        <form action={lagre} className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-medium text-tekst-svak">
            Type
            <Select
              name="docType"
              defaultValue={dokument.docType ?? ""}
              className="mt-1 py-1.5 text-sm"
            >
              <option value="">— ingen —</option>
              {typer.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-xs font-medium text-tekst-svak">
            Referanse
            <Input
              name="reference"
              defaultValue={dokument.reference ?? ""}
              placeholder="Sertifikatnr."
              className="mt-1 py-1.5 text-sm"
            />
          </label>

          <label className="text-xs font-medium text-tekst-svak">
            Utstedt
            <Input
              name="validFrom"
              type="date"
              defaultValue={dokument.validFrom?.slice(0, 10) ?? ""}
              className="mt-1 py-1.5 text-sm"
            />
          </label>

          <label className="text-xs font-medium text-tekst-svak">
            Gyldig til
            <Input
              name="validUntil"
              type="date"
              defaultValue={dokument.validUntil?.slice(0, 10) ?? ""}
              className="mt-1 py-1.5 text-sm"
            />
          </label>

          <div className="sm:col-span-4">
            <Button type="submit" variant="sekundær" disabled={venter}>
              {venter ? "Lagrer …" : "Lagre"}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
