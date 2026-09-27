import logo from "../assets/logo.png";

interface Props {
  onReset: () => void;
}

export default function SuccessScreen({ onReset }: Props) {
  return (
    <div
      role="status"
      className="flex animate-fade-up flex-col items-center rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-14 text-center shadow-gold backdrop-blur-xl"
    >
      <div className="flex h-16 w-16 animate-check-pop items-center justify-center rounded-full bg-gold-500/15 ring-1 ring-gold-400/40">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-gold-300" fill="none" aria-hidden="true">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="mt-6 font-display text-2xl font-semibold text-mist">
        Messaggio ricevuto.
      </h2>
      <p className="mt-2 max-w-xs text-sm text-mist/60">
        Grazie per aver fatto sentire la tua voce.
      </p>

      <img src={logo} alt="Logo Nova Severi" className="mt-8 h-10 w-10 rounded-full opacity-80" />

      <button
        type="button"
        onClick={onReset}
        className="mt-8 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-mist/80 transition hover:border-azure-400/50 hover:text-mist"
      >
        Invia un altro messaggio
      </button>
    </div>
  );
}
