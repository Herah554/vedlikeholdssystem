"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { MAKS_BREDDE, MALER, type Mal } from "@/components/widget-katalog";
import { lagreOppsett } from "./actions";

/**
 * Et lite bilde av hvordan malen ser ut.
 *
 * Tolv kolonner, tegnet med de samme forholdstallene som det ekte rutenettet.
 * Det er lettere å kjenne igjen en form enn å lese en liste over widget-navn.
 *
 * Kolonnetallet må følge MAKS_BREDDE. Da rutenettet gikk fra fire til tolv
 * kolonner ble denne stående på fire, og alle malene så like ut: en widget
 * som spenner seks kolonner fylte hele bredden uansett hvilken mal det var.
 */
function Forhandsvisning({ mal }: { mal: Mal }) {
  return (
    <div
      className="grid gap-0.5 rounded-md bg-flate-dempet p-1.5"
      style={{
        gridTemplateColumns: `repeat(${MAKS_BREDDE}, minmax(0, 1fr))`,
        gridAutoRows: "0.35rem",
      }}
      aria-hidden
    >
      {mal.oppsett.map((w) => (
        <div
          key={w.id}
          className="rounded-sm bg-merke-500/35"
          style={{
            gridColumn: `${w.x + 1} / span ${w.w}`,
            gridRow: `${w.y + 1} / span ${w.h}`,
          }}
        />
      ))}
    </div>
  );
}

export function Maler({ aktiv }: { aktiv?: string }) {
  const [venter, start] = useTransition();
  const [valgt, settValgt] = useState<string>();
  const router = useRouter();

  function bruk(mal: Mal) {
    settValgt(mal.id);
    start(async () => {
      await lagreOppsett(JSON.stringify(mal.oppsett));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <LayoutTemplate className="size-4 text-tekst-svak" aria-hidden />
            Start fra en mal
          </span>
        }
        description="Velg et utgangspunkt og dra om på det etterpå. Ditt eget oppsett blir erstattet."
      />
      <CardBody>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MALER.map((mal) => (
            <li
              key={mal.id}
              className="flex flex-col gap-2.5 rounded-lg p-3 ring-1 ring-kant ring-inset"
            >
              <Forhandsvisning mal={mal} />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-tekst">{mal.navn}</p>
                <p className="mt-0.5 text-xs text-tekst-svak">
                  {mal.beskrivelse}
                </p>
              </div>

              <Button
                type="button"
                variant="sekundær"
                disabled={venter}
                onClick={() => bruk(mal)}
                className="w-full"
              >
                {venter && valgt === mal.id
                  ? "Tar i bruk …"
                  : aktiv === mal.id
                    ? "Bruk på nytt"
                    : "Bruk denne"}
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
