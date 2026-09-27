import logo from "../assets/logo.png";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-night-950/70 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Logo Nova Severi"
            className="h-9 w-9 rounded-full ring-1 ring-white/10"
          />
          <span className="text-sm font-semibold tracking-tight text-mist/90">
            Nova Severi
          </span>
        </div>
        <span className="text-xs font-medium text-azure-300/80">
          S.O.S. Studenti
        </span>
      </div>
    </header>
  );
}
