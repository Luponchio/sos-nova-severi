import logo from "../assets/logo.png";

export default function Hero() {
  return (
    <div className="flex flex-col items-center px-5 pb-8 pt-10 text-center sm:pt-16">
      <img
        src={logo}
        alt="Logo Nova Severi"
        className="mb-6 h-20 w-20 animate-fade-up rounded-full shadow-gold ring-1 ring-gold-400/20 sm:h-24 sm:w-24"
      />

      <h1
        className="animate-fade-up font-display text-4xl font-semibold leading-[1.05] text-mist sm:text-5xl"
        style={{ animationDelay: "80ms" }}
      >
        S.O.S.
        <span className="block text-azure-300">Nova Severi</span>
      </h1>

      <p
        className="mt-4 animate-fade-up text-base font-medium text-gold-300 sm:text-lg"
        style={{ animationDelay: "160ms" }}
      >
        La tua voce, senza il tuo nome.
      </p>

      <div className="mt-7 max-w-sm animate-fade-up" style={{ animationDelay: "220ms" }}>
        <p className="text-lg font-semibold text-mist/95">Hai qualcosa da dire?</p>
        <p className="mt-2 text-sm leading-relaxed text-mist/60">
          Problemi, richieste, idee, consigli o proposte per migliorare la
          nostra scuola. Scrivilo qui. Lo ascolteremo.
        </p>
      </div>
    </div>
  );
}
