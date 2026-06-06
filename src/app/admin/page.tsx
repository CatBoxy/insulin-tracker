"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/logout";

interface User { id: number; email: string; role: string; created_at: string }
interface Assignment { id: number; doctor_email: string; patient_email: string; status: string; assigned_at: string; doctor_user_id: number; patient_id: number }

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignDoctor, setAssignDoctor] = useState("");
  const [assignPatient, setAssignPatient] = useState("");
  const [assignMsg, setAssignMsg] = useState("");
  const [assignError, setAssignError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", {credentials:"include"});
      if (res.status === 403 || res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setUsers(data.users || []);
    } catch { router.push("/login"); }
  }, [router]);

  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assign", {credentials:"include"});
      if (res.ok) { const data = await res.json(); setAssignments(data.assignments || []); }
    } catch {}
  }, []);

  useEffect(() => { loadUsers(); loadAssignments(); }, [loadUsers, loadAssignments]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(""); setError("");
    try {
      const res = await fetch("/api/admin/users", {credentials:"include",
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (res.ok) { setMsg("Usuario creado"); setEmail(""); setPassword(""); loadUsers(); }
      else setError(data.error || "Error");
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const handleLogout = () => logout(router);

  async function assignPatientToDoctor(e: React.FormEvent) {
    e.preventDefault();
    setAssignMsg(""); setAssignError("");
    try {
      const res = await fetch("/api/admin/assign", {credentials:"include",
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_user_id: Number(assignDoctor), patient_id: Number(assignPatient) }),
      });
      const data = await res.json();
      if (res.ok) { setAssignMsg(data.message); loadAssignments(); }
      else setAssignError(data.error || "Error");
    } catch { setAssignError("Error de conexión"); }
  }

  async function removeAssignment(id: number) {
    try {
      await fetch("/api/admin/assign", {credentials:"include",
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      loadAssignments();
    } catch {}
  }

  const doctors = users.filter(u => u.role === "doctor");
  const patients = users.filter(u => u.role === "patient");

  const roleBadge = (r: string) => {
    const colors: Record<string, string> = { admin: "bg-purple-100 text-purple-700", doctor: "bg-blue-100 text-blue-700", patient: "bg-green-100 text-green-700" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[r] || "bg-gray-100 text-gray-700"}`}>{r}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Glycofit</h1>
              <p className="text-xs text-gray-500">Panel de Administración</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/account" className="text-sm text-gray-500 hover:text-gray-700">Mi Cuenta</a>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Salir</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Create User */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">➕ Crear Usuario</h3>
          {msg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm mb-3">{msg}</div>}
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{error}</div>}
          <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="patient">Paciente</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={loading}
              className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">
              {loading ? "Creando..." : "Crear"}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">👥 Usuarios ({users.length})</h3>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {u.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.email}</p>
                    <p className="text-xs text-gray-400">Creado: {new Date(u.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                </div>
                {roleBadge(u.role)}
              </div>
            ))}
          </div>
        </div>
        {/* Assign Patients to Doctors */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">🔗 Asignar Paciente a Doctor</h3>
          {assignMsg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm mb-3">{assignMsg}</div>}
          {assignError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{assignError}</div>}
          <form onSubmit={assignPatientToDoctor} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={assignDoctor} onChange={e => setAssignDoctor(e.target.value)} required
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Seleccionar Doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.email}</option>)}
            </select>
            <select value={assignPatient} onChange={e => setAssignPatient(e.target.value)} required
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Seleccionar Paciente</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
            </select>
            <button type="submit"
              className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium transition">
              Asignar
            </button>
          </form>
        </div>

        {/* Current Assignments */}
        {assignments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">📋 Asignaciones Activas</h3>
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} className="py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        <span className="font-medium">{a.doctor_email}</span>
                      </p>
                      <p className="text-sm text-gray-800 truncate">
                        <span className="text-gray-400 mr-1">→</span>
                        <span className="font-medium">{a.patient_email}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(a.assigned_at).toLocaleDateString("es-AR")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.status}
                      </span>
                      {a.status === "active" && (
                        <button onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600 text-xs p-1">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
