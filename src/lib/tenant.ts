import { prisma } from "@/lib/prisma";

/**
 * Tabeller som eies av én organisasjon. Alle disse har kolonnen
 * organizationId, og ingen spørring mot dem skal noen gang kjøre uten
 * at den er filtrert på riktig organisasjon.
 *
 * Utenfor lista står Organization (selve klienten) og tabeller som arver
 * tilhørigheten fra forelderen sin: ChecklistItem, AssetPart og ChatMessage.
 */
const TENANT_MODELS = new Set([
  "User",
  "Asset",
  "WorkOrder",
  "TimeEntry",
  "Supplier",
  "Part",
  "PartUsage",
  "StockMovement",
  "PmPlan",
  "CostCenter",
  "Budget",
  "Dashboard",
  "Conversation",
  "Comment",
  "Attachment",
  "AuditLog",
  "Counter",
]);

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
 *
 * Sikkerheten hviler altså ikke på at hver enkelt utvikler husker filteret.
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
