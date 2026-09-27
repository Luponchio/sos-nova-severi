import { useState } from "react";
import Background from "./components/Background";
import Header from "./components/Header";
import Hero from "./components/Hero";
import MessageForm from "./components/MessageForm";
import SuccessScreen from "./components/SuccessScreen";

export default function App() {
  const [sent, setSent] = useState(false);

  return (
    <div className="relative min-h-screen">
      <Background />
      <Header />

      <main className="mx-auto max-w-xl px-5 pb-16">
        <Hero />
        <div className="pb-4">
          {sent ? (
            <SuccessScreen onReset={() => setSent(false)} />
          ) : (
            <MessageForm onSuccess={() => setSent(true)} />
          )}
        </div>
      </main>

      <footer className="pb-10 text-center text-xs text-mist/30">
        S.O.S. Nova Severi · Rappresentanza studentesca · Liceo Scientifico
        Francesco Severi, Frosinone
      </footer>
    </div>
  );
}
