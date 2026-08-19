# Vedlikeholdssystem

Et komplett vedlikeholdsstyringssystem (CMMS) for industrianlegg, med en AI-assistent
som lar teknikere søke i all historikk og få hjelp til feilsøking.

Systemet er flerklient (multi-tenant): flere firmaer kan bruke samme installasjon
uten å se hverandres data.

## Hva det inneholder

| Modul | Hva den gjør |
|---|---|
| **Plattform** | Din egen side: alle kundene, opprett nye, hopp inn hos én av dem, lag en demobedrift |
| **Import** | Få inn utstyrslista og reservedelene fra et regneark, uten å skrive dem inn på nytt |
| **Oppsett** | Administratorens side: hvem får gjøre hva, og hvilke årsaker teknikerne velger mellom |
| **Dashbord** | Widgets du drar i posisjon og størrelse. Oppsettet kan deles med kolleger |
| **Ukeplan** | Dra-og-slipp-tavle for ukens jobber, fordelt på dager og teknikere |
| **Arbeidsordre** | Meld, godkjenn, planlegg og utfør. Timeføring, deleuttak, sjekklister og kommentarer |
| **Assistent** | Søker i all historikk, finner liknende feil og hva som løste dem. Kan søke på nettet |
| **Anlegg** | Hierarki: anlegg → system → utstyr → komponent, med full historikk per enhet |
| **Reservedeler** | Lager med minimumsnivå, kobling mot utstyr, uttak og opptelling |
| **Bestillinger** | Velg deler under minimum — systemet samler dem i én bestilling per leverandør, sender e-post og fører varene inn på lager ved mottak |
| **Leverandører** | Kontaktpersoner og e-postadresser bestillingene sendes til |
| **Forebyggende** | Planer med tids- eller driftstimeintervall som lager arbeidsordre automatisk |
| **Budsjett** | Kostnad fra timer og deler mot budsjett per kostnadssted |
| **Rapporter** | Nedetid, kostnad per utstyr, PM-etterlevelse og deleforbruk |

Dashbordet flyttes med dra-og-slipp, og systemet har lyst og mørkt tema som følger operativsystemet hvis du vil.

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

### Bestillinger til leverandør

Når en del går under minimumsnivået, kan du huke den av på lagersiden og la
systemet lage bestillingene. Deler fra samme leverandør havner i **én** felles
bestilling — leverandøren skal ikke få én e-post per skrue. Antallet foreslås
opp til maksimumsnivået, ikke bare så vidt over grensen.

E-posten fungerer i to nivåer, på samme måte som assistenten:

- **Uten SMTP:** systemet lager e-posten ferdig, og du sender den fra din egen
  e-postklient med ett klikk. Ingen oppsett kreves.
- **Med SMTP:** systemet sender e-posten selv og markerer bestillingen som sendt.

Når varene kommer, fører du inn hvor mye som faktisk kom. Delleveranser er
normalt, så resten blir stående som utestående. Lagerbeholdningen og
lagerbevegelsen oppdateres i samme transaksjon, slik at lageret aldri kan komme
ut av synk med bestillingen.

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

# Valgfritt: la systemet sende bestillinger selv
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="Vedlikehold <ordre@firma.no>"
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

Nye bedrifter oppretter du fra `/plattform`. Kunder registrerer seg ikke selv.

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
| `npm run sjekk:isolering` | Kontroller at alle tabeller er dekket av flerklient-filteret |
| `npm run sjekk:deling` | Kontroller at delte dashbord ikke krysser bedriftsgrensen |
| `npm run sjekk:passord` | Kontroller flyten for glemt passord |
| `npm run sjekk:import` | Kontroller import fra regneark |

## Hvordan dataadskillelsen virker

Hver forretningstabell har `organizationId`. All datatilgang går gjennom
`dbForOrg()` i [`src/lib/tenant.ts`](src/lib/tenant.ts), som er en Prisma-utvidelse
som automatisk legger filteret inn i hver spørring og setter feltet ved innsetting.

