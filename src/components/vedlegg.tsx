"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  lastOppVedlegg,
  slettVedlegg,
  type Feste,
} from "@/app/(app)/vedlegg/actions";
import { Dokumentrad, type Dokumenttype } from "@/components/dokumentrad";

export type Vedlegg = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  lastetOppAv: string | null;
  /** Kode fra lista «dokumenttype». Bare satt på dokumenter, ikke bilder. */
  docType?: string | null;
  reference?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

/** Lengste side på et bilde etter krymping. */
const MAKS_KANT = 1600;

/**
 * Krymper bildet før det sendes.
 *
 * Et bilde fra en mobil er fort seks megabyte. Teknikeren står ute på anlegget
 * på dårlig dekning, og seks megabyte tar tid han ikke har. Nedskalert til
 * 1600 piksler er det under en halv megabyte, og fortsatt godt nok til å se
 * hva som er galt med lageret.
 *
 * Går noe galt underveis, sendes originalen. Bedre et tregt opplast enn ingen.
 */
async function krymp(fil: File): Promise<File> {
  if (!fil.type.startsWith("image/") || fil.type === "image/heic") return fil;

  try {
    const bilde = await createImageBitmap(fil);
    const storst = Math.max(bilde.width, bilde.height);

    if (storst <= MAKS_KANT) {
      bilde.close();
      return fil;
    }

    const skala = MAKS_KANT / storst;
    const bredde = Math.round(bilde.width * skala);
    const hoyde = Math.round(bilde.height * skala);

    const lerret = document.createElement("canvas");
    lerret.width = bredde;
    lerret.height = hoyde;

    const tegner = lerret.getContext("2d");
    if (!tegner) return fil;

    tegner.drawImage(bilde, 0, 0, bredde, hoyde);
    bilde.close();

    const blob = await new Promise<Blob | null>((svar) =>
      lerret.toBlob(svar, "image/jpeg", 0.85),
    );
    if (!blob) return fil;

    const navn = fil.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], navn, { type: "image/jpeg" });
  } catch {
    return fil;
  }
}

export function Vedleggsliste({
  feste,
  vedlegg,
  kanEndre,
  dokumenttyper = [],
}: {
  feste: Feste;
  vedlegg: Vedlegg[];
  kanEndre: boolean;
  /**
   * Typene firmaet har satt opp. Er lista tom, vises dokumentene fortsatt —
   * bare uten type og gyldighet.
   */
  dokumenttyper?: Dokumenttype[];
}) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const filfelt = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function velg(filer: FileList | null) {
    if (!filer || filer.length === 0) return;
    settFeil(undefined);

    start(async () => {
      const data = new FormData();
      data.set("festeType", feste.type);
      data.set("festeId", feste.id);

      for (const fil of Array.from(filer)) {
        data.append("filer", await krymp(fil));
      }

      const svar = await lastOppVedlegg({ ok: true }, data);
      if (!svar.ok) settFeil(svar.feil);
      if (filfelt.current) filfelt.current.value = "";
      router.refresh();
    });
  }

  function fjern(id: string) {
    start(async () => {
      const svar = await slettVedlegg(id);
      if (!svar.ok) settFeil(svar.feil);
      router.refresh();
    });
  }

  const bilder = vedlegg.filter((v) => v.mimeType.startsWith("image/"));
  const andre = vedlegg.filter((v) => !v.mimeType.startsWith("image/"));

  return (
    <div className="space-y-4">
      {feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{feil}</span>
        </div>
      )}

      {bilder.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {bilder.map((v) => (
            <li key={v.id} className="group relative">
              <a
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg ring-1 ring-kant ring-inset"
              >
                {/* Bildene ligger hos en ekstern lagringstjeneste, og
                    next/image ville krevd at hvert domene settes opp i
                    konfigurasjonen. Her er en vanlig img riktigere. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.url}
                  alt={v.fileName}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                />
              </a>

              {kanEndre && (
                <button
                  type="button"
                  onClick={() => fjern(v.id)}
                  disabled={venter}
                  aria-label={`Slett ${v.fileName}`}
                  className="absolute top-1.5 right-1.5 rounded-md bg-flate/90 p-1.5 text-tekst-svak opacity-0 shadow-sm ring-1 ring-kant ring-inset transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {andre.length > 0 && (
        <ul className="divide-y divide-kant rounded-lg ring-1 ring-kant ring-inset">
          {andre.map((v) => (
            <Dokumentrad
              key={v.id}
              kanEndre={kanEndre}
              typer={dokumenttyper}
              dokument={{
                id: v.id,
                fileName: v.fileName,
                url: v.url,
                sizeBytes: v.sizeBytes,
                docType: v.docType ?? null,
                reference: v.reference ?? null,
                validFrom: v.validFrom ?? null,
                validUntil: v.validUntil ?? null,
              }}
            />
          ))}
        </ul>
      )}

      {vedlegg.length === 0 && !kanEndre && (
        <p className="text-sm text-tekst-svak">Ingen bilder eller dokumenter.</p>
      )}

      {kanEndre && (
        <div>
          <input
            ref={filfelt}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            id={`vedlegg-${feste.id}`}
            onChange={(e) => velg(e.target.files)}
          />
          <Button
            type="button"
            variant="sekundær"
            disabled={venter}
            onClick={() => filfelt.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
            {venter ? "Laster opp …" : "Legg til bilde eller PDF"}
          </Button>
          <p className="mt-1.5 text-xs text-tekst-svak">
            Bilder krympes automatisk før de sendes. PDF-er lastes opp som de
            er — kalibreringsbevis og sertifikater kan få utløpsdato etterpå.
          </p>
        </div>
      )}
    </div>
  );
}
