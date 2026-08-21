"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import DateInput from "@/components/DateInput";
import { registerSchema } from "@/lib/validation";

export default function RegisterPage() {
  return <Suspense><RegisterContent /></Suspense>;
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const doctorCode = searchParams.get("doctor");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
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
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm: "Las contraseñas no coinciden" });
      return;
    }

    const payload = {
      email, password, first_name: firstName, last_name: lastName,
      phone: phone || undefined,
      date_of_birth: dateOfBirth || undefined,
      gender: gender || undefined,
      doctorCode: doctorCode || undefined,
    };

    const parsed = registerSchema.safeParse(payload);
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
      const res = await fetch("/api/auth/register", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al registrarse"); return; }
      setRegisteredEmail(email);
      setVerificationPending(true);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition ${fieldErrors[field] ? "border-red-300" : "border-gray-200"}`;

  if (verificationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Revisá tu correo</h1>
          <p className="text-gray-500 mb-1">
            Enviamos un enlace de confirmación a
          </p>
          <p className="text-gray-800 font-medium mb-4">{registeredEmail}</p>
          <p className="text-sm text-gray-400 mb-6">
            Hacé click en el enlace del email para activar tu cuenta. Si no lo encontrás, revisá la carpeta de spam.
          </p>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-2">¿No recibiste el email?</p>
            <button
              onClick={async () => {
                await fetch("/api/auth/resend-verification", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: registeredEmail }),
                });
                setResendSuccess(true);
                setTimeout(() => setResendSuccess(false), 4000);
              }}
              className="text-sm text-primary-600 font-medium hover:underline"
            >
              Reenviar email de confirmación
            </button>
            {resendSuccess && (
              <p className="mt-2 text-xs text-green-600 font-medium">Email reenviado exitosamente</p>
            )}
          </div>
          <div className="mt-4">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-800">Glycofit</h1>
          <p className="text-gray-500 mt-1">Creá tu cuenta</p>
        </div>

        {doctorName && (
          <div className="bg-primary-50 border border-primary-200 text-primary-700 p-3 rounded-xl text-sm mb-4 text-center">
            Te vas a vincular con <span className="font-semibold">Dr. {doctorName}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className={inputClass("first_name")} placeholder="Juan" />
              {fieldErrors.first_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.first_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className={inputClass("last_name")} placeholder="Pérez" />
              {fieldErrors.last_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass("email")} placeholder="tu@email.com" />
            {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className={inputClass("phone")} placeholder="+54 11 1234-5678" />
            {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
            <DateInput value={dateOfBirth} onChange={setDateOfBirth}
              className={inputClass("date_of_birth") + " cursor-pointer"} maxDate={new Date()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
            <select value={gender} onChange={e => setGender(e.target.value)}
              className={inputClass("gender") + " bg-white"}>
              <option value="">Seleccionar</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
              className={inputClass("password") + " pr-12"} />
            {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña *</label>
            <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetí tu contraseña"
              className={inputClass("confirm") + " pr-12"} />
            {fieldErrors.confirm && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirm}</p>}
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
