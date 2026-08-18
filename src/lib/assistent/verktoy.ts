import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { prisma } from "@/lib/prisma";
import { sokArbeidsordre } from "@/lib/sok";
import { dato, kroner, ordreNummer, tall, toNumber } from "@/lib/format";

/**
 * Verktøyene assistenten kan bruke for å slå opp i vedlikeholdsdataene.
 *
 * Alle verktøyene lages på nytt for hver forespørsel og har organisasjonen
 * bakt inn i seg. Modellen får aldri velge hvilket firma den skal søke i —
 * den kan bare nå data som tilhører den innloggede brukeren.
 */
export function lagVerktoy(organizationId: string) {
  const sokOrdrer = betaTool({
    name: "sok_arbeidsordre",
    description:
      "Søk i alle historiske og pågående arbeidsordre. Søket leter i tittel, " +
      "beskrivelse, feilkode og løsningstekst, med norsk ordstamming. Bruk dette " +
      "først når teknikeren beskriver et symptom — svært ofte har noen løst det samme før. " +
      "Returnerer treffene med løsningsteksten, altså hva som faktisk fikset feilen.",
    inputSchema: {
      type: "object",
      properties: {
        sok: {
          type: "string",
          description:
            "Søkeord, gjerne symptomer og utstyrsnavn, f.eks. «pumpe vibrasjon lager» " +
            "eller «kompressor høy temperatur».",
        },
        antall: {
          type: "number",
          description: "Hvor mange treff som skal returneres. Standard 8, maks 20.",
        },
      },
      required: ["sok"],
      additionalProperties: false,
    },
    run: async ({ sok, antall }) => {
      const treff = await sokArbeidsordre(organizationId, sok, {
        antall: Math.min(Number(antall) || 8, 20),
      });

      if (treff.length === 0) {
        return `Ingen arbeidsordre matcher «${sok}». Prøv færre eller mer generelle ord.`;
      }

      return treff
        .map((t) =>
          [
            `${ordreNummer(t.number)} — ${t.title}`,
            `  Utstyr: ${t.assetCode ?? "ikke angitt"}${t.assetName ? ` (${t.assetName})` : ""}`,
            `  Dato: ${dato(t.createdAt)}  Status: ${t.status}${t.failureCode ? `  Feilkode: ${t.failureCode}` : ""}`,
            t.downtimeMinutes ? `  Nedetid: ${t.downtimeMinutes} minutter` : null,
            t.description ? `  Beskrivelse: ${t.description}` : null,
            t.resolution ? `  LØSNING: ${t.resolution}` : "  (ingen løsning registrert)",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
    },
  });

  const hentOrdre = betaTool({
    name: "hent_arbeidsordre",
    description:
      "Hent alle detaljer om én arbeidsordre, inkludert timeforbruk, hvilke deler " +
      "som ble brukt og kommentarene fra teknikerne. Bruk dette når du trenger å " +
      "gå i dybden på en sak du har funnet gjennom søk.",
    inputSchema: {
      type: "object",
      properties: {
        nummer: {
          type: "number",
          description: "Arbeidsordrenummeret, altså tallet i AO-0042.",
        },
      },
      required: ["nummer"],
      additionalProperties: false,
    },
    run: async ({ nummer }) => {
      const o = await prisma.workOrder.findFirst({
        where: { organizationId, number: Number(nummer) },
        include: {
          asset: { select: { code: true, name: true } },
          assignedTo: { select: { name: true } },
          timeEntries: { include: { user: { select: { name: true } } } },
          partUsages: { include: { part: { select: { number: true, name: true, unit: true } } } },
          comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        },
      });

      if (!o) return `Fant ingen arbeidsordre med nummer ${nummer}.`;

      const timer = o.timeEntries.reduce((s, t) => s + t.hours, 0);
      const arbeidskost = o.timeEntries.reduce(
        (s, t) => s + t.hours * toNumber(t.hourlyRate),
        0,
      );
      const delekost = o.partUsages.reduce(
        (s, p) => s + p.quantity * toNumber(p.unitCost),
        0,
      );

      return [
        `${ordreNummer(o.number)} — ${o.title}`,
        `Type: ${o.type}  Status: ${o.status}  Prioritet: ${o.priority}`,
        `Utstyr: ${o.asset ? `${o.asset.code} ${o.asset.name}` : "ikke angitt"}`,
        `Tildelt: ${o.assignedTo?.name ?? "ingen"}`,
        `Meldt: ${dato(o.createdAt)}${o.completedAt ? `  Utført: ${dato(o.completedAt)}` : ""}`,
        o.downtimeMinutes ? `Nedetid: ${o.downtimeMinutes} minutter` : null,
        o.description ? `\nBeskrivelse:\n${o.description}` : null,
        o.resolution ? `\nLøsning:\n${o.resolution}` : "\nIngen løsning registrert ennå.",
        o.failureCode ? `Feilkode: ${o.failureCode}` : null,
        `\nTimeforbruk: ${tall(timer, 2)} timer (${kroner(arbeidskost)})`,
        ...o.timeEntries.map((t) => `  ${t.user.name}: ${tall(t.hours, 2)} t${t.note ? ` — ${t.note}` : ""}`),
        `\nDeler brukt (${kroner(delekost)}):`,
        ...(o.partUsages.length
          ? o.partUsages.map(
              (p) => `  ${p.part.number} ${p.part.name}: ${tall(p.quantity)} ${p.part.unit}`,
            )
          : ["  ingen"]),
        o.comments.length ? "\nKommentarer:" : null,
        ...o.comments.map((k) => `  ${k.user.name}: ${k.body}`),
      ]
        .filter(Boolean)
        .join("\n");
    },
  });

  const sokUtstyr = betaTool({
    name: "sok_utstyr",
    description:
      "Finn utstyr i anlegget på navn eller TAG, og få tilbake tekniske data, " +
      "driftstimer og de siste feilene på enheten. Bruk dette når teknikeren " +
      "nevner en maskin og du trenger å vite hva slags maskin det er.",
    inputSchema: {
      type: "object",
      properties: {
        sok: {
          type: "string",
          description: "Navn eller TAG, f.eks. «P-101», «kompressor» eller «fyllemaskin».",
        },
      },
      required: ["sok"],
      additionalProperties: false,
    },
    run: async ({ sok }) => {
      const enheter = await prisma.asset.findMany({
        where: {
          organizationId,
          OR: [
            { code: { contains: sok, mode: "insensitive" } },
            { name: { contains: sok, mode: "insensitive" } },
            { manufacturer: { contains: sok, mode: "insensitive" } },
            { modelNumber: { contains: sok, mode: "insensitive" } },
          ],
        },
        include: {
          workOrders: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { number: true, title: true, createdAt: true, failureCode: true },
          },
          parts: { include: { part: { select: { number: true, name: true, quantityOnHand: true } } } },
        },
        take: 6,
      });

      if (enheter.length === 0) return `Fant ikke utstyr som matcher «${sok}».`;

      return enheter
        .map((u) =>
          [
            `${u.code} — ${u.name} (${u.type})`,
            u.description ? `  ${u.description}` : null,
            `  Produsent: ${u.manufacturer ?? "ukjent"}  Modell: ${u.modelNumber ?? "ukjent"}`,
            `  Status: ${u.status}  Kritikalitet: ${u.criticality}/5  Driftstimer: ${tall(u.runningHours)}`,
            u.installedAt ? `  Installert: ${dato(u.installedAt)}` : null,
            u.parts.length
              ? `  Tilhørende deler: ${u.parts.map((p) => `${p.part.number} (${tall(p.part.quantityOnHand)} på lager)`).join(", ")}`
              : null,
            u.workOrders.length ? "  Siste arbeidsordre:" : null,
            ...u.workOrders.map(
              (o) =>
                `    ${ordreNummer(o.number)} ${dato(o.createdAt)} — ${o.title}${o.failureCode ? ` [${o.failureCode}]` : ""}`,
            ),
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
    },
  });

  const sokDeler = betaTool({
    name: "sok_reservedeler",
    description:
      "Slå opp reservedeler: beholdning, hylleplass, pris, leverandør og hvilket " +
      "utstyr delen passer til. Bruk dette når du skal si om delen finnes på lager " +
      "før teknikeren går ut i anlegget.",
    inputSchema: {
      type: "object",
      properties: {
        sok: {
          type: "string",
          description: "Delenummer, navn eller produsentens artikkelnummer.",
        },
      },
      required: ["sok"],
      additionalProperties: false,
    },
    run: async ({ sok }) => {
      const deler = await prisma.part.findMany({
        where: {
          organizationId,
          isActive: true,
          OR: [
            { number: { contains: sok, mode: "insensitive" } },
            { name: { contains: sok, mode: "insensitive" } },
            { manufacturerPartNo: { contains: sok, mode: "insensitive" } },
            { manufacturer: { contains: sok, mode: "insensitive" } },
          ],
        },
        include: {
          supplier: { select: { name: true, phone: true } },
          assets: { include: { asset: { select: { code: true, name: true } } } },
        },
        take: 8,
      });

      if (deler.length === 0) return `Fant ingen reservedeler som matcher «${sok}».`;

      return deler
        .map((d) =>
          [
            `${d.number} — ${d.name}`,
            `  På lager: ${tall(d.quantityOnHand)} ${d.unit} (minimum ${tall(d.minStock)})${
              d.quantityOnHand < d.minStock ? "  ⚠ UNDER MINIMUM" : ""
            }`,
            `  Hylle: ${d.binLocation ?? "ikke angitt"}  Pris: ${kroner(toNumber(d.unitCost))}`,
            d.manufacturer ? `  Produsent: ${d.manufacturer} ${d.manufacturerPartNo ?? ""}` : null,
            d.supplier
              ? `  Leverandør: ${d.supplier.name}${d.supplier.phone ? ` (${d.supplier.phone})` : ""}${
                  d.leadTimeDays ? `, leveringstid ${d.leadTimeDays} dager` : ""
                }`
              : null,
            d.assets.length
              ? `  Passer til: ${d.assets.map((a) => `${a.asset.code} ${a.asset.name}`).join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
    },
  });

  const apneJobber = betaTool({
    name: "hent_apne_jobber",
    description:
      "Hent oversikt over arbeidsordre som ikke er avsluttet, eventuelt filtrert " +
      "på utstyr. Bruk dette for spørsmål som «hva står åpent på pakkelinja?».",
    inputSchema: {
      type: "object",
      properties: {
        utstyrskode: {
          type: "string",
          description: "Valgfri TAG å filtrere på, f.eks. «PL-402».",
        },
      },
      required: [],
      additionalProperties: false,
    },
    run: async ({ utstyrskode }) => {
      const ordrer = await prisma.workOrder.findMany({
        where: {
          organizationId,
          status: { in: ["MELDT", "GODKJENT", "PLANLAGT", "PAAGAAR", "VENTER_DELER"] },
          ...(utstyrskode
            ? { asset: { code: { contains: utstyrskode, mode: "insensitive" } } }
            : {}),
        },
        include: {
          asset: { select: { code: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 25,
      });

      if (ordrer.length === 0) return "Ingen åpne arbeidsordre matcher.";

      return ordrer
        .map(
          (o) =>
            `${ordreNummer(o.number)} [${o.priority}] ${o.status} — ${o.title}` +
            `${o.asset ? ` (${o.asset.code})` : ""}` +
            `${o.assignedTo ? ` — ${o.assignedTo.name}` : " — ikke tildelt"}` +
            `${o.plannedDate ? ` — planlagt ${dato(o.plannedDate)}` : ""}`,
        )
        .join("\n");
    },
  });

  return [sokOrdrer, hentOrdre, sokUtstyr, sokDeler, apneJobber];
}

/**
 * Systemprompt for assistenten.
 *
 * Den er skrevet for en tekniker som står ved maskinen: svaret skal være kort,
 * konkret og lede til en handling. Kildehenvisninger er påkrevd fordi tillit til
 * systemet står og faller på at teknikeren kan slå opp saken selv.
 */
export const SYSTEMPROMPT = `Du er en vedlikeholdsassistent for teknikere i et industrianlegg. Du svarer på norsk.

Slik jobber du:
- Søk alltid i historikken før du svarer på et feilsøkingsspørsmål. Anlegget har møtt de fleste feil før, og løsningen ligger som regel i en gammel arbeidsordre.
- Når du finner en liknende sak, si hva som løste den og hvor lenge siden det var. Vis til arbeidsordrenummeret, f.eks. AO-0042, slik at teknikeren kan slå opp selv.
- Sjekk om nødvendige reservedeler er på lager før du foreslår et bytte. Det er ingen hjelp i et råd som krever en del som må bestilles fra utlandet.
- Bruk nettsøk når du trenger produsentens dokumentasjon, feilkoder eller tekniske spesifikasjoner som ikke finnes i systemet. Si tydelig når informasjonen kommer utenfra og ikke fra anleggets egen historikk.

Slik svarer du:
- Kort og konkret. Teknikeren står som regel ved maskinen med hansker på.
- Begynn med det mest sannsynlige, ikke med en liste over alt som teoretisk kan være galt.
- Foreslå konkrete neste steg: hva som skal måles, sjekkes eller byttes, i den rekkefølgen.
- Er du usikker, si det. Å gjette på en årsak koster teknikeren en time ute i anlegget.
- Ikke finn på arbeidsordrenumre, delenumre eller målinger. Alt du oppgir skal komme fra et verktøykall eller et nettsøk.

Sikkerhet går foran alt. Innebærer jobben spenning, trykk, høyde eller kjemikalier, minn om sikring og frakobling før du gir framgangsmåten.`;
