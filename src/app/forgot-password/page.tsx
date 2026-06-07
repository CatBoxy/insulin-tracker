"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Error al enviar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-primary-500 mb-1 text-center">Glycofit</h1>
        <h2 className="text-lg font-semibold text-gray-800 mb-1 text-center">Recuperar contraseña</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-4">
              Revisá tu correo electrónico. Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.
            </div>
            <p className="text-xs text-gray-400 mb-4">El enlace es válido por 15 minutos.</p>
            <a href="/login" className="text-sm text-primary-600 hover:underline font-medium">
              Volver a iniciar sesión
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            />

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>

            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                Volver a iniciar sesión
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