Det betyr at sikkerheten ikke hviler på at hver enkelt utvikler husker å filtrere.
Selv om noen glemmer det i en spørring, kan de fortsatt ikke nå data som tilhører
en annen kunde. Rå SQL går utenom utvidelsen, så der oppgis organisasjonen
eksplisitt — se kommentarene i [`src/lib/statistikk.ts`](src/lib/statistikk.ts).

Hvilke tabeller som er dekket utledes fra Prisma-schemaet, ikke fra en liste
noen må huske å oppdatere. Får en ny tabell en `organizationId`, er den
beskyttet med det samme. Mangler den både `organizationId` og en plass i lista
over tabeller som arver tilhørighet fra en forelder, nekter systemet å starte.
Kjør `npm run sjekk:isolering` for å se dekningen.

## Legge systemet ut på nett

Systemet trenger en server som kjører Node **og** en PostgreSQL-database. Det
kan ikke ligge på GitHub Pages eller annen statisk hosting — der finnes verken
database eller innlogging.

Vercel og Neon fungerer godt sammen og har begge et gratisnivå:

**1. Lag databasen først.** I Vercel: `Storage` → `Create Database` →
Neon Postgres. Vercel legger inn tilkoblingsstrengene som miljøvariabler
automatisk.

**2. Importer repoet** i Vercel (`Add New` → `Project`).

**3. Legg inn miljøvariablene** før første utrulling:

| Variabel | Verdi |
|---|---|
| `DATABASE_URL` | Settes automatisk av databaseintegrasjonen (den med pool) |
| `DIRECT_DATABASE_URL` | Den «unpooled» strengen — migrasjonene trenger den |
| `AUTH_SECRET` | Din egen, generer med kommandoen under |
| `ANTHROPIC_API_KEY` | Valgfri — slår på assistenten |
| `SMTP_*` | Valgfri — lar systemet sende bestillinger selv |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**4. Deploy.** Bygget kjører migrasjonene selv, så databasen får riktig
struktur ved hver utrulling.

**5. Lag den første bedriften.** Databasen er tom, så `/registrer` er åpen.
Kontoen du oppretter der blir plattformeier. Siden stenger seg selv i samme
øyeblikk, og resten av kundene oppretter du fra `/plattform`.

> Kjør aldri `npm run db:seed` mot produksjonsdatabasen — den sletter alt.
> Den nekter å kjøre når `NODE_ENV=production`, men vær likevel oppmerksom.

## Sikkerhet

Tre ting må være i orden før systemet tas i bruk av andre enn deg selv.

**1. `AUTH_SECRET`.** Den signerer innloggingstokens. Er den svak, kan hvem som
helst lage gyldige tokens for hvilken som helst bruker. Systemet nekter å starte
i produksjon hvis nøkkelen er en av eksempelverdiene eller mangler tilfeldighet.

```bash
openssl rand -base64 32
```

**2. Registrering av nye bedrifter.** `/registrer` er åpen nøyaktig så lenge
databasen er tom, slik at plattformeieren kan opprette seg selv. Deretter er
den stengt for godt, og det finnes med vilje ingen miljøvariabel som åpner den
igjen — en bryter som kan stå feil, kommer før eller siden til å stå feil.

Sperren håndheves i server-handlingen, ikke bare i grensesnittet — en stengt
side hjelper ikke hvis noen sender skjemaet rett til serveren.

**3. Testdata.** `npm run db:seed` sletter alt og oppretter kontoer med et
passord som står i koden. Den nekter å kjøre i produksjon, og passordet kan
overstyres med `SEED_PASSWORD`.

**4. Glemt passord.** Brukeren ber om en engangslenke på `/glemt-passord`.
Lenka virker i én time og bare én gang, og selve tokenet lagres bare som hash —
kommer noen seg til databasen, får de en liste de ikke kan gjøre noe med.

Siden svarer likt enten adressen finnes eller ikke. Ellers kunne hvem som helst
brukt den til å kartlegge hvem som jobber hvor.

Dette krever at `SMTP_*` er satt opp. Er den ikke det, sier siden fra om det,
og administratoren i firmaet setter passordet manuelt under Innstillinger.

Et passordbytte avslutter alle andre innlogginger på kontoen. Har noen kommet
seg inn, er det hele poenget med å bytte passord at de mister tilgangen.

