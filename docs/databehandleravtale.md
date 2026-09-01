# Databehandleravtale

**Utkast.** Dette er ikke juridisk rådgivning. Avtalen dekker det
personvernforordningen artikkel 28 krever, og beskriver systemet slik det
faktisk er bygget — men få den lest av advokat før du bruker den på en kunde
med egen innkjøpsavdeling.

Felter i `[klammer]` må fylles ut før avtalen sendes.

---

## Parter

**Behandlingsansvarlig** (kunden): `[Firmanavn]`, org.nr. `[nummer]`

**Databehandler** (leverandøren): `[Ditt firma eller navn]`, org.nr. `[nummer]`

Avtalen gjelder fra `[dato]` og så lenge kunden bruker vedlikeholdssystemet.

---

## 1. Hva avtalen gjelder

Kunden bruker et vedlikeholdsstyringssystem levert av databehandleren. For å
drive systemet behandler databehandleren personopplysninger på vegne av
kunden.

**Kunden bestemmer** hva opplysningene brukes til. Databehandleren behandler
dem bare etter kundens instruks, og etter denne avtalen. Systemet i seg selv
er den løpende instruksen: det som kan gjøres i grensesnittet, er det som er
avtalt.

Databehandleren bruker **ikke** kundens opplysninger til egne formål. De
brukes ikke til å utvikle produktet, ikke til statistikk på tvers av kunder,
og ikke til å trene modeller.

---

## 2. Hvilke opplysninger, om hvem

**Om ansatte hos kunden:**

- navn, e-postadresse, telefonnummer
- rolle og tilgangsnivå
- timepris og normal arbeidstid per dag
- førte timer, med dato og hvilken jobb de gjelder
- hvem som har meldt, fått tildelt og utført arbeidsordre
- hvem som har meldt avvik, fylt ut skjemaer og bedt om deler
- tekst den enkelte selv skriver inn i beskrivelser, løsninger og kommentarer
- tidspunkt for siste innlogging

**Om kontaktpersoner hos kundens leverandører:**

- navn, e-postadresse, telefonnummer

Passord lagres **aldri i lesbar form** — bare som en enveis hash. Verken
databehandleren eller noen annen kan lese dem ut igjen.

Systemet er ikke ment for særlige kategorier av personopplysninger.
Helseopplysninger, fagforeningsmedlemskap og liknende skal ikke legges inn i
fritekstfelt.

---

## 3. Sikkerhet

Databehandleren har iverksatt disse tiltakene. De er beskrevet konkret, ikke
som en hensiktserklæring, slik at kunden kan kontrollere dem.

**Adskillelse mellom kunder.** Hver kunde har sitt eget område i databasen.
Adskillelsen håndheves i databaselaget, ikke bare i den enkelte spørring, og
systemet nekter å starte dersom en ny tabell mangler denne beskyttelsen. Det
finnes en automatisk kontroll som kjøres ved hver endring i koden.

**Tilgangsstyring.** Hver bruker har en rolle, og kunden bestemmer selv hva
hver rolle får se og gjøre. Kontrollen ligger på serveren, ikke bare i
grensesnittet — en skjult knapp er ingen sperre.

**Måling av enkeltpersoner** er slått av som standard. Kunden må selv slå på
at ledere kan se tall om navngitte ansatte. Se punkt 9.

**Overføring.** All trafikk går kryptert over HTTPS.

**Passord.** Lagres som hash med bcrypt, med kostnadsfaktor 12.

**Sporbarhet.** Hver registrering lagrer hvem som gjorde den og når:
arbeidsordre, førte timer, deleuttak, avvik, kommentarer og
lagerbevegelser. Lagerbevegelser føres som en fullstendig reskontro, slik
at beholdningen alltid kan spores tilbake.

> **Vær ærlig om denne:** systemet har ikke en samlet endringslogg. Blir en
> arbeidsordre rettet i ettertid, lagres den nye teksten — ikke hvem som
> endret hva. Sier du noe annet til en kunde med IT-avdeling, blir du tatt
> på det. Fjern dette avsnittet når loggen er på plass.

**Sikkerhetskopi.** Kunden kan når som helst laste ned alt de har lagt inn,
under Innstillinger. Databehandleren tar i tillegg kopi ved behov.
Sikkerhetskopier inneholder ikke passord.

---

## 4. Underleverandører

