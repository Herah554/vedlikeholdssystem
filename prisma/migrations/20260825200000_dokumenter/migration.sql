-- Dokumenter med gyldighet: kalibreringsbevis, sertifikater, kontrollrapporter.
--
-- Et kalibreringsbevis uten utløpsdato er bare en fil i en mappe. Verdien
-- ligger i å vite når det går ut, slik at noen rekker å bestille ny kalibrering
-- før måleren ikke lenger kan brukes til noe som teller.

ALTER TABLE "attachments"
    ADD COLUMN "docType"    TEXT,
    ADD COLUMN "reference"  TEXT,
    ADD COLUMN "validFrom"  TIMESTAMP(3),
    ADD COLUMN "validUntil" TIMESTAMP(3);

-- Indeksen er for oversikten over hva som snart går ut
CREATE INDEX "attachments_organizationId_validUntil_idx"
    ON "attachments"("organizationId", "validUntil");

-- Dokumenttypene er en vanlig verdiliste, slik at hvert firma kan legge til
-- sine egne. Ingen av dem er innebygde: systemet er ikke avhengig av noen
-- bestemt type, det bruker bare utløpsdatoen.
INSERT INTO "list_values"
    ("id", "organizationId", "list", "code", "name", "description", "tone", "sortOrder", "isBuiltIn", "createdAt", "updatedAt")
SELECT
    md5(o."id" || 'dokumenttype' || v."code"),
    o."id",
    'dokumenttype',
    v."code",
    v."name",
    v."description",
    v."tone",
    v."sortOrder",
    false,
    now(),
    now()
FROM "organizations" o
CROSS JOIN (VALUES
    ('KALIBRERING', 'Kalibreringsbevis', 'Måleutstyr som må kalibreres med jevne mellomrom', 'sky',     0),
    ('SERTIFIKAT',  'Sertifikat',        'Løfteutstyr, trykkbeholdere og annet med krav',     'emerald', 1),
    ('KONTROLL',    'Kontrollrapport',   'Periodisk kontroll utført av tredjepart',           'amber',   2),
    ('SAMSVAR',     'Samsvarserklæring', 'Dokumentasjon fra leverandøren',                    'violet',  3),
    ('DATABLAD',    'Datablad',          'Teknisk beskrivelse av utstyret',                   'noytral', 4),
    ('TEGNING',     'Tegning',           'Koblingsskjema, plantegning eller lignende',        'noytral', 5),
    ('MANUAL',      'Bruksanvisning',    'Manual fra produsenten',                            'noytral', 6)
) AS v("code", "name", "description", "tone", "sortOrder");
