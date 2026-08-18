import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * Felles byggeklosser for hele systemet.
 *
 * Alt som vises flere steder — kort, merkelapper, knapper, tabeller — bor her,
 * slik at en endring i utseendet slår gjennom overalt på én gang.
 */

// ─── Kort ─────────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("kort", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

// ─── Merkelapper ──────────────────────────────────────────────

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        className ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}

// ─── Knapper ──────────────────────────────────────────────────

const KNAPP_STIL = {
  primær:
    "bg-merke-600 text-white hover:bg-merke-700 focus-visible:outline-merke-600",
  sekundær:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  fare: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  stille:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400",
} as const;

const KNAPP_BASIS =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

type Variant = keyof typeof KNAPP_STIL;

export function Button({
  variant = "primær",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={cn(KNAPP_BASIS, KNAPP_STIL[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primær",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={cn(KNAPP_BASIS, KNAPP_STIL[variant], className)} {...props} />
  );
}

// ─── Skjemafelter ─────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const FELT_STIL =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 " +
  "ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 " +
  "focus:ring-2 focus:ring-inset focus:ring-merke-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FELT_STIL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FELT_STIL, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(FELT_STIL, "pr-8", className)} {...props} />;
}

// ─── Tabell ───────────────────────────────────────────────────

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-slate-200 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-slate-100 px-4 py-3 align-middle", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-slate-50", className)} {...props} />;
}

// ─── Tomtilstand ──────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Nøkkeltall ───────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  tone = "nøytral",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "nøytral" | "god" | "advarsel" | "kritisk";
  href?: string;
}) {
  const toner = {
    nøytral: "text-slate-900",
    god: "text-emerald-600",
    advarsel: "text-amber-600",
    kritisk: "text-red-600",
  } as const;

  const innhold = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toner[tone])}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="kort block p-4 transition-colors hover:bg-slate-50">
        {innhold}
      </Link>
    );
  }
  return <div className="kort p-4">{innhold}</div>;
}

// ─── Sidetopp ─────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
