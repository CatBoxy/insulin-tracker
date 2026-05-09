"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function DoctorRegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          window.location.href = d.user.role === "doctor" ? "/doctor" : "/dashboard";
        }
      })
      .catch(() => {});
  }, []);

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
        body: JSON.stringify({
          email, password, first_name: firstName, last_name: lastName,
          phone: phone || undefined,
          date_of_birth: dateOfBirth || undefined,
          gender: gender || undefined,
          role: "doctor",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al registrarse"); return; }
      window.location.href = "/doctor";
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Nivelo</h1>
          <p className="text-gray-500 mt-1">Registro de profesional</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="María" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="García" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="doctor@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" placeholder="+54 11 1234-5678" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white">
                <option value="">Seleccionar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña *</label>
            <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetí tu contraseña" required minLength={8} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? "Creando cuenta..." : "Registrarse como profesional"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Ya tenés cuenta? <Link href="/login" className="text-primary-600 font-medium hover:underline">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
