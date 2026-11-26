import { useEffect, useState } from "react";

export type Route = "sos" | "appunti" | "libri" | "admin" | "gioca" | "schermo" | "regia";

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, "").split(/[/?]/)[0].toLowerCase();
  if (["appunti", "libri", "admin", "gioca", "schermo", "regia"].includes(name)) return name as Route;
  return "sos";
}

/** Navigazione con #/appunti, #/libri, #/admin (e #/gioca, #/schermo, #/regia per l'assemblea): funziona su Vercel senza configurazioni. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    const titles: Record<Route, string> = {
      sos: "S.O.S. Nova Severi",
      appunti: "Appunti · Nova Severi",
      libri: "Libri usati · Nova Severi",
      admin: "Admin · Nova Severi",
      gioca: "Assemblea d'istituto",
      schermo: "Schermo · Assemblea",
      regia: "Regia · Assemblea",
    };
    document.title = titles[route];
  }, [route]);

  return route;
}
