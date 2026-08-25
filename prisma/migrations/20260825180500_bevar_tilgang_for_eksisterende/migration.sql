-- Bedrifter som fantes før planene ble innført skal beholde alt de hadde.
--
-- Kolonnen «plan» kom med standardverdien BASIS, og den ville i praksis tatt
-- bestillinger, budsjett og avvik fra kunder som allerede brukte dem. En
-- oppgradering skal aldri fjerne noe uten at noen har bestemt det.
--
-- Nye bedrifter opprettes fortsatt på BASIS. Denne setningen treffer bare det
-- som fantes i det øyeblikket migrasjonen kjørte.
UPDATE "organizations" SET "plan" = 'PRO';
