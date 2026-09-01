import { assertRole, requireTenant } from "@/lib/auth";
import { eksporterOrg, filnavn, tilRegneark } from "@/lib/eksport";

/**
 * Bedriften laster ned alt de har lagt inn.
 *
 * Dette er svaret på «kan vi få dataene våre ut igjen», og det svaret må
 * finnes før noen tør å legge dem inn. Det er også plikten i
 * databehandleravtalen om å levere dataene tilbake når avtalen tar slutt —
 * her kan kunden gjøre det selv, når som helst, uten å spørre oss.
 *
 * Bare administrator. Fila inneholder hver eneste rad bedriften eier,
 * inkludert navn, timer og arbeidshistorikk på alle ansatte.
 *
 * Passord er ikke med. De ligger bare som hash, og vakten i eksporten
 * stopper uansett alt som ser ut som en hemmelighet.
 */
export async function GET(request: Request): Promise<Response> {
  const { session } = await requireTenant();
  assertRole(session.role, "ADMIN");

  const format = new URL(request.url).searchParams.get("format");
  const ut = await eksporterOrg(session.organizationId);

  if (format === "json") {
    return svar(
      JSON.stringify(ut, null, 2),
      "application/json; charset=utf-8",
      filnavn(ut, "json"),
    );
  }

  const bytes = await tilRegneark(ut);
  return svar(
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filnavn(ut, "xlsx"),
  );
}

function svar(
  kropp: string | ArrayBuffer,
  type: string,
  navn: string,
): Response {
  return new Response(kropp, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${navn}"`,
      // Hele bedriftens data skal ikke bli liggende i en mellomlagring
      "Cache-Control": "no-store",
    },
  });
}
