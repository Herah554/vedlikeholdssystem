import { requireSuperadmin } from "@/lib/auth";
import { eksporterOrg, filnavn, tilRegneark } from "@/lib/eksport";

/**
 * Plattformeieren tar en kopi av en kundes data.
 *
 * Dette er sikkerhetskopien du kan forklare på ett minutt: én fil, hele
 * bedriften, tatt når som helst. Den er også det som gjør slettingen av en
 * kunde til noe man tør å gjøre — ta kopien først, så slett.
 *
 * requireSuperadmin() er hele sperren. Ruta går med vilje utenom
 * organisasjonsfilteret, siden dette er det ene stedet som skal kunne se på
 * tvers av kunder, og da er det den ene sjekken alt hviler på.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/plattform/[id]/eksport">,
): Promise<Response> {
  await requireSuperadmin();

  const { id } = await ctx.params;
  const format = new URL(request.url).searchParams.get("format");

  const ut = await eksporterOrg(id);

  if (format === "xlsx") {
    const bytes = await tilRegneark(ut);
    return new Response(bytes, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filnavn(ut, "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // JSON er standard her, motsatt av kundens egen nedlasting. En
  // sikkerhetskopi skal kunne leses inn igjen maskinelt; et regneark har
  // mistet både typer og struktur på veien.
  return new Response(JSON.stringify(ut), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filnavn(ut, "json")}"`,
      "Cache-Control": "no-store",
    },
  });
}
