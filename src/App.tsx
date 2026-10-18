import { useState } from "react";
import Background from "./components/Background";
import Header from "./components/Header";
import Hero from "./components/Hero";
import MessageForm from "./components/MessageForm";
import SuccessScreen from "./components/SuccessScreen";
import NotesPage from "./pages/NotesPage";
import BooksPage from "./pages/BooksPage";
import AdminPage from "./pages/AdminPage";
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
