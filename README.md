# Vedlikeholdssystem

Et komplett vedlikeholdsstyringssystem (CMMS) for industrianlegg, med en AI-assistent
som lar teknikere søke i all historikk og få hjelp til feilsøking.

Systemet er flerklient (multi-tenant): flere firmaer kan bruke samme installasjon
uten å se hverandres data.

## Hva det inneholder

| Modul | Hva den gjør |
|---|---|
| **Dashbord** | Konfigurerbare widgets — hver bruker setter sammen sitt eget oppsett |
| **Ukeplan** | Dra-og-slipp-tavle for ukens jobber, fordelt på dager og teknikere |
| **Arbeidsordre** | Meld, godkjenn, planlegg og utfør. Timeføring, deleuttak, sjekklister og kommentarer |
| **Assistent** | Søker i all historikk, finner liknende feil og hva som løste dem. Kan søke på nettet |
| **Anlegg** | Hierarki: anlegg → system → utstyr → komponent, med full historikk per enhet |
| **Reservedeler** | Lager med minimumsnivå, kobling mot utstyr, uttak og opptelling |
| **Forebyggende** | Planer med tids- eller driftstimeintervall som lager arbeidsordre automatisk |
| **Budsjett** | Kostnad fra timer og deler mot budsjett per kostnadssted |
| **Rapporter** | Nedetid, kostnad per utstyr, PM-etterlevelse og deleforbruk |

### Assistenten

Den viktigste funksjonen er gjenbruk av historikk. Når en tekniker beskriver et
symptom, søker systemet gjennom alle tidligere arbeidsordre — inkludert
*løsningsteksten*, altså hva som faktisk fikset feilen sist. Søket bruker
PostgreSQL sitt norske fulltekstsøk med ordstamming, så «pumper vibrerer» finner
også «unormale rystelser på pumpa».

Assistenten fungerer i to nivåer:

- **Uten API-nøkkel:** rent databasesøk. Viser de mest relevante tidligere sakene
  med løsningen sin. Dette virker med én gang.
- **Med API-nøkkel:** full assistent som kan slå opp utstyr, sjekke lagerbeholdning,
  søke på nettet etter produsentdokumentasjon og sette sammen et konkret
  feilsøkingsforslag med kildehenvisninger til arbeidsordrene den bygger på.

## Teknologi

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript** og **Tailwind CSS 4**
- **PostgreSQL 17** med **Prisma 7**
- **Claude API** (`claude-opus-5`) for assistenten

## Komme i gang

### Forutsetninger

- Node.js 20.9 eller nyere
- PostgreSQL 17

### Oppsett

```bash
# 1. Installer avhengigheter
npm install

# 2. Opprett databasen
createdb vedlikehold

# 3. Kopier miljøvariablene og fyll dem ut
cp .env.example .env
```

Rediger `.env`:

```
DATABASE_URL="postgresql://bruker:passord@localhost:5432/vedlikehold?schema=public"
AUTH_SECRET="minst-32-tegn-langt-tilfeldig-passord"
ANTHROPIC_API_KEY=""   # valgfri — se «Assistenten» over
```

Generer en trygg `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

```bash
# 4. Opprett tabellene
npm run db:migrate

# 5. Legg inn testdata (valgfritt, men anbefalt for å se systemet i bruk)
npm run db:seed

# 6. Start
npm run dev
```

Åpne <http://localhost:3000>.

### Testbrukere

Testdataene lager to firmaer, slik at du kan se at dataene faktisk er adskilte.
Alle bruker passordet `passord123`.

| E-post | Rolle | Firma |
|---|---|---|
| `admin@nordvik.no` | Administrator | Nordvik Industri AS |
| `leder@nordvik.no` | Leder | Nordvik Industri AS |
| `planlegger@nordvik.no` | Planlegger | Nordvik Industri AS |
| `morten@nordvik.no` | Tekniker | Nordvik Industri AS |
| `post@fjordkraft.no` | Administrator | Fjordkraft Vedlikehold AS |

Logger du inn som Fjordkraft, ser du ingenting fra Nordvik — heller ikke om du
skriver inn en Nordvik-ID direkte i adressefeltet.

> **Bytt disse passordene før systemet tas i bruk på ordentlig.**

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Start utviklingsserver |
| `npm run build` | Bygg for produksjon |
| `npm start` | Kjør produksjonsbygget |
| `npm run db:migrate` | Kjør databasemigrasjoner |
| `npm run db:seed` | Legg inn testdata (**sletter eksisterende data**) |
| `npm run db:studio` | Åpne Prisma Studio for å se i databasen |
| `npm run db:reset` | Nullstill databasen helt |

## Hvordan dataadskillelsen virker

Hver forretningstabell har `organizationId`. All datatilgang går gjennom
`dbForOrg()` i [`src/lib/tenant.ts`](src/lib/tenant.ts), som er en Prisma-utvidelse
som automatisk legger filteret inn i hver spørring og setter feltet ved innsetting.

Det betyr at sikkerheten ikke hviler på at hver enkelt utvikler husker å filtrere.
Selv om noen glemmer det i en spørring, kan de fortsatt ikke nå data som tilhører
en annen kunde. Rå SQL går utenom utvidelsen, så der oppgis organisasjonen
eksplisitt — se kommentarene i [`src/lib/statistikk.ts`](src/lib/statistikk.ts).

## Roller

| Rolle | Kan |
|---|---|
| **Administrator** | Alt, inkludert å administrere brukere |
| **Leder** | Ser alt, godkjenner arbeid, eier budsjettet |
| **Planlegger** | Planlegger arbeid og forebyggende vedlikehold |
| **Tekniker** | Utfører arbeid, fører timer, tar ut deler |
| **Gjest** | Kun lesetilgang |

## Kjente begrensninger

- `pgvector` er ikke i bruk. Søket bruker Postgres sitt norske fulltekstsøk, som
  fungerer godt, men semantisk vektorsøk ville funnet flere formuleringer av samme feil.
- Vedleggsmodellen finnes i databasen, men filopplasting er ikke bygget i
  grensesnittet ennå.
- Prisma sitt CLI-verktøy har en kjent sårbarhet i `deepmerge-ts`. Den kjører kun
  lokalt ved migrering, ikke i den ferdige appen, og det finnes ingen ikke-brytende
  oppdatering ennå.
