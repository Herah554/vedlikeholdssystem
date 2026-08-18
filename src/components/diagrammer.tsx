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

/**
 * Diagrammer må kjøre i nettleseren, så de ligger samlet her som
 * klientkomponenter. De henter ingen data selv — sidene sender inn
 * ferdig oppsummerte tall.
 */

const AKSE = { fontSize: 12, fill: "#64748b" };
const RUTENETT = "#e2e8f0";

const boksStil = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 13,
  boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
};

export function StatusSoyler({
  data,
}: {
  data: { navn: string; antall: number; farge: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={RUTENETT} vertical={false} />
        <XAxis dataKey="navn" tick={AKSE} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={AKSE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={boksStil}
          formatter={(v) => [`${Number(v)} stk`, "Antall"]}
          cursor={{ fill: "#f1f5f9" }}
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
}: {
  data: { maned: string; arbeid: number; deler: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={RUTENETT} vertical={false} />
        <XAxis dataKey="maned" tick={AKSE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AKSE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} k` : String(v))}
        />
        <Tooltip
          contentStyle={boksStil}
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
}: {
  data: { kode: string; navn: string; minutter: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={RUTENETT} horizontal={false} />
        <XAxis
          type="number"
          tick={AKSE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(Number(v) / 60)} t`}
        />
        <YAxis
          type="category"
          dataKey="kode"
          tick={AKSE}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={boksStil}
          formatter={(v) => [`${tall(Number(v) / 60, 1)} timer`, "Nedetid"]}
          labelFormatter={(kode) =>
            data.find((d) => d.kode === String(kode))?.navn ?? kode
          }
          cursor={{ fill: "#f1f5f9" }}
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
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={RUTENETT} vertical={false} />
        <XAxis dataKey="navn" tick={AKSE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AKSE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} k` : String(v))}
        />
        <Tooltip
          contentStyle={boksStil}
          formatter={(v, navn) => [
            kroner(Number(v)),
            navn === "budsjett" ? "Budsjett" : "Forbrukt",
          ]}
          cursor={{ fill: "#f1f5f9" }}
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
