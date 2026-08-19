import { SkjelettTabell, SkjelettTopp } from "@/components/skjelett";

/**
 * Vises i det du klikker deg til en side i systemet.
 *
 * Denne dekker alle sidene som ikke har sin egen. Next henter den på forhånd,
 * så den er på skjermen med én gang — menyen og toppen står stille, og bare
 * innholdet byttes ut.
 */
export default function Laster() {
  return (
    <>
      <SkjelettTopp />
      <SkjelettTabell />
    </>
  );
}
