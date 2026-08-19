import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Importfiler sendes som skjemadata, og grensa er ellers 1 MB.
       *
       * Et regneark med noen tusen utstyrsenheter ligger typisk på et par
       * hundre kilobyte, men et som er lagret fra Excel med formatering og
       * bilder kan fort passere en megabyte uten at kunden vet det. Ti gir
       * rom for det, og er fortsatt lavt nok til at ingen kan bruke det til
       * å belaste serveren.
       */
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
