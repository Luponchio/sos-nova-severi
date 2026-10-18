import type { ReactNode } from "react";
import { CLASS_YEARS, SUBJECTS } from "../lib/catalog";

// Stili condivisi, coerenti con il form di S.O.S.

export const cardClass =
  "rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6";

export const inputClass =
  "w-full rounded-2xl border border-white/10 bg-night-900/60 px-4 py-3 text-[16px] text-mist placeholder:text-mist/35 transition focus:border-azure-400 focus:shadow-azure focus:outline-none";

export const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-azure-500 to-azure-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-azure transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const ghostButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-mist/80 transition hover:border-azure-400/50 hover:text-mist disabled:opacity-50";

export function PageIntro({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up px-1 pb-6 pt-8 text-center sm:pt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">{kicker}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] text-mist sm:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-mist/60">{children}</p>
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-mist/75">
        {label}
        {hint && <span className="font-normal text-mist/40"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function SubjectSelect({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {SUBJECTS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function ClassSelect({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {CLASS_YEARS.map((c) => (
        <option key={c} value={c}>
          {c}ª
        </option>
      ))}
    </select>
  );
}

/** Barra filtri: ricerca libera, classe a pillole, materia. */
export function Filters({
  search,
  onSearch,
  searchPlaceholder,
  classYear,
  onClassYear,
  subject,
  onSubject,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  classYear: number | null;
  onClassYear: (v: number | null) => void;
  subject: string;
  onSubject: (v: string) => void;
}) {
  const pills: (number | null)[] = [null, ...CLASS_YEARS];
  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/40"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Cerca"
          className={`${inputClass} pl-11`}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Classe">
        {pills.map((c) => {
          const active = classYear === c;
          return (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onClassYear(c)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-gold-400/60 bg-gold-500/15 text-gold-300"
                  : "border-white/10 bg-white/[0.03] text-mist/65 hover:border-white/20"
              }`}
            >
              {c === null ? "Tutte" : `${c}ª`}
            </button>
          );
        })}
      </div>
      <SubjectSelect id="filter-subject" value={subject} onChange={onSubject} placeholder="Tutte le materie" />
    </div>
  );
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "gold" | "azure" }) {
  const tones = {
    plain: "border-white/10 bg-white/[0.04] text-mist/70",
    gold: "border-gold-400/30 bg-gold-500/10 text-gold-300",
    azure: "border-azure-400/30 bg-azure-500/10 text-azure-300",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
      {children}
    </p>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-mist/75">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-night-900 accent-[#D8B65A]"
      />
      <span>{children}</span>
    </label>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function ListState({
  loading,
  error,
  empty,
  onRetry,
  emptyText,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  emptyText: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-3" aria-label="Caricamento">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl border border-white/5 bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3 text-center">
        <ErrorBox>{error}</ErrorBox>
        <button type="button" onClick={onRetry} className={ghostButton}>
          Riprova
        </button>
      </div>
    );
  }
  if (empty) {
    return <p className="rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-mist/50">{emptyText}</p>;
  }
  return null;
}
