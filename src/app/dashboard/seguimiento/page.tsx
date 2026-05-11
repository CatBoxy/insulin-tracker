"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CheckupList from "@/components/checkups/CheckupList";

export default function SeguimientoPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(d => { if (d) setAuthed(true); })
      .catch(() => router.push("/login"));
  }, [router]);

  if (!authed) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Seguimiento médico</h1>
            <p className="text-xs text-gray-500">Tus controles de salud</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <CheckupList variant="full" />
      </main>
    </div>
  );
}
