import { useState } from "react";
import Background from "./components/Background";
import Header from "./components/Header";
import Hero from "./components/Hero";
import MessageForm from "./components/MessageForm";
import SuccessScreen from "./components/SuccessScreen";
import NotesPage from "./pages/NotesPage";
import BooksPage from "./pages/BooksPage";
import AdminPage from "./pages/AdminPage";
import GiocaPage from "./pages/GiocaPage";
import SchermoPage from "./pages/SchermoPage";
import RegiaPage from "./pages/RegiaPage";
import { useHashRoute } from "./lib/useHashRoute";

function SosPage() {
  const [sent, setSent] = useState(false);
  return (
    <>
      <Hero />
      <div className="pb-4">
        {sent ? <SuccessScreen onReset={() => setSent(false)} /> : <MessageForm onSuccess={() => setSent(true)} />}
      </div>
    </>
  );
}

export default function App() {
  const route = useHashRoute();

  // Pagine dell'assemblea: a tutto schermo, senza menu del sito
  if (route === "schermo") return <SchermoPage />;
  if (route === "gioca" || route === "regia") {
    return (
      <div className="relative min-h-screen">
        <Background />
        {route === "gioca" ? <GiocaPage /> : <RegiaPage />}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <Background />
      <Header route={route} />

      <main className="mx-auto max-w-xl px-5 pb-16">
        {route === "sos" && <SosPage />}
        {route === "appunti" && <NotesPage />}
        {route === "libri" && <BooksPage />}
        {route === "admin" && <AdminPage />}
      </main>

      <footer className="pb-10 text-center text-xs text-mist/30">
        Nova Severi · Rappresentanza studentesca · Liceo Scientifico
        Francesco Severi, Frosinone
      </footer>
    </div>
  );
}
