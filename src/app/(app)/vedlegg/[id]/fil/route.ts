import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { hentFil } from "@/lib/lagring";

/**
 * Serverer et vedlegg til den som har lov til å se det.
 *
 * Filene ligger privat hos lagringstjenesten og har ingen offentlig adresse.
 * Denne ruta er den eneste veien inn, og det er her tilgangen avgjøres.
 *
 * Oppslaget går gjennom `db` fra requireTenant(), altså med
 * organisasjonsfilteret på. En gjettet id fra en annen kunde finner ingenting
 * — kontrollen ligger i datalaget og ikke i en if-setning her, slik at den
 * ikke kan glemmes.
 *
 * Svarer «finnes ikke» framfor «ingen tilgang». Ellers kunne man kartlagt
 * hvilke vedlegg som finnes hos andre ved å prøve id-er.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/vedlegg/[id]/fil">,
): Promise<Response> {
  const { db } = await requireTenant();
  const { id } = await ctx.params;

  const vedlegg = await db.attachment.findFirst({
    where: { id },
    select: { storagePath: true, fileName: true, mimeType: true },
  });

  if (!vedlegg) notFound();

  const fil = await hentFil(vedlegg.storagePath);
  if (!fil) notFound();

  return new Response(fil.stream, {
    headers: {
      "Content-Type": fil.mimeType ?? vedlegg.mimeType,
      // inline: bilder og PDF-er skal vises i nettleseren, ikke lastes ned.
      // Filnavnet følger med, så en nedlasting får riktig navn likevel.
      "Content-Disposition": `inline; filename="${vedlegg.fileName.replace(/"/g, "")}"`,
      // privat: bare den innloggedes egen nettleser får mellomlagre den, og
      // ingen mellomtjener. Uten dette kunne en delt cache servert filen
      // videre til noen som ikke skulle sett den.
      "Cache-Control": "private, max-age=300",
    },
  });
}