I tillegg kontrolleres en innlogget økt mot databasen ved hver sidevisning.
Deaktiverer du en bruker, er hen ute umiddelbart — ikke først når tokenet går
ut om 30 dager.

## Plattformeier

Systemet er bygget for å selges videre, så det finnes ett nivå over kundene.

Den aller første kontoen — den du oppretter under førstegangsoppsettet — er
plattformeier. Bare den ser `/plattform`, der alle kundene ligger. Derfra
oppretter du nye bedrifter med hver sin første administrator, og du kan åpne
en kundes system for å hjelpe dem, eller deaktivere en bedrift uten å slette
noe som helst.

Derfra kan du også opprette en **demobedrift** med ett trykk: et anlegg med
utstyr, deler under minimum, jobber i alle statuser, forfalt forebyggende
vedlikehold og brukere i hver rolle. Den er en helt vanlig kunde i systemet, og
er der for at du skal kunne vise fram hva systemet gjør uten å røre ekte data.

Alle andre er administratorer i sitt eget firma og ingenting mer. De ser ikke
at plattformsiden finnes — den svarer «finnes ikke», ikke «ingen tilgang».

Det viktige for sikkerheten: **plattformeieren omgår ikke dataadskillelsen.**
Når du åpner en kunde, bytter økten din hvilken organisasjon den peker på, og
all datatilgang går fortsatt gjennom `dbForOrg()` akkurat som for kundens egne
brukere. Plattformtilgangen er derfor ikke en ny vei rundt filteret. En gul
stripe på toppen gjør det umulig å glemme hvem sitt system du står i.

Rettigheten leses fra databasen ved hver sidevisning, ikke fra
innloggingstokenet. Fjernes den, gjelder det umiddelbart.

## Roller

Rollene er et utgangspunkt, ikke en tvangstrøye. Hva hver av dem faktisk får
gjøre, bestemmer administratoren under **Oppsett**.

| Rolle | Tenkt for |
|---|---|
| **Administrator** | Alt, inkludert å administrere brukere og rettigheter |
| **Leder** | Ser alt, godkjenner arbeid, eier budsjettet |
| **Planlegger** | Planlegger arbeid og forebyggende vedlikehold |
| **Delelageransvarlig** | Styrer reservedeler, bestillinger og leverandører |
| **Tekniker** | Utfører arbeid, fører timer, tar ut deler |
| **Gjest** | Kun lesetilgang |

### Hvem får gjøre hva

Hver modul har tre nivåer, og de bygger på hverandre:

| Nivå | Betyr |
|---|---|
| **Se** | Lese, men ikke røre |
| **Endre** | Det daglige arbeidet: føre timer, ta ut deler, motta varer |
| **Administrere** | Sette opp: opprette utstyr og deler, sende bestillinger |

Administrator har alltid alt og kan ikke krysses bort — uten en rolle som
garantert kommer inn, kunne en bedrift låse seg selv ute av sitt eget oppsett.

Sperren håndheves tre steder, og alle tre trengs:

1. **Menyen** viser bare det rollen kan åpne. Det er bekvemmelighet, ikke sikkerhet.
2. **Hver side** avviser med «finnes ikke» om rollen mangler tilgang. Å skrive
   adressen selv hjelper ikke.
3. **Hver server-handling** sjekker på nytt før den rører databasen. En skjult
   knapp hindrer ingen i å sende forespørselen direkte.

Rollen og rettighetene leses fra databasen ved hver sidevisning, ikke fra
innloggingstokenet. Degraderer du noen, gjelder det med det samme.

## Kjente begrensninger

- `pgvector` er ikke i bruk. Søket bruker Postgres sitt norske fulltekstsøk, som
  fungerer godt, men semantisk vektorsøk ville funnet flere formuleringer av samme feil.
- Vedleggsmodellen finnes i databasen, men filopplasting er ikke bygget i
  grensesnittet ennå.
- Prisma sitt CLI-verktøy har en kjent sårbarhet i `deepmerge-ts`. Den kjører kun
  lokalt ved migrering, ikke i den ferdige appen, og det finnes ingen ikke-brytende
  oppdatering ennå.
