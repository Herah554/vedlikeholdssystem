-- Rutenettet gikk fra fire til tolv kolonner, og fra tre til åtte rader.
--
-- Fire kolonner betyr fire mulige bredder, og det er ikke fritt nok til å
-- bygge dashbordet slik man vil. Tolv deler seg pent i halve, tredjedeler,
-- fjerdedeler og seksdeler.
--
-- Lagrede oppsett er skrevet i den gamle målestokken. Uten dette ville en
-- widget som var halve skjermen bred blitt en sjettedel, og hvert eneste
-- dashbord ville sett ødelagt ut etter oppdateringen. Derfor ganges bredde og
-- x med tre, høyde og y med to — samme forhold som endringen selv.
--
-- Bare felter som faktisk finnes røres. Et oppsett som mangler høyde er lagret
-- før høyde fantes, og der henter koden widgetens standardhøyde ved innlesing.
-- Skrev vi inn en verdi her, ville vi frosset et tall systemet ellers ville
-- valgt riktig selv — og alle diagrammene ville blitt for lave.

UPDATE "dashboards"
SET layout = (
  SELECT jsonb_agg(
    el
      || CASE WHEN el ? 'w'
           THEN jsonb_build_object('w', LEAST(12, GREATEST(1, (el->>'w')::int * 3)))
           ELSE '{}'::jsonb END
      || CASE WHEN el ? 'h'
           THEN jsonb_build_object('h', LEAST(8, GREATEST(1, (el->>'h')::int * 2)))
           ELSE '{}'::jsonb END
      || CASE WHEN el ? 'x'
           THEN jsonb_build_object('x', GREATEST(0, (el->>'x')::int) * 3)
           ELSE '{}'::jsonb END
      || CASE WHEN el ? 'y'
           THEN jsonb_build_object('y', GREATEST(0, (el->>'y')::int) * 2)
           ELSE '{}'::jsonb END
    ORDER BY ord
  )
  FROM jsonb_array_elements(layout::jsonb) WITH ORDINALITY AS t(el, ord)
)
WHERE jsonb_typeof(layout::jsonb) = 'array'
  AND jsonb_array_length(layout::jsonb) > 0;