Kunden godtar at databehandleren bruker disse:

| Underleverandør | Rolle | Hvor dataene ligger |
|---|---|---|
| Neon Inc. | Database | Frankfurt, Tyskland (`eu-central-1`) |
| Vercel Inc. | Drift av applikasjonen og fillagring | Frankfurt, Tyskland (`fra1`) |
| `[e-posttjeneste]` | Utsending av e-post, som passordlenker | `[region]` |
| Anthropic PBC | Kun hvis kunden tar i bruk AI-assistenten | USA |

**Kundens data lagres i Tyskland**, altså innenfor EØS. Både databasen og
filene ligger i Frankfurt.

Tar kunden i bruk AI-assistenten, sendes teksten i spørsmålet og de
arbeidsordrene assistenten slår opp i, til Anthropic i USA for å bli besvart.
Overføringen skjer på grunnlag av EUs standard personvernbestemmelser.
Assistenten er slått av med mindre kunden ber om den, og kunden kan når som
helst be om at den slås av igjen.

Databehandleren varsler kunden **minst 30 dager før** en ny underleverandør
tas i bruk eller byttes ut. Kunden kan protestere skriftlig, og kan si opp
avtalen dersom partene ikke blir enige.

---

## 5. Taushetsplikt

Alle som får tilgang til kundens opplysninger hos databehandleren er bundet av
taushetsplikt. Taushetsplikten gjelder også etter at avtalen er avsluttet.

---

## 6. Hjelp til kunden

Databehandleren hjelper kunden med:

- **Krav fra de registrerte.** Ber en ansatt om innsyn, retting eller
  sletting, gjør kunden det selv i systemet. Trengs det mer, hjelper
  databehandleren innen rimelig tid.
- **Sikkerhetsbrudd.** Se punkt 7.
- **Vurdering av personvernkonsekvenser**, dersom kunden må gjøre en slik.

---

## 7. Ved sikkerhetsbrudd

Oppdager databehandleren et brudd på personopplysningssikkerheten, varsles
kunden **uten ugrunnet opphold, og senest innen 48 timer** etter at bruddet ble
oppdaget.

Varselet inneholder det databehandleren vet på det tidspunktet: hva som har
skjedd, hvilke opplysninger og hvor mange som er berørt, sannsynlige følger, og
hva som gjøres.

Det er **kunden** som eventuelt melder til Datatilsynet. Fristen er 72 timer
etter at kunden ble kjent med bruddet.

---

## 8. Sletting og utlevering

Når avtalen tar slutt, velger kunden om opplysningene skal **slettes** eller
**leveres tilbake**.

Kunden kan når som helst laste ned alt selv, som regneark eller JSON, under
Innstillinger. Det krever ingen henvendelse til databehandleren.

Velges sletting, slettes alt innen **30 dager**. Sikkerhetskopier som allerede
er tatt, slettes ved neste ordinære utskifting, og senest innen 90 dager.

---

## 9. Måling av ansatte

Systemet kan vise tall om den enkelte ansatte — fullførte jobber, førte timer,
dokumentasjon og annet.

Dette står som standard på **«Egne tall»**: hver ansatt ser sitt eget arbeid,
og ingen ser andres.

Skal ledere se oversikt over navngitte ansatte, må kunden slå det på selv under
Oppsett. **Det er et kontrolltiltak etter arbeidsmiljøloven kapittel 9**, og
kunden er ansvarlig for å drøfte det med tillitsvalgte, informere de ansatte,
og vurdere jevnlig om tiltaket fortsatt er nødvendig.

Databehandleren tar ikke dette valget for kunden.

---

## 10. Kontroll

Kunden kan be om dokumentasjon på at avtalen følges. Databehandleren svarer
innen rimelig tid.

Ønsker kunden revisjon på stedet, avtales det på forhånd, og kunden dekker
egne kostnader.

---

## 11. Ansvar og varighet

Avtalen gjelder så lenge databehandleren behandler opplysninger for kunden.
Punkt 5 om taushetsplikt og punkt 8 om sletting gjelder også etter opphør.

Ved motstrid mellom denne avtalen og hovedavtalen, går denne foran i spørsmål
om behandling av personopplysninger.

---

**Sted og dato:** `[            ]`

Behandlingsansvarlig: `[navn og signatur]`

Databehandler: `[navn og signatur]`
