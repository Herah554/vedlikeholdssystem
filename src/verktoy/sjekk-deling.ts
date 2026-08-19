import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { deltMedMeg } from "@/app/(app)/dashbord/tilpass/deling";

/**
 * Kontrollerer at deling av dashbord ikke krysser bedriftsgrensen.
 *
 * Delingstabellen har ingen organizationId — den arver tilhørigheten fra
 * dashbordet — og er derfor ikke dekket av flerklient-filteret. Spørsmålet
 * denne sjekken svarer på er om «delt med hele bedriften» virkelig betyr
 * bedriften, og ikke alle på serveren.
 *
 * Kjør med: npx tsx src/verktoy/sjekk-deling.ts
 */

let feil = 0;

function sjekk(hva: string, faktisk: unknown, forventet: unknown) {
  const ok = JSON.stringify(faktisk) === JSON.stringify(forventet);
  if (!ok) feil += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${hva}\n    forventet ${JSON.stringify(forventet)}, fikk ${JSON.stringify(faktisk)}`,
  );
}

async function main() {
  const brukere = await prisma.user.findMany({
    where: {
      email: { in: ["morten@nordvik.no", "leder@nordvik.no", "post@fjordkraft.no"] },
    },
    select: { id: true, email: true, organizationId: true },
  });

  const finn = (e: string) => {
    const u = brukere.find((b) => b.email === e);
    if (!u) throw new Error(`Fant ikke ${e}. Kjør «npm run db:seed» først.`);
    return u;
  };

  const morten = finn("morten@nordvik.no");
  const leder = finn("leder@nordvik.no");
  const fjordkraft = finn("post@fjordkraft.no");

  // Lederen i Nordvik deler et oppsett med hele sin bedrift
  const delt = await prisma.dashboard.create({
    data: {
      organizationId: leder.organizationId,
      userId: leder.id,
      name: "Sjekk deling",
      layout: [{ id: "a", type: "kostnad-hittil", w: 2, h: 1 }],
      shares: { create: [{ userId: null }] },
    },
  });

  try {
    const hosMorten = await deltMedMeg(dbForOrg(morten.organizationId), morten.id);
    sjekk(
      "Kollega i samme bedrift ser oppsettet",
      hosMorten.filter((d) => d.id === delt.id).length,
      1,
    );

    const hosFjordkraft = await deltMedMeg(
      dbForOrg(fjordkraft.organizationId),
      fjordkraft.id,
    );
    sjekk(
      "Annen bedrift ser det IKKE, selv om det er delt med «alle»",
      hosFjordkraft.filter((d) => d.id === delt.id).length,
      0,
    );

    // Samme oppslag som taIBruk gjør før den kopierer. Gjetter noen id-en,
    // skal den fortsatt ikke finne noe fra en annen kunde.
    const gjettet = await dbForOrg(fjordkraft.organizationId).dashboard.findFirst({
      where: {
        id: delt.id,
        userId: { not: fjordkraft.id },
        shares: { some: { OR: [{ userId: fjordkraft.id }, { userId: null }] } },
      },
      select: { id: true },
    });
    sjekk("Gjettet id fra annen bedrift gir ingenting", gjettet, null);

    // Lederen skal ikke se sitt eget oppsett under «delt med deg»
    const hosLeder = await deltMedMeg(dbForOrg(leder.organizationId), leder.id);
    sjekk(
      "Eget oppsett dukker ikke opp som delt med deg selv",
      hosLeder.filter((d) => d.id === delt.id).length,
      0,
    );
  } finally {
    await prisma.dashboard.delete({ where: { id: delt.id } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
