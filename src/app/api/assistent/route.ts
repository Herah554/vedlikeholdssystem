import Anthropic from "@anthropic-ai/sdk";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sokArbeidsordre } from "@/lib/sok";
import { dato, ordreNummer } from "@/lib/format";
import { SYSTEMPROMPT, lagVerktoy } from "@/lib/assistent/verktoy";

/** Modellen som brukes. Se .env for nøkkelen. */
const MODELL = "claude-opus-5";

export type Kilde = { id: string; nummer: number; tittel: string };

export type AssistentSvar = {
  svar: string;
  kilder: Kilde[];
  conversationId: string;
  /** Sant når svaret kom fra rent databasesøk fordi API-nøkkel mangler. */
  utenAi: boolean;
};

/**
 * Finner arbeidsordrene assistenten viser til, slik at grensesnittet kan
 * gjøre dem om til klikkbare lenker. Vi leter etter mønsteret AO-0042 i
 * svaret og slår opp numrene — da kan ikke modellen lenke til en ordre
 * som ikke finnes, eller til en annen kundes data.
 */
async function finnKilder(
  organizationId: string,
  tekst: string,
): Promise<Kilde[]> {
  const numre = [...tekst.matchAll(/AO-(\d{1,6})/g)].map((m) => Number(m[1]));
  if (numre.length === 0) return [];

  const ordrer = await prisma.workOrder.findMany({
    where: { organizationId, number: { in: [...new Set(numre)] } },
    select: { id: true, number: true, title: true },
    orderBy: { number: "asc" },
  });

  return ordrer.map((o) => ({ id: o.id, nummer: o.number, tittel: o.title }));
}

/**
 * Reservesvar når ANTHROPIC_API_KEY ikke er satt.
 *
 * Systemet skal være nyttig også uten AI: vi kjører fritekstsøket direkte og
 * viser de mest relevante sakene med løsningen sin. Det er selve gjenbruken
 * av historikken som er verdien — språkmodellen gjør den bare lettere å nå.
 */
async function sokUtenAi(organizationId: string, melding: string): Promise<string> {
  const treff = await sokArbeidsordre(organizationId, melding, { antall: 5 });

  if (treff.length === 0) {
    return (
      "Jeg fant ingen tidligere arbeidsordre som ligner på dette.\n\n" +
      "_AI-assistenten er ikke koblet til ennå, så jeg søker bare i historikken. " +
      "Legg inn `ANTHROPIC_API_KEY` i `.env` for å få hjelp til feilsøking og nettsøk._"
    );
  }

  const linjer = treff.map((t) => {
    const deler = [
      `**${ordreNummer(t.number)} — ${t.title}**`,
      `${t.assetCode ? `${t.assetCode} · ` : ""}${dato(t.createdAt)}${t.failureCode ? ` · ${t.failureCode}` : ""}`,
    ];
    if (t.resolution) deler.push(`\n${t.resolution}`);
    return deler.join("\n");
  });

  return (
    `Jeg fant ${treff.length} tidligere ${treff.length === 1 ? "sak" : "saker"} som ligner:\n\n` +
    linjer.join("\n\n---\n\n") +
    "\n\n---\n\n_AI-assistenten er ikke koblet til ennå, så dette er et rent søk i historikken. " +
    "Legg inn `ANTHROPIC_API_KEY` i `.env` for å få forslag til feilsøking og søk på nettet._"
  );
}

export async function POST(request: Request): Promise<Response> {
  const { session } = await requireTenant();

  let melding: string;
  let conversationId: string | undefined;
  try {
    const body = (await request.json()) as {
      melding?: unknown;
      conversationId?: unknown;
    };
    melding = String(body.melding ?? "").trim();
    conversationId =
      typeof body.conversationId === "string" ? body.conversationId : undefined;
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel." }, { status: 400 });
  }

  if (!melding) {
    return Response.json({ feil: "Skriv et spørsmål først." }, { status: 400 });
  }

  // Samtalen må tilhøre denne brukeren — ellers lager vi en ny.
  let samtale = conversationId
    ? await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          organizationId: session.organizationId,
          userId: session.userId,
        },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
      })
    : null;

  if (!samtale) {
    const ny = await prisma.conversation.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        title: melding.slice(0, 60),
      },
    });
    samtale = { ...ny, messages: [] };
  }

  await prisma.chatMessage.create({
    data: { conversationId: samtale.id, role: "USER", content: melding },
  });

  const nokkel = process.env.ANTHROPIC_API_KEY;

  // ─── Uten API-nøkkel: rent databasesøk ───────────────────
  if (!nokkel) {
    const svar = await sokUtenAi(session.organizationId, melding);
    const kilder = await finnKilder(session.organizationId, svar);

    await prisma.chatMessage.create({
      data: {
        conversationId: samtale.id,
        role: "ASSISTANT",
        content: svar,
        citations: kilder,
      },
    });

    return Response.json({
      svar,
      kilder,
      conversationId: samtale.id,
      utenAi: true,
    } satisfies AssistentSvar);
  }

  // ─── Med API-nøkkel: full assistent ──────────────────────
  const client = new Anthropic({ apiKey: nokkel });

  const historikk: Anthropic.Beta.BetaMessageParam[] = samtale.messages.map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const params = {
    model: MODELL,
    max_tokens: 16000,
    system: SYSTEMPROMPT,
    output_config: { effort: "high" as const },
    tools: [
      ...lagVerktoy(session.organizationId),
      // Nettsøk for produsentdokumentasjon og feilkoder som ikke finnes
      // i anleggets egen historikk.
      { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 5 },
    ],
    messages: [...historikk, { role: "user" as const, content: melding }],
  };

  try {
    const runner = client.beta.messages.toolRunner(params);

    // Serververktøy kan stoppe med «pause_turn» når de treffer sin egen
    // iterasjonsgrense. Da sendes turen inn igjen slik at modellen fortsetter.
    for await (const message of runner) {
      if (message.stop_reason === "pause_turn") {
        runner.pushMessages({ role: "assistant", content: message.content });
      }
    }

    const siste = await runner.done();

    if (siste.stop_reason === "refusal") {
      return Response.json(
        { feil: "Modellen avslo å svare på dette spørsmålet." },
        { status: 422 },
      );
    }

    const svar = siste.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const kilder = await finnKilder(session.organizationId, svar);

    await prisma.chatMessage.create({
      data: {
        conversationId: samtale.id,
        role: "ASSISTANT",
        content: svar,
        citations: kilder,
      },
    });
    await prisma.conversation.update({
      where: { id: samtale.id },
      data: { updatedAt: new Date() },
    });

    return Response.json({
      svar,
      kilder,
      conversationId: samtale.id,
      utenAi: false,
    } satisfies AssistentSvar);
  } catch (e) {
    console.error("Assistenten feilet:", e);
    const melding =
      e instanceof Anthropic.RateLimitError
        ? "For mange forespørsler mot AI-tjenesten. Prøv igjen om litt."
        : e instanceof Anthropic.AuthenticationError
          ? "API-nøkkelen ble ikke godtatt. Sjekk ANTHROPIC_API_KEY i .env."
          : "Assistenten klarte ikke å svare. Prøv igjen.";
    return Response.json({ feil: melding }, { status: 502 });
  }
}
