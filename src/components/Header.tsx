import logo from "../assets/logo.png";
import type { Route } from "../lib/useHashRoute";

const TABS: { route: Route; href: string; label: string }[] = [
  { route: "sos", href: "#/", label: "S.O.S." },
  { route: "appunti", href: "#/appunti", label: "Appunti" },
  { route: "libri", href: "#/libri", label: "Libri usati" },
];

export default function Header({ route }: { route: Route }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-night-950/75 backdrop-blur-md">
      <div
        className="mx-auto max-w-3xl px-5 pb-3 pt-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2.5">
            <img src={logo} alt="Logo Nova Severi" className="h-9 w-9 rounded-full ring-1 ring-white/10" />
            <span className="text-sm font-semibold tracking-tight text-mist/90">Nova Severi</span>
          </a>
          <span className="text-xs font-medium text-azure-300/80">
            {route === "admin" ? "Area admin" : "Rappresentanza studentesca"}
          </span>
        </div>

        {route !== "admin" && (
          <nav aria-label="Sezioni" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map((t) => {
              const active = route === t.route;
              return (
                <a
                  key={t.route}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-2 py-2 text-center text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-b from-azure-500 to-azure-600 text-white shadow-azure"
                      : "text-mist/60 hover:bg-white/[0.05] hover:text-mist"
                  }`}
                >
                  {t.label}
                </a>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
