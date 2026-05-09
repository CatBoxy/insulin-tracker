"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { updateAccountSchema, changePasswordSchema } from "@/lib/validation";
import { logout } from "@/lib/logout";

interface Account {
  id: number;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
}

interface LinkedDoctor {
  assignment_id: number;
  doctor_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  assigned_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [doctors, setDoctors] = useState<LinkedDoctor[]>([]);

  // Personal info form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [infoError, setInfoError] = useState("");
  const [infoFieldErrors, setInfoFieldErrors] = useState<Record<string, string>>({});
  const [infoLoading, setInfoLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwFieldErrors, setPwFieldErrors] = useState<Record<string, string>>({});
  const [pwLoading, setPwLoading] = useState(false);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/account", { credentials: "include" });
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      const a = data.account;
      setAccount(a);
      setFirstName(a.first_name || "");
      setLastName(a.last_name || "");
      setPhone(a.phone || "");
      setDateOfBirth(a.date_of_birth ? a.date_of_birth.split("T")[0] : "");
      setGender(a.gender || "");
    } catch { router.push("/login"); }
  }, [router]);

  const loadDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/patient/doctors", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadAccount();
    loadDoctors();
  }, [loadAccount, loadDoctors]);

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInfoMsg(""); setInfoError(""); setInfoFieldErrors({});

    const payload = {
      first_name: firstName, last_name: lastName,
      phone: phone || undefined,
      date_of_birth: dateOfBirth || undefined,
      gender: gender || undefined,
    };

    const parsed = updateAccountSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) errors[key] = issue.message;
      }
      setInfoFieldErrors(errors);
      return;
    }

    setInfoLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) { setInfoMsg("Datos actualizados"); }
      else { const d = await res.json(); setInfoError(d.error || "Error"); }
    } catch { setInfoError("Error de conexión"); }
    finally { setInfoLoading(false); }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(""); setPwError(""); setPwFieldErrors({});

    if (newPassword !== confirmPassword) {
      setPwFieldErrors({ confirm: "Las contraseñas no coinciden" });
      return;
    }

    const parsed = changePasswordSchema.safeParse({
      current_password: currentPassword,
      new_password: newPassword,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) errors[key] = issue.message;
      }
      setPwFieldErrors(errors);
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        setPwMsg("Contraseña actualizada");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        const d = await res.json();
        setPwError(d.error || "Error");
      }
    } catch { setPwError("Error de conexión"); }
    finally { setPwLoading(false); }
  }

  async function handleUnlink(assignmentId: number) {
    try {
      const res = await fetch("/api/patient/doctors", {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      if (res.ok) setDoctors(prev => prev.filter(d => d.assignment_id !== assignmentId));
    } catch {}
  }

  const handleLogout = () => logout(router);

  const inputClass = (errors: Record<string, string>, field: string) =>
    `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition ${errors[field] ? "border-red-300" : "border-gray-200"}`;

  if (!account) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  const backUrl = account.role === "doctor" ? "/doctor" : account.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(backUrl)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="font-bold text-gray-800">Mi Cuenta</h1>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Cerrar sesión</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Información Personal</h3>
          {infoMsg && <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm mb-3">{infoMsg}</div>}
          {infoError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{infoError}</div>}
          <form onSubmit={handleInfoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  className={inputClass(infoFieldErrors, "first_name")} />
                {infoFieldErrors.first_name && <p className="text-red-500 text-xs mt-1">{infoFieldErrors.first_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  className={inputClass(infoFieldErrors, "last_name")} />
                {infoFieldErrors.last_name && <p className="text-red-500 text-xs mt-1">{infoFieldErrors.last_name}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={account.email} disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className={inputClass(infoFieldErrors, "phone")} placeholder="+54 11 1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                className={inputClass(infoFieldErrors, "date_of_birth")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className={inputClass(infoFieldErrors, "gender") + " bg-white"}>
                <option value="">Seleccionar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <button type="submit" disabled={infoLoading}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
              {infoLoading ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Cambiar Contraseña</h3>
          {pwMsg && <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm mb-3">{pwMsg}</div>}
          {pwError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{pwError}</div>}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
              <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Contraseña actual" className={inputClass(pwFieldErrors, "current_password") + " pr-12"} />
              {pwFieldErrors.current_password && <p className="text-red-500 text-xs mt-1">{pwFieldErrors.current_password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" className={inputClass(pwFieldErrors, "new_password") + " pr-12"} />
              {pwFieldErrors.new_password && <p className="text-red-500 text-xs mt-1">{pwFieldErrors.new_password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
              <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetí la nueva contraseña" className={inputClass(pwFieldErrors, "confirm") + " pr-12"} />
              {pwFieldErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwFieldErrors.confirm}</p>}
            </div>
            <button type="submit" disabled={pwLoading}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
              {pwLoading ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

        {/* Linked Doctors (patients only) */}
        {account.role === "patient" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Mis Doctores</h3>
            {doctors.length === 0 ? (
              <p className="text-gray-400 text-sm">No estás vinculado con ningún doctor</p>
            ) : (
              <div className="space-y-3">
                {doctors.map(d => {
                  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.email.split("@")[0];
                  return (
                    <div key={d.assignment_id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Dr. {name}</p>
                        <p className="text-xs text-gray-400">{d.email}</p>
                        <p className="text-xs text-gray-400">Vinculado: {new Date(d.assigned_at).toLocaleDateString("es-AR")}</p>
                      </div>
                      <button
                        onClick={() => handleUnlink(d.assignment_id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >Desvincular</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
