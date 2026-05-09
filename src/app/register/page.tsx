"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  return <Suspense><RegisterContent /></Suspense>;
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const doctorCode = searchParams.get("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in and has doctor code, redirect to dashboard with code
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          window.location.href = doctorCode ? `/dashboard?doctor=${doctorCode}` : "/dashboard";
        }
      })
      .catch(() => {});

    if (doctorCode) {
      fetch(`/api/doctors/by-code?code=${doctorCode}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.doctor) setDoctorName(d.doctor.name); })
        .catch(() => {});
    }
  }, [doctorCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, doctorCode: doctorCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al registrarse"); return; }
      window.location.href = "/dashboard";
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Nivelo</h1>
          <p className="text-gray-500 mt-1">Creá tu cuenta</p>
        </div>

        {doctorName && (
          <div className="bg-primary-50 border border-primary-200 text-primary-700 p-3 rounded-xl text-sm mb-4 text-center">
            Te vas a vincular con <span className="font-semibold">Dr. {doctorName}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="tu@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="Repetí tu contraseña" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? "Creando cuenta..." : doctorCode ? "Registrarse y vincularse" : "Registrarse"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Ya tenés cuenta? <Link href={`/login${doctorCode ? `?doctor=${doctorCode}` : ""}`} className="text-primary-600 font-medium hover:underline">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
