"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUp, ClipboardList, Sparkles, User } from "lucide-react";
import type { AssistentSvar, Kilde } from "@/app/api/assistent/route";
import { ordreNummer } from "@/lib/format";

type Melding = {
  id: string;
  rolle: "bruker" | "assistent";
  tekst: string;
  kilder?: Kilde[];
};

const FORSLAG = [
  "Pumpe P-101 vibrerer og lager ulyd — har vi hatt dette før?",
  "Kompressoren går varm igjen. Hva gjorde vi sist?",
  "Hvilke deler trenger jeg for å bytte lager på en kjølevannspumpe?",
  "Hva står åpent på pakkelinja nå?",
];

/**
 * Enkel formatering av svaret.
 *
 * Modellen skriver lettvekts-Markdown. I stedet for å dra inn et helt
 * Markdown-bibliotek tolker vi de få tingene som faktisk brukes — avsnitt,
 * fet skrift, kode og skillelinjer — og setter aldri inn rå HTML.
 */
function Formatert({ tekst }: { tekst: string }) {
  const blokker = tekst.split(/\n{2,}/);

  return (
    <div className="space-y-2.5">
      {blokker.map((blokk, i) => {
        if (/^-{3,}$/.test(blokk.trim())) {
          return <hr key={i} className="border-slate-200" />;
        }

        const linjer = blokk.split("\n");
        const erListe = linjer.every((l) => /^\s*[-*•]\s+/.test(l) || l.trim() === "");

        if (erListe) {
          return (
            <ul key={i} className="ml-4 list-disc space-y-1">
              {linjer
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j} className="text-sm leading-relaxed text-slate-700">
                    <Utheving tekst={l.replace(/^\s*[-*•]\s+/, "")} />
                  </li>
                ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            <Utheving tekst={blokk} />
          </p>
        );
      })}
    </div>
  );
}

/** Tolker **fet**, _kursiv_ og `kode` uten å sette inn HTML. */
function Utheving({ tekst }: { tekst: string }) {
  const deler = tekst.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);

  return (
    <>
      {deler.map((del, i) => {
        if (del.startsWith("**") && del.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {del.slice(2, -2)}
            </strong>
          );
        }
        if (del.startsWith("`") && del.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800"
            >
              {del.slice(1, -1)}
            </code>
          );
        }
        if (del.startsWith("_") && del.endsWith("_") && del.length > 2) {
          return (
            <em key={i} className="text-slate-500">
              {del.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{del}</span>;
      })}
    </>
  );
}

export function Chat({
  startMeldinger,
  startSamtale,
}: {
  startMeldinger: Melding[];
  startSamtale?: string;
}) {
  const [meldinger, settMeldinger] = useState<Melding[]>(startMeldinger);
  const [samtale, settSamtale] = useState(startSamtale);
  const [venter, settVenter] = useState(false);
  const [feil, settFeil] = useState<string>();
  const [tekst, settTekst] = useState("");
  const bunn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bunn.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [meldinger, venter]);

  async function send(innhold: string) {
    const melding = innhold.trim();
    if (!melding || venter) return;

    settTekst("");
    settFeil(undefined);
    settVenter(true);
    settMeldinger((f) => [
      ...f,
      { id: `u${Date.now()}`, rolle: "bruker", tekst: melding },
    ]);

    try {
      const svar = await fetch("/api/assistent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ melding, conversationId: samtale }),
      });

      if (!svar.ok) {
        const data = (await svar.json().catch(() => ({}))) as { feil?: string };
        throw new Error(data.feil ?? "Assistenten svarte ikke.");
      }

      const data = (await svar.json()) as AssistentSvar;
      settSamtale(data.conversationId);
      settMeldinger((f) => [
        ...f,
        {
          id: `a${Date.now()}`,
          rolle: "assistent",
          tekst: data.svar,
          kilder: data.kilder,
        },
      ]);
    } catch (e) {
      settFeil(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      settVenter(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {meldinger.length === 0 && (
          <div className="kort p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-merke-50 text-merke-600">
                <Sparkles className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Spør om hva som helst i anlegget
                </p>
                <p className="text-sm text-slate-500">
                  Jeg leter gjennom alle arbeidsordrene deres og finner hva som
                  løste liknende feil sist.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {FORSLAG.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => send(f)}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-merke-300 hover:bg-merke-50"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {meldinger.map((m) =>
          m.rolle === "bruker" ? (
            <div key={m.id} className="flex justify-end">
              <div className="flex max-w-2xl items-start gap-2.5">
                <div className="rounded-2xl rounded-tr-sm bg-merke-600 px-4 py-2.5 text-sm text-white">
                  {m.tekst}
                </div>
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <User className="size-3.5" aria-hidden />
                </div>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-merke-100 text-merke-700">
                <Sparkles className="size-3.5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="kort p-4">
                  <Formatert tekst={m.tekst} />
                </div>

                {m.kilder && m.kilder.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.kilder.map((k) => (
                      <Link
                        key={k.id}
                        href={`/arbeidsordre/${k.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200 ring-inset transition-colors hover:bg-slate-50 hover:text-merke-700"
                      >
                        <ClipboardList className="size-3" aria-hidden />
                        <span className="font-mono">{ordreNummer(k.nummer)}</span>
                        <span className="max-w-40 truncate">{k.tittel}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {venter && (
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-merke-100 text-merke-700">
              <Sparkles className="size-3.5 animate-pulse" aria-hidden />
            </div>
            <div className="kort px-4 py-3">
              <p className="text-sm text-slate-500" aria-live="polite">
                Leter gjennom historikken …
              </p>
            </div>
          </div>
        )}

        {feil && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{feil}</span>
          </div>
        )}

        <div ref={bunn} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(tekst);
        }}
        className="kort flex items-end gap-2 p-2"
      >
        <textarea
          value={tekst}
          onChange={(e) => settTekst(e.target.value)}
          onKeyDown={(e) => {
            // Enter sender, skift + Enter gir ny linje
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(tekst);
            }
          }}
          rows={1}
          placeholder="Beskriv feilen, eller spør om utstyr, deler og historikk …"
          aria-label="Melding til assistenten"
          className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
        />
        <button
          type="submit"
          disabled={venter || !tekst.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-merke-600 text-white transition-colors hover:bg-merke-700 disabled:opacity-40"
          aria-label="Send"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
