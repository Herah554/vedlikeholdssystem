import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Flerklient-isolering.
 *
 * Tabeller som eies av én organisasjon har kolonnen organizationId, og ingen
 * spørring mot dem skal noen gang kjøre uten at den er filtrert på riktig
 * organisasjon.
 *
 * Lista over hvilke tabeller det gjelder utledes fra Prisma sine egne
 * metadata i stedet for å skrives for hånd. Det er ikke elegansen som er
 * poenget: en håndskrevet liste ble faktisk glemt oppdatert da bestillinger
 * kom til, og resultatet var at én kunde kunne se en annens bestillinger.
 * Utledes lista fra schemaet, er en ny tabell beskyttet i samme øyeblikk som
 * den får en organizationId-kolonne.
 */

type FeltListe = Record<string, string> | undefined;
const prismaMeta = Prisma as unknown as Record<string, FeltListe>;

function harOrganisasjonsfelt(modell: string): boolean {
  const felter = prismaMeta[`${modell}ScalarFieldEnum`];
  return Boolean(felter && "organizationId" in felter);
}

const ALLE_MODELLER = Object.values(Prisma.ModelName) as string[];

const TENANT_MODELS = new Set(ALLE_MODELLER.filter(harOrganisasjonsfelt));

/**
 * Tabeller som med vilje ikke har organizationId.
 *
 * De arver tilhørigheten fra forelderen sin — en sjekklistelinje hører til
 * arbeidsordren, en bestillingslinje til bestillingen — og nås aldri direkte
 * uten å gå gjennom den. Organization er selve klienten.
 *
 * Lista må vedlikeholdes bevisst: dukker det opp en ny tabell som verken har
 * organizationId eller står her, stopper systemet med en gang i stedet for å
 * la den ligge ubeskyttet.
 */
const ARVER_TILHORIGHET = new Set([
  "Organization",
  "ChecklistItem",
  "AssetPart",
  "PurchaseOrderLine",
  "ChatMessage",
  "DashboardShare",
  "PasswordReset",
]);

const udekket = ALLE_MODELLER.filter(
  (m) => !TENANT_MODELS.has(m) && !ARVER_TILHORIGHET.has(m),
);

if (udekket.length > 0) {
  throw new Error(
    `Flerklient-isolering: modellen(e) ${udekket.join(", ")} har verken ` +
      "organizationId eller står oppført som en tabell som arver tilhørighet " +
      "fra en forelder.\n\n" +
      "Legg til organizationId i prisma/schema.prisma hvis tabellen eies av " +
      "én organisasjon, eller før den opp i ARVER_TILHORIGHET i " +
      "src/lib/tenant.ts hvis den nås gjennom en forelder. Uten et av delene " +
      "ville data kunne lekke mellom kunder.",
  );
}

/** Operasjoner der organizationId skal tvinges inn i where-betingelsen. */
const FILTERED_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

/** Operasjoner der organizationId skal settes automatisk på nye rader. */
const CREATING_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "upsert",
]);

/**
 * Gir en Prisma-klient som er låst til én organisasjon.
 *
 * Hver spørring får automatisk `organizationId` lagt inn i where-betingelsen,
 * og hver innsetting får feltet satt. Det betyr at selv om noen glemmer
 * filteret i en spørring lenger oppe i koden, kan de fortsatt ikke nå data
 * som tilhører en annen kunde.
 */
export function dbForOrg(organizationId: string) {
  return prisma.$extends({
    name: "flerklient-isolering",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const nextArgs = args as Record<string, unknown>;

          if (FILTERED_OPERATIONS.has(operation)) {
            nextArgs.where = {
              ...((nextArgs.where as object | undefined) ?? {}),
              organizationId,
            };
          }

          if (CREATING_OPERATIONS.has(operation)) {
            const data = nextArgs.data;
            if (Array.isArray(data)) {
              nextArgs.data = data.map((row) => ({ ...row, organizationId }));
            } else if (data && typeof data === "object") {
              nextArgs.data = { ...data, organizationId };
            }
            // upsert har egen create-gren
            const create = nextArgs.create;
            if (create && typeof create === "object") {
              nextArgs.create = { ...create, organizationId };
            }
          }

          return query(nextArgs);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof dbForOrg>;

/** Tabellene som er under flerklient-beskyttelse. Brukes av tester. */
export const beskyttedeModeller = (): string[] => [...TENANT_MODELS].sort();

/**
 * Henter neste løpenummer for en organisasjon, f.eks. arbeidsordrenummer.
 *
 * Bruker en atomisk UPDATE ... RETURNING slik at to teknikere som oppretter
 * en arbeidsordre i samme sekund aldri får samme nummer.
 */
export async function nextCounterValue(
  organizationId: string,
  name: string,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO counters ("organizationId", name, value)
    VALUES (${organizationId}, ${name}, 1)
    ON CONFLICT ("organizationId", name)
    DO UPDATE SET value = counters.value + 1
    RETURNING value
  `;
  return rows[0].value;
}
