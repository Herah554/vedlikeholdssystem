"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kroner, tall } from "@/lib/format";
import { useErMorkt } from "@/components/tema";

/**
 * Diagrammer må kjøre i nettleseren, så de ligger samlet her som
 * klientkomponenter. De henter ingen data selv — sidene sender inn
 * ferdig oppsummerte tall.
 */

function farger(morkt: boolean) {
  return {
    akse: { fontSize: 12, fill: morkt ? "#94a3b8" : "#64748b" },
    rutenett: morkt ? "#253046" : "#e2e8f0",
    boks: {
      borderRadius: 8,
      border: morkt ? "1px solid #253046" : "1px solid #e2e8f0",
      backgroundColor: morkt ? "#111827" : "#ffffff",
      color: morkt ? "#e8edf5" : "#0f172a",
      fontSize: 13,
      boxShadow: morkt
        ? "0 4px 12px rgb(0 0 0 / 0.4)"
        : "0 4px 12px rgb(15 23 42 / 0.08)",
    },
    markor: { fill: morkt ? "#1a2334" : "#f1f5f9" },
  };
}

/**
 * Høyden er et tall på vanlige sider og «100%» på dashbordet.
 *
 * Dashbordet lar brukeren dra widgeten i høyden, og da må diagrammet følge
 * med. Andre steder står diagrammet i en boks uten fast høyde, og der ville
 * «100%» blitt null piksler.
 */
type MedHoyde = { hoyde?: number | `${number}%` };

export function StatusSoyler({
  data,
  hoyde = 240,
}: {
  data: { navn: string; antall: number; farge: string }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="navn" tick={akse} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={akse} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={boks}
          formatter={(v) => [`${Number(v)} stk`, "Antall"]}
          cursor={markor}
        />
        <Bar dataKey="antall" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.navn} fill={d.farge} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KostnadLinje({
  data,
  hoyde = 260,
}: {
  data: { maned: string; arbeid: number; deler: number }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="maned" tick={akse} tickLine={false} axisLine={false} />
        <YAxis
          tick={akse}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} k` : String(v))}
        />
        <Tooltip
          contentStyle={boks}
          formatter={(v, navn) => [kroner(Number(v)), navn === "arbeid" ? "Arbeid" : "Deler"]}
        />
        <Legend
          formatter={(v) => (v === "arbeid" ? "Arbeid" : "Deler")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line type="monotone" dataKey="arbeid" stroke="#4f46e5" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="deler" stroke="#0ea5e9" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function NedetidSoyler({
  data,
  hoyde = 260,
}: {
  data: { kode: string; navn: string; minutter: number }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} horizontal={false} />
        <XAxis
          type="number"
          tick={akse}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(Number(v) / 60)} t`}
        />
        <YAxis
          type="category"
          dataKey="kode"
          tick={akse}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={boks}
          formatter={(v) => [`${tall(Number(v) / 60, 1)} timer`, "Nedetid"]}
          labelFormatter={(kode) =>
            data.find((d) => d.kode === String(kode))?.navn ?? kode
          }
          cursor={markor}
        />
        <Bar dataKey="minutter" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BudsjettSoyler({
  data,
}: {
  data: { navn: string; budsjett: number; forbrukt: number }[];
}) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="navn" tick={akse} tickLine={false} axisLine={false} />
        <YAxis
          tick={akse}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} k` : String(v))}
        />
        <Tooltip
          contentStyle={boks}
          formatter={(v, navn) => [
            kroner(Number(v)),
            navn === "budsjett" ? "Budsjett" : "Forbrukt",
          ]}
          cursor={markor}
        />
        <Legend
          formatter={(v) => (v === "budsjett" ? "Budsjett" : "Forbrukt")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="budsjett" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="forbrukt" fill="#4f46e5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Meldt mot utført, måned for måned.
 *
 * To søyler side om side er valgt framfor to linjer fordi det er lettere å se
 * hvilken som er høyest når de står ved siden av hverandre. Og det er nettopp
 * det spørsmålet grafen skal svare på: holder vi tritt?
 */
export function MeldtUtfortSoyler({
  data,
  hoyde = 260,
}: {
  data: { maned: string; meldt: number; utfort: number }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="maned" tick={akse} tickLine={false} axisLine={false} />
        <YAxis tick={akse} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={boks}
          cursor={markor}
          formatter={(v, n) => [`${Number(v)} stk`, n === "meldt" ? "Meldt inn" : "Utført"]}
        />
        <Legend
          formatter={(v) => (v === "meldt" ? "Meldt inn" : "Utført")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="meldt" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="utfort" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Hvor stor del av arbeidet som er planlagt.
 *
 * Stablede søyler, fordi spørsmålet er hvor stor andelen er — ikke hvor mange
 * det var av hver. Et anlegg som får den grønne delen til å vokse, bruker
 * mindre penger og har mindre nedetid.
 */
export function ArbeidstypeSoyler({
  data,
  hoyde = 260,
}: {
  data: { maned: string; forebyggende: number; korrektiv: number; annet: number }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  const navn: Record<string, string> = {
    forebyggende: "Forebyggende",
    korrektiv: "Korrektiv",
    annet: "Annet",
  };

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="maned" tick={akse} tickLine={false} axisLine={false} />
        <YAxis tick={akse} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={boks}
          cursor={markor}
          formatter={(v, n) => [`${Number(v)} stk`, navn[String(n)] ?? String(n)]}
        />
        <Legend
          formatter={(v) => navn[String(v)] ?? String(v)}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="forebyggende" stackId="a" fill="#10b981" />
        <Bar dataKey="korrektiv" stackId="a" fill="#f43f5e" />
        <Bar dataKey="annet" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Hvor lang tid jobbene tar.
 *
 * Både snitt og median vises. Snittet alene lyver når én jobb har ligget i et
 * halvår — medianen viser hvordan det står til for de fleste.
 */
export function ReparasjonstidLinje({
  data,
  hoyde = 260,
}: {
  data: { maned: string; snitt: number | null; median: number | null }[];
} & MedHoyde) {
  const { akse, rutenett, boks, markor } = farger(useErMorkt());

  return (
    <ResponsiveContainer width="100%" height={hoyde}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rutenett} vertical={false} />
        <XAxis dataKey="maned" tick={akse} tickLine={false} axisLine={false} />
        <YAxis tick={akse} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={boks}
          cursor={markor}
          formatter={(v, n) => [
            v === null ? "ingen data" : `${tall(Number(v), 1)} dager`,
            n === "snitt" ? "Snitt" : "Median",
          ]}
        />
        <Legend
          formatter={(v) => (v === "snitt" ? "Snitt" : "Median")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line type="monotone" dataKey="snitt" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="median" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
