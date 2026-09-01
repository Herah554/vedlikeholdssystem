"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui";
import { lagPassordlenke } from "../../actions";

/**
 * Engangslenke administratoren gir videre.
 *
 * Den anbefalte veien når noen har glemt passordet sitt. Alternativet — å
 * skrive inn et passord for en kollega — betyr at administratoren kjenner
 * passordet og kan logge inn som hen, og i loggen ser det ut som om
 * vedkommende gjorde det selv.
 *
 * Lenka vises bare her, én gang. Den lagres ikke noe sted i klartekst, så
 * lukkes ruta uten at den er sendt videre, må man lage en ny. Det er med
 * vilje: en passordlenke som blir liggende i et grensesnitt er like god som
 * et passord på en gul lapp.
 */
export function Passordlenke({
  brukerId,
  navn,
}: {
  brukerId: string;
  navn: string;
}) {
  const [venter, start] = useTransition();
  const [lenke, settLenke] = useState<string>();
  const [feil, settFeil] = useState<string>();
  const [kopiert, settKopiert] = useState(false);

  if (lenke) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-tekst-svak">
          Gi denne til {navn}. Den virker i <strong>én time</strong> og bare{" "}
          <strong>én gang</strong>. {navn} velger passordet selv — du får ikke
          vite det.
        </p>

        <div className="flex gap-2">
          <input
            readOnly
            value={lenke}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-kant bg-flate-dempet px-3 py-2 font-mono text-xs text-tekst"
            aria-label="Engangslenke"
          />
          <Button
            variant="sekundær"
            onClick={() => {
              navigator.clipboard.writeText(lenke).then(
                () => {
                  settKopiert(true);
                  setTimeout(() => settKopiert(false), 2000);
                },
                // Utklippstavla kan være sperret. Feltet står der uansett,
                // og kan merkes og kopieres for hånd.
                () => settKopiert(false),
              );
            }}
          >
            {kopiert ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {kopiert ? "Kopiert" : "Kopier"}
          </Button>
        </div>

        <p className="text-xs text-tekst-svak">
          Lenka vises bare nå. Lukker du siden, må du lage en ny.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-tekst-svak">
        {navn} setter passordet selv, og du får aldri vite det. Send lenka på
        den måten dere ellers snakker sammen.
      </p>

      {feil && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {feil}
        </p>
      )}

      <Button
        disabled={venter}
        onClick={() =>
          start(async () => {
            settFeil(undefined);
            const svar = await lagPassordlenke(brukerId);
            if (svar.ok && svar.lenke) settLenke(svar.lenke);
            else settFeil(svar.feil ?? "Kunne ikke lage lenke.");
          })
        }
      >
        <Link2 className="size-4" aria-hidden />
        {venter ? "Lager …" : "Lag engangslenke"}
      </Button>
    </div>
  );
}
