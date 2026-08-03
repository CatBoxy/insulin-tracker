"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/logout";
import HamburgerMenu from "@/components/HamburgerMenu";

interface User { id: number; email: string; role: string; created_at: string }
interface Assignment { id: number; doctor_email: string; patient_email: string; status: string; assigned_at: string; doctor_user_id: number; patient_id: number }
interface StudyPatient { patient_id: number; first_name: string; last_name: string; email: string; date_of_birth: string | null }
interface Participant { id: number; patient_id: number; participant_code: string; arm: string; enrolled_at: string; withdrawn_at: string | null; withdrawal_reason: string | null; first_name: string; last_name: string; email: string; consent_version: string; baseline_hba1c: number | null }
interface ScreeningEntry { id: number; patient_id: number | null; eligible: boolean; reason: string | null; screened_at: string; screener_first_name: string; screener_last_name: string; patient_first_name: string | null; patient_last_name: string | null }
interface AuditEntry { id: number; old_arm: string | null; new_arm: string; changed_at: string; reason: string; first_name: string; last_name: string }

type Tab = "users" | "study";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("users");

  // ---- Users tab state ----
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

  // ---- Study tab state ----
  const [studyPatients, setStudyPatients] = useState<StudyPatient[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [screeningLog, setScreeningLog] = useState<ScreeningEntry[]>([]);

  // Screening form
  const [screenPatientId, setScreenPatientId] = useState("");
  const [screenResult, setScreenResult] = useState<{ eligible: boolean; reason: string | null } | null>(null);
  const [screenError, setScreenError] = useState("");
  const [screenLoading, setScreenLoading] = useState(false);

  // Enrollment form
  const [enrollPatientId, setEnrollPatientId] = useState("");
  const [enrollArm, setEnrollArm] = useState<"intervention" | "control">("intervention");
  const [enrollConsentVersion, setEnrollConsentVersion] = useState("");
  const [enrollConsentDate, setEnrollConsentDate] = useState("");
  const [enrollHba1c, setEnrollHba1c] = useState("");
  const [enrollResult, setEnrollResult] = useState<{ participant_code: string } | null>(null);
  const [enrollError, setEnrollError] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Participant detail
  const [expandedParticipant, setExpandedParticipant] = useState<number | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
  const [armChangeParticipant, setArmChangeParticipant] = useState<number | null>(null);
  const [armChangeNewArm, setArmChangeNewArm] = useState<"intervention" | "control">("intervention");
  const [armChangeReason, setArmChangeReason] = useState("");
  const [withdrawParticipant, setWithdrawParticipant] = useState<number | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [participantMsg, setParticipantMsg] = useState("");
  const [participantError, setParticipantError] = useState("");

  // ---- Data loading ----
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

  const loadStudyPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/patients", {credentials:"include"});
      if (res.ok) { const data = await res.json(); setStudyPatients(data.patients || []); }
    } catch {}
  }, []);

  const loadParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/participants", {credentials:"include"});
      if (res.ok) { const data = await res.json(); setParticipants(data.participants || []); }
    } catch {}
  }, []);

  const loadScreeningLog = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/screening", {credentials:"include"});
      if (res.ok) { const data = await res.json(); setScreeningLog(data.screenings || []); }
    } catch {}
  }, []);

  useEffect(() => { loadUsers(); loadAssignments(); }, [loadUsers, loadAssignments]);

  useEffect(() => {
    if (activeTab === "study") {
      loadStudyPatients();
      loadParticipants();
      loadScreeningLog();
    }
  }, [activeTab, loadStudyPatients, loadParticipants, loadScreeningLog]);

  // ---- Users tab actions ----
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
    } catch { setError("Error de conexion"); }
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
    } catch { setAssignError("Error de conexion"); }
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

  // ---- Study tab actions ----
  async function screenPatient(e: React.FormEvent) {
    e.preventDefault();
    setScreenLoading(true); setScreenResult(null); setScreenError("");
    try {
      const res = await fetch("/api/admin/study/screen", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: Number(screenPatientId), eligible: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setScreenResult({ eligible: data.eligible, reason: data.reason });
        loadScreeningLog();
      } else {
        setScreenError(data.error || "Error");
      }
    } catch { setScreenError("Error de conexion"); }
    finally { setScreenLoading(false); }
  }

  async function enrollPatient(e: React.FormEvent) {
    e.preventDefault();
    setEnrollLoading(true); setEnrollResult(null); setEnrollError("");
    try {
      const res = await fetch("/api/admin/study/enroll", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(enrollPatientId),
          arm: enrollArm,
          consentVersion: enrollConsentVersion,
          consentSignedAt: enrollConsentDate,
          ...(enrollHba1c ? { baselineHba1c: parseFloat(enrollHba1c) } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollResult({ participant_code: data.participant.participant_code });
        setEnrollPatientId(""); setEnrollConsentVersion(""); setEnrollConsentDate(""); setEnrollHba1c("");
        loadParticipants();
      } else {
        setEnrollError(data.error || "Error");
      }
    } catch { setEnrollError("Error de conexion"); }
    finally { setEnrollLoading(false); }
  }

  async function loadAuditHistory(participantId: number) {
    try {
      const res = await fetch(`/api/admin/study/participants/${participantId}`, { credentials: "include" });
      if (res.ok) { const data = await res.json(); setAuditHistory(data.auditHistory || []); }
    } catch {}
  }

  function toggleParticipant(id: number) {
    if (expandedParticipant === id) {
      setExpandedParticipant(null);
      setAuditHistory([]);
    } else {
      setExpandedParticipant(id);
      loadAuditHistory(id);
    }
    setArmChangeParticipant(null);
    setWithdrawParticipant(null);
    setParticipantMsg("");
    setParticipantError("");
  }

  async function handleChangeArm(participantId: number) {
    setParticipantMsg(""); setParticipantError("");
    try {
      const res = await fetch(`/api/admin/study/participants/${participantId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_arm", newArm: armChangeNewArm, reason: armChangeReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setParticipantMsg("Brazo actualizado");
        setArmChangeParticipant(null);
        setArmChangeReason("");
        loadParticipants();
        loadAuditHistory(participantId);
      } else {
        setParticipantError(data.error || "Error");
      }
    } catch { setParticipantError("Error de conexion"); }
  }

  async function handleWithdraw(participantId: number) {
    setParticipantMsg(""); setParticipantError("");
    try {
      const res = await fetch(`/api/admin/study/participants/${participantId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", reason: withdrawReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setParticipantMsg("Participante retirado del estudio");
        setWithdrawParticipant(null);
        setWithdrawReason("");
        loadParticipants();
      } else {
        setParticipantError(data.error || "Error");
      }
    } catch { setParticipantError("Error de conexion"); }
  }

  const doctors = users.filter(u => u.role === "doctor");
  const patients = users.filter(u => u.role === "patient");

  // Find eligible patients that haven't been enrolled yet
  const enrolledPatientIds = new Set(participants.map(p => p.patient_id));
  const eligiblePatientIds = new Set(
    screeningLog.filter(s => s.eligible).map(s => s.patient_id)
  );
  const enrollablePatients = studyPatients.filter(
    p => eligiblePatientIds.has(p.patient_id) && !enrolledPatientIds.has(p.patient_id)
  );

  const roleBadge = (r: string) => {
    const colors: Record<string, string> = { admin: "bg-purple-100 text-purple-700", doctor: "bg-blue-100 text-blue-700", patient: "bg-green-100 text-green-700" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[r] || "bg-gray-100 text-gray-700"}`}>{r}</span>;
  };

  const armBadge = (arm: string) => {
    const color = arm === "intervention" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
    const label = arm === "intervention" ? "Intervención" : "Control";
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
  };

  const statusBadge = (p: Participant) => {
    if (p.withdrawn_at) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Retirado</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" });

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
          <div className="hidden md:flex items-center gap-4">
            <a href="/account" className="text-sm text-gray-500 hover:text-gray-700">Mi Cuenta</a>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Salir</button>
          </div>
          <div className="md:hidden">
            <HamburgerMenu items={[
              { label: "Mi Cuenta", href: "/account" },
              { label: "Salir", onClick: handleLogout },
            ]} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${activeTab === "users" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab("study")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${activeTab === "study" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Estudio
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {activeTab === "users" && (
          <>
            {/* Create User */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Crear Usuario</h3>
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
              <h3 className="font-semibold text-gray-800 mb-4">Usuarios ({users.length})</h3>
              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.email}</p>
                        <p className="text-xs text-gray-400">Creado: {fmtDate(u.created_at)}</p>
                      </div>
                    </div>
                    {roleBadge(u.role)}
                  </div>
                ))}
              </div>
            </div>

            {/* Assign Patients to Doctors */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Asignar Paciente a Doctor</h3>
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
                <h3 className="font-semibold text-gray-800 mb-4">Asignaciones Activas</h3>
                <div className="space-y-3">
                  {assignments.map(a => (
                    <div key={a.id} className="py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">
                            <span className="font-medium">{a.doctor_email}</span>
                          </p>
                          <p className="text-sm text-gray-800 truncate">
                            <span className="text-gray-400 mr-1">&rarr;</span>
                            <span className="font-medium">{a.patient_email}</span>
                          </p>
                          <p className="text-xs text-gray-400">{fmtDate(a.assigned_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {a.status}
                          </span>
                          {a.status === "active" && (
                            <button onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600 text-xs p-1">&times;</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "study" && (
          <>
            {/* Screening Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Evaluar Elegibilidad</h3>
              {screenError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{screenError}</div>}
              {screenResult && (
                <div className={`p-3 rounded-xl text-sm mb-3 ${screenResult.eligible ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {screenResult.eligible
                    ? "Elegible para el estudio"
                    : `No elegible: ${screenResult.reason || "razón no especificada"}`}
                </div>
              )}
              <form onSubmit={screenPatient} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={screenPatientId} onChange={e => setScreenPatientId(e.target.value)} required
                  className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white md:col-span-2">
                  <option value="">Seleccionar Paciente</option>
                  {studyPatients.map(p => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.last_name}, {p.first_name} ({p.email})
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={screenLoading}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">
                  {screenLoading ? "Evaluando..." : "Evaluar elegibilidad"}
                </button>
              </form>
            </div>

            {/* Enrollment Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Inscribir Participante</h3>
              {enrollError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{enrollError}</div>}
              {enrollResult && (
                <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm mb-3">
                  Participante inscrito. Código: <span className="font-mono font-bold">{enrollResult.participant_code}</span>
                </div>
              )}
              {enrollablePatients.length === 0 ? (
                <p className="text-sm text-gray-500">No hay pacientes elegibles pendientes de inscripción. Evalúe la elegibilidad primero.</p>
              ) : (
                <form onSubmit={enrollPatient} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select value={enrollPatientId} onChange={e => setEnrollPatientId(e.target.value)} required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                      <option value="">Seleccionar Paciente Elegible</option>
                      {enrollablePatients.map(p => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.last_name}, {p.first_name}
                        </option>
                      ))}
                    </select>
                    <select value={enrollArm} onChange={e => setEnrollArm(e.target.value as "intervention" | "control")}
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                      <option value="intervention">Intervención</option>
                      <option value="control">Control</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" value={enrollConsentVersion} onChange={e => setEnrollConsentVersion(e.target.value)}
                      placeholder="Versión de consentimiento" required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="date" value={enrollConsentDate} onChange={e => setEnrollConsentDate(e.target.value)}
                      required title="Fecha de firma del consentimiento"
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="number" value={enrollHba1c} onChange={e => setEnrollHba1c(e.target.value)}
                      placeholder="HbA1c basal (opcional)" step="0.1" min="0" max="20"
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <button type="submit" disabled={enrollLoading}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">
                    {enrollLoading ? "Inscribiendo..." : "Inscribir"}
                  </button>
                </form>
              )}
            </div>

            {/* Participants List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Participantes ({participants.length})</h3>
              {participantMsg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm mb-3">{participantMsg}</div>}
              {participantError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{participantError}</div>}
              {participants.length === 0 ? (
                <p className="text-sm text-gray-500">No hay participantes inscriptos aún.</p>
              ) : (
                <div className="space-y-3">
                  {participants.map(p => (
                    <div key={p.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleParticipant(p.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-sm font-bold text-primary-600">{p.participant_code}</span>
                          <span className="text-sm text-gray-800 truncate">{p.last_name}, {p.first_name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {armBadge(p.arm)}
                          {statusBadge(p)}
                          <span className="text-xs text-gray-400">{fmtDate(p.enrolled_at)}</span>
                          <svg className={`w-4 h-4 text-gray-400 transition ${expandedParticipant === p.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>

                      {expandedParticipant === p.id && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                          {/* Participant details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div><span className="text-gray-500">Email:</span> <span className="text-gray-800">{p.email}</span></div>
                            <div><span className="text-gray-500">Consentimiento:</span> <span className="text-gray-800">{p.consent_version}</span></div>
                            {p.baseline_hba1c && <div><span className="text-gray-500">HbA1c basal:</span> <span className="text-gray-800">{p.baseline_hba1c}%</span></div>}
                            {p.withdrawn_at && <div><span className="text-gray-500">Retirado:</span> <span className="text-gray-800">{fmtDate(p.withdrawn_at)}</span></div>}
                            {p.withdrawal_reason && <div className="col-span-2"><span className="text-gray-500">Razón retiro:</span> <span className="text-gray-800">{p.withdrawal_reason}</span></div>}
                          </div>

                          {/* Audit History */}
                          {auditHistory.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Historial de cambios de brazo</h4>
                              <div className="space-y-1">
                                {auditHistory.map(a => (
                                  <div key={a.id} className="text-xs text-gray-600 flex gap-2">
                                    <span className="text-gray-400">{fmtDate(a.changed_at)}</span>
                                    <span>{a.old_arm ? `${a.old_arm === "intervention" ? "Intervención" : "Control"} →` : ""} {a.new_arm === "intervention" ? "Intervención" : "Control"}</span>
                                    <span className="text-gray-400">({a.reason})</span>
                                    <span className="text-gray-400">por {a.first_name} {a.last_name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {!p.withdrawn_at && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setArmChangeParticipant(armChangeParticipant === p.id ? null : p.id); setWithdrawParticipant(null); }}
                                className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                              >
                                Cambiar brazo
                              </button>
                              <button
                                onClick={() => { setWithdrawParticipant(withdrawParticipant === p.id ? null : p.id); setArmChangeParticipant(null); }}
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                              >
                                Retirar del estudio
                              </button>
                            </div>
                          )}

                          {/* Change Arm Form */}
                          {armChangeParticipant === p.id && (
                            <div className="flex gap-2 items-end">
                              <select value={armChangeNewArm} onChange={e => setArmChangeNewArm(e.target.value as "intervention" | "control")}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                                <option value="intervention">Intervención</option>
                                <option value="control">Control</option>
                              </select>
                              <input type="text" value={armChangeReason} onChange={e => setArmChangeReason(e.target.value)}
                                placeholder="Razón del cambio" required
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                              <button onClick={() => handleChangeArm(p.id)} disabled={!armChangeReason}
                                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition">
                                Confirmar
                              </button>
                            </div>
                          )}

                          {/* Withdraw Form */}
                          {withdrawParticipant === p.id && (
                            <div className="flex gap-2 items-end">
                              <input type="text" value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}
                                placeholder="Razón del retiro" required
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                              <button onClick={() => handleWithdraw(p.id)} disabled={!withdrawReason}
                                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition">
                                Confirmar retiro
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Screening Log */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Registro de Evaluaciones ({screeningLog.length})</h3>
              {screeningLog.length === 0 ? (
                <p className="text-sm text-gray-500">No hay evaluaciones registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-3 font-medium text-gray-600">Fecha</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Paciente</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Resultado</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Razón</th>
                        <th className="py-2 font-medium text-gray-600">Evaluador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {screeningLog.map(s => (
                        <tr key={s.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 text-gray-600">{fmtDate(s.screened_at)}</td>
                          <td className="py-2 pr-3 text-gray-800">
                            {s.patient_first_name ? `${s.patient_last_name}, ${s.patient_first_name}` : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.eligible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {s.eligible ? "Elegible" : "No elegible"}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{s.reason || "—"}</td>
                          <td className="py-2 text-gray-600">{s.screener_first_name} {s.screener_last_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
