"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { loginSchema } from "@/lib/validation";

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const doctorCode = searchParams.get("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {credentials:"include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al iniciar sesión"); return; }
      if (data.user.email_verified === false) {
        setUnverifiedEmail(parsed.data.email);
        return;
      }
      if (data.user.role === "admin") window.location.href = "/admin";
      else if (data.user.role === "doctor") window.location.href = "/doctor";
      else window.location.href = doctorCode ? `/dashboard?doctor=${doctorCode}` : "/dashboard";
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition ${fieldErrors[field] ? "border-red-300" : "border-gray-200"}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Glycofit</h1>
          <p className="text-gray-500 mt-1">Tu salud, bajo control</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass("email")} placeholder="tu@email.com" />
            {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className={inputClass("password") + " pr-12"} />
            {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">
              Recuperar contraseña
            </Link>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
        {unverifiedEmail && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            <p className="mb-2">Tu email no está confirmado. Revisá tu correo electrónico.</p>
            <div className="flex gap-3">
              <button onClick={async () => {
                setResendMsg("");
                const res = await fetch("/api/auth/resend-verification", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: unverifiedEmail }),
                });
                setResendMsg(res.ok ? "Email reenviado" : "Error al reenviar");
              }} className="text-primary-600 font-medium hover:underline text-sm">
                Reenviar email de confirmación
              </button>
              <button onClick={() => {
                if (doctorCode) window.location.href = `/dashboard?doctor=${doctorCode}`;
                else window.location.href = "/dashboard";
              }} className="text-gray-500 hover:underline text-sm">
                Continuar sin confirmar
              </button>
            </div>
            {resendMsg && <p className="mt-2 text-xs text-green-600">{resendMsg}</p>}
          </div>
        )}
        <p className="text-center text-sm text-gray-500 mt-6">
          No tenés cuenta? <Link href={`/register${doctorCode ? `?doctor=${doctorCode}` : ""}`} className="text-primary-600 font-medium hover:underline">Registrate</Link>
        </p>
      </div>
    </div>
  );
}
