import { FormEvent, useState } from "react";
import { submitMessage } from "../lib/api";
import { CATEGORIES, CategoryId, MESSAGE_MAX_LENGTH } from "../lib/validation";

type Status = "idle" | "loading" | "error";

interface Props {
  onSuccess: () => void;
}

export default function MessageForm({ onSuccess }: Props) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CategoryId | undefined>(undefined);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setError(null);

    const outcome = await submitMessage(text, category);

    if (outcome.ok) {
      setStatus("idle");
      setText("");
      setCategory(undefined);
      onSuccess();
      return;
    }

    setStatus("error");
    setError(outcome.message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-up rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-azure backdrop-blur-xl sm:p-7"
      style={{ animationDelay: "280ms" }}
      noValidate
    >
      <h2 className="font-display text-xl font-semibold text-mist">
        Di cosa vuoi parlarci?
      </h2>

      <div className="mt-4">
        <label htmlFor="message" className="sr-only">
          Il tuo messaggio
        </label>
        <textarea
          id="message"
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Scrivi qui ciò che vuoi farci sapere..."
          rows={6}
          className="w-full resize-none rounded-2xl border border-white/10 bg-night-900/60 px-4 py-3.5 text-[16px] leading-relaxed text-mist placeholder:text-mist/35 transition focus:border-azure-400 focus:shadow-azure focus:outline-none"
          aria-describedby={error ? "form-error" : undefined}
          aria-invalid={Boolean(error)}
        />
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2.5 text-sm font-medium text-mist/70">
          Categoria <span className="font-normal text-mist/40">(facoltativa)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const selected = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(selected ? undefined : c.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                  selected
                    ? "border-gold-400/60 bg-gold-500/15 text-gold-300"
                    : "border-white/10 bg-white/[0.03] text-mist/70 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <span className="mr-1.5" aria-hidden="true">
                  {c.emoji}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p
          id="form-error"
          role="alert"
          className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="group relative mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-azure-500 to-azure-600 px-6 py-4 text-[15px] font-semibold text-white shadow-azure transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:hover:shadow-[0_0_50px_-8px_rgba(44,99,242,0.7)]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-gold-400/0 transition group-hover:bg-gold-400/[0.06]"
        />
        {status === "loading" ? (
          <>
            <Spinner />
            Invio in corso...
          </>
        ) : (
          "Invia in modo anonimo"
        )}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-mist/45">
        Non servono nome, email o altri dati personali.
        <br />
        Questo spazio nasce per permetterti di parlare liberamente.
      </p>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
