"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/logout";
import HamburgerMenu from "@/components/HamburgerMenu";
import DateInput from "@/components/DateInput";

interface User { id: number; email: string; role: string; created_at: string }
interface Assignment { id: number; doctor_email: string; patient_email: string; status: string; assigned_at: string; doctor_user_id: number; patient_id: number }
interface StudyPatient { patient_id: number; first_name: string; last_name: string; email: string; date_of_birth: string | null }
interface Participant { id: number; patient_id: number; participant_code: string; arm: string; enrolled_at: string; withdrawn_at: string | null; withdrawal_reason: string | null; first_name: string; last_name: string; email: string; consent_version: string; baseline_hba1c: number | null }
interface ScreeningEntry { id: number; patient_id: number | null; eligible: boolean; reason: string | null; screened_at: string; screener_first_name: string; screener_last_name: string; patient_first_name: string | null; patient_last_name: string | null }
interface AuditEntry { id: number; old_arm: string | null; new_arm: string; changed_at: string; reason: string; first_name: string; last_name: string }
interface FeatureFlag { key: string; label: string; description: string | null; intervention: boolean; control: boolean }
interface FlagAuditEntry { id: number; flag_key: string; arm: string; old_value: boolean | null; new_value: boolean; changed_at: string; reason: string | null; first_name: string; last_name: string; email: string }
interface InactiveParticipant { participant_code: string; arm: string; first_name: string; last_name: string; last_activity: string | null }
interface EnrollmentMonth { month: string; enrolled: number; intervention: number; control: number }
interface DashboardData { total: number; interventionActive: number; controlActive: number; withdrawn: number; inactive: InactiveParticipant[]; enrollmentProgress: EnrollmentMonth[] }
interface TelemetryOverview { totalSent: number; totalDelivered: number; totalRead: number; totalActedUpon: number; deliveryRate: number; readRate: number; responseRate: number; byChannel: { channel: string; sent: number; delivered: number; read: number }[]; byTemplate: { template_key: string; count: number }[] }
interface TemplateGroup { key: string; channel: string; category: string; latest_version: number; active: boolean; approved_at: string | null; wa_status: string | null; template_id: number }
interface TemplateVersion { id: number; key: string; version: number; channel: string; category: string; locale: string; body: string; variables: string[]; wa_template_name: string | null; wa_status: string | null; wa_approved_at: string | null; wa_rejection_reason: string | null; approved_by_doctor: number | null; approved_at: string | null; active: boolean; created_at: string }

type Tab = "users" | "study" | "messages";

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
  const [enrollArm, setEnrollArm] = useState<"intervention" | "control" | "">("");
  const [enrollConsentVersion, setEnrollConsentVersion] = useState("");
  const [enrollConsentDate, setEnrollConsentDate] = useState("");
  const [enrollHba1c, setEnrollHba1c] = useState("");
  const [enrollResult, setEnrollResult] = useState<{ participant_code: string; arm: string; allocation_method: string } | null>(null);
  const [enrollError, setEnrollError] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [flagAudit, setFlagAudit] = useState<FlagAuditEntry[]>([]);
  const [flagToggleReason, setFlagToggleReason] = useState("");
  const [flagToggleTarget, setFlagToggleTarget] = useState<{ key: string; arm: string; enabled: boolean } | null>(null);
  const [flagMsg, setFlagMsg] = useState("");
  const [flagError, setFlagError] = useState("");

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryOverview | null>(null);

  // ---- Messages tab state ----
  const [templates, setTemplates] = useState<TemplateGroup[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null); // key+channel
  const [templateVersions, setTemplateVersions] = useState<TemplateVersion[]>([]);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTplKey, setNewTplKey] = useState("");
  const [newTplChannel, setNewTplChannel] = useState<"whatsapp" | "push">("whatsapp");
  const [newTplCategory, setNewTplCategory] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [newTplVariables, setNewTplVariables] = useState("");
  const [tplMsg, setTplMsg] = useState("");
  const [tplError, setTplError] = useState("");
  const [tplLoading, setTplLoading] = useState(false);
  const [editingVersion, setEditingVersion] = useState<number | null>(null); // template id being used as base for new version
  const [editBody, setEditBody] = useState("");
  const [editVariables, setEditVariables] = useState("");

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

  const loadFeatureFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/flags", { credentials: "include" });
      if (res.ok) { const data = await res.json(); setFeatureFlags(data.flags || []); }
    } catch {}
  }, []);

  const loadFlagAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/flags/audit", { credentials: "include" });
      if (res.ok) { const data = await res.json(); setFlagAudit(data.audit || []); }
    } catch {}
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/dashboard", { credentials: "include" });
      if (res.ok) { const data = await res.json(); setDashboard(data); }
    } catch {}
  }, []);

  const loadTelemetry = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/study/telemetry", { credentials: "include" });
      if (res.ok) { const data = await res.json(); setTelemetry(data); }
    } catch {}
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/templates", { credentials: "include" });
      if (res.ok) { const data = await res.json(); setTemplates(data.templates || []); }
    } catch {}
  }, []);

  const loadTemplateVersions = useCallback(async (templateId: number) => {
    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, { credentials: "include" });
      if (res.ok) { const data = await res.json(); setTemplateVersions(data.versions || []); }
    } catch {}
  }, []);

  useEffect(() => { loadUsers(); loadAssignments(); }, [loadUsers, loadAssignments]);

  useEffect(() => {
    if (activeTab === "study") {
      loadStudyPatients();
      loadParticipants();
      loadScreeningLog();
      loadFeatureFlags();
      loadFlagAudit();
      loadDashboard();
      loadTelemetry();
    }
  }, [activeTab, loadStudyPatients, loadParticipants, loadScreeningLog, loadFeatureFlags, loadFlagAudit, loadDashboard, loadTelemetry]);

  useEffect(() => {
    if (activeTab === "messages") { loadTemplates(); }
  }, [activeTab, loadTemplates]);

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
          ...(enrollArm ? { arm: enrollArm } : {}),
          consentVersion: enrollConsentVersion,
          consentSignedAt: enrollConsentDate,
          ...(enrollHba1c ? { baselineHba1c: parseFloat(enrollHba1c) } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollResult({
          participant_code: data.participant.participant_code,
          arm: data.participant.arm,
          allocation_method: data.participant.allocation_method,
        });
        setEnrollPatientId(""); setEnrollArm(""); setEnrollConsentVersion(""); setEnrollConsentDate(""); setEnrollHba1c("");
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

  async function handleToggleFlag() {
    if (!flagToggleTarget) return;
    setFlagMsg(""); setFlagError("");
    try {
      const res = await fetch("/api/admin/study/flags", {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagKey: flagToggleTarget.key,
          arm: flagToggleTarget.arm,
          enabled: flagToggleTarget.enabled,
          reason: flagToggleReason || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlagMsg("Configuración actualizada");
        setFlagToggleTarget(null);
        setFlagToggleReason("");
        loadFeatureFlags();
        loadFlagAudit();
      } else {
        setFlagError(data.error || "Error");
      }
    } catch { setFlagError("Error de conexion"); }
  }

  // ---- Messages tab actions ----
  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setTplLoading(true); setTplMsg(""); setTplError("");
    try {
      const variables = newTplVariables.trim() ? newTplVariables.split(",").map(v => v.trim()).filter(Boolean) : [];
      const res = await fetch("/api/admin/templates", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newTplKey, channel: newTplChannel, category: newTplCategory, body: newTplBody, variables }),
      });
      const data = await res.json();
      if (res.ok) {
        setTplMsg("Template creado");
        setNewTplKey(""); setNewTplChannel("whatsapp"); setNewTplCategory(""); setNewTplBody(""); setNewTplVariables("");
        setShowCreateTemplate(false);
        loadTemplates();
      } else { setTplError(data.error || "Error"); }
    } catch { setTplError("Error de conexion"); }
    finally { setTplLoading(false); }
  }

  function toggleTemplate(key: string, channel: string, templateId: number) {
    const compositeKey = `${key}::${channel}`;
    if (expandedTemplate === compositeKey) {
      setExpandedTemplate(null);
      setTemplateVersions([]);
      setEditingVersion(null);
    } else {
      setExpandedTemplate(compositeKey);
      loadTemplateVersions(templateId);
      setEditingVersion(null);
    }
    setTplMsg(""); setTplError("");
  }

  async function handleTemplateAction(templateId: number, action: string, extra?: Record<string, unknown>) {
    setTplMsg(""); setTplError("");
    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        const labels: Record<string, string> = { approve: "Template aprobado", activate: "Template activado", deactivate: "Template desactivado", update_wa_status: "Estado WA actualizado" };
        setTplMsg(labels[action] || "Actualizado");
        loadTemplates();
        // Reload versions for expanded template
        const tpl = data.template;
        if (tpl) loadTemplateVersions(tpl.id);
      } else { setTplError(data.error || "Error"); }
    } catch { setTplError("Error de conexion"); }
  }

  async function handleCreateVersion(baseTemplateId: number) {
    setTplMsg(""); setTplError("");
    try {
      const variables = editVariables.trim() ? editVariables.split(",").map(v => v.trim()).filter(Boolean) : [];
      const res = await fetch(`/api/admin/templates/${baseTemplateId}/version`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody, variables }),
      });
      const data = await res.json();
      if (res.ok) {
        setTplMsg(`Version ${data.template.version} creada`);
        setEditingVersion(null);
        setEditBody(""); setEditVariables("");
        loadTemplates();
        loadTemplateVersions(data.template.id);
      } else { setTplError(data.error || "Error"); }
    } catch { setTplError("Error de conexion"); }
  }

  function startEditVersion(tpl: TemplateVersion) {
    setEditingVersion(tpl.id);
    setEditBody(tpl.body);
    setEditVariables(Array.isArray(tpl.variables) ? tpl.variables.join(", ") : "");
  }

  const waStatusBadge = (status: string | null) => {
    const map: Record<string, { label: string; color: string }> = {
      draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
      submitted: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
      approved: { label: "Aprobado", color: "bg-green-100 text-green-700" },
      rejected: { label: "Rechazado", color: "bg-red-100 text-red-700" },
    };
    const entry = map[status || "draft"] || map.draft;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.color}`}>{entry.label}</span>;
  };

  function highlightVariables(body: string) {
    return body.replace(/\{\{(\w+)\}\}/g, '<span class="bg-yellow-100 text-yellow-800 px-1 rounded font-mono text-xs">{{$1}}</span>');
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
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${activeTab === "messages" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Mensajes
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
            {/* Study Dashboard */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Panel del estudio</h3>
              {dashboard ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{dashboard.total}</p>
                      <p className="text-xs text-gray-500 mt-1">Total inscriptos</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">{dashboard.interventionActive}</p>
                      <p className="text-xs text-blue-600 mt-1">Intervención</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{dashboard.controlActive}</p>
                      <p className="text-xs text-amber-600 mt-1">Control</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-red-700">{dashboard.withdrawn}</p>
                      <p className="text-xs text-red-600 mt-1">Retirados</p>
                    </div>
                  </div>

                  {dashboard.inactive.length > 0 && (
                    <div className="border border-amber-200 rounded-xl p-4 bg-amber-50">
                      <h4 className="text-sm font-medium text-amber-800 mb-2">
                        Participantes sin actividad (7+ días)
                      </h4>
                      <div className="space-y-2">
                        {dashboard.inactive.map(p => (
                          <div key={p.participant_code} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-700">{p.participant_code}</span>
                              <span className="text-gray-700">{p.last_name}, {p.first_name}</span>
                              {armBadge(p.arm)}
                            </div>
                            <span className="text-xs text-gray-500">
                              {p.last_activity ? `Última actividad: ${fmtDate(p.last_activity)}` : "Sin actividad registrada"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dashboard.enrollmentProgress.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Progreso de inscripción por mes</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left">
                              <th className="py-2 pr-3 font-medium text-gray-600">Mes</th>
                              <th className="py-2 pr-3 font-medium text-gray-600">Total</th>
                              <th className="py-2 pr-3 font-medium text-gray-600">Intervención</th>
                              <th className="py-2 font-medium text-gray-600">Control</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.enrollmentProgress.map(m => (
                              <tr key={m.month} className="border-b border-gray-50">
                                <td className="py-2 pr-3 text-gray-800">{m.month}</td>
                                <td className="py-2 pr-3 text-gray-800">{m.enrolled}</td>
                                <td className="py-2 pr-3 text-blue-700">{m.intervention}</td>
                                <td className="py-2 text-amber-700">{m.control}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Cargando datos del estudio...</p>
              )}
            </div>

            {/* Telemetry / Mensajería */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Mensajería</h3>
              {telemetry ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{telemetry.totalSent}</p>
                      <p className="text-xs text-gray-500 mt-1">Enviados</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">{(telemetry.deliveryRate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-blue-600 mt-1">Tasa de entrega</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700">{(telemetry.readRate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-green-600 mt-1">Tasa de lectura</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-purple-700">{(telemetry.responseRate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-purple-600 mt-1">Tasa de respuesta</p>
                    </div>
                  </div>

                  {telemetry.byChannel.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Por canal</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left">
                              <th className="py-2 pr-3 font-medium text-gray-600">Canal</th>
                              <th className="py-2 pr-3 font-medium text-gray-600">Enviados</th>
                              <th className="py-2 pr-3 font-medium text-gray-600">Entregados</th>
                              <th className="py-2 font-medium text-gray-600">Leídos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {telemetry.byChannel.map(c => (
                              <tr key={c.channel} className="border-b border-gray-50">
                                <td className="py-2 pr-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.channel === "whatsapp" ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>
                                    {c.channel === "whatsapp" ? "WhatsApp" : "Push"}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-gray-800">{c.sent}</td>
                                <td className="py-2 pr-3 text-gray-800">{c.delivered}</td>
                                <td className="py-2 text-gray-800">{c.read}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Cargando datos de mensajería...</p>
              )}
            </div>

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
                  {" | "}Brazo: <span className="font-medium">{enrollResult.arm === "intervention" ? "Intervención" : "Control"}</span>
                  {" | "}Método: <span className="font-medium">{enrollResult.allocation_method === "alternating" ? "Automático (alternado)" : "Manual"}</span>
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
                    <div>
                      <select value={enrollArm} onChange={e => setEnrollArm(e.target.value as "intervention" | "control" | "")}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white w-full">
                        <option value="">Automático (alternado)</option>
                        <option value="intervention">Intervención</option>
                        <option value="control">Control</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Dejar vacío para asignación automática (alternada)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" value={enrollConsentVersion} onChange={e => setEnrollConsentVersion(e.target.value)}
                      placeholder="Versión de consentimiento" required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                    <DateInput value={enrollConsentDate} onChange={setEnrollConsentDate}
                      required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white cursor-pointer" />
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

            {/* Feature Flags */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Configuración de funcionalidades</h3>
              {flagMsg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm mb-3">{flagMsg}</div>}
              {flagError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{flagError}</div>}
              {featureFlags.length === 0 ? (
                <p className="text-sm text-gray-500">No hay funcionalidades configuradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-3 font-medium text-gray-600">Funcionalidad</th>
                        <th className="py-2 pr-3 font-medium text-gray-600 text-center">Intervención</th>
                        <th className="py-2 font-medium text-gray-600 text-center">Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureFlags.map(flag => (
                        <tr key={flag.key} className="border-b border-gray-50">
                          <td className="py-3 pr-3">
                            <div className="font-medium text-gray-800">{flag.label}</div>
                            {flag.description && <div className="text-xs text-gray-500">{flag.description}</div>}
                          </td>
                          <td className="py-3 pr-3 text-center">
                            <button
                              onClick={() => {
                                if (flagToggleTarget?.key === flag.key && flagToggleTarget?.arm === "intervention") {
                                  setFlagToggleTarget(null); setFlagToggleReason("");
                                } else {
                                  setFlagToggleTarget({ key: flag.key, arm: "intervention", enabled: !flag.intervention });
                                  setFlagToggleReason("");
                                  setFlagMsg(""); setFlagError("");
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                flag.intervention
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${flag.intervention ? "bg-green-500" : "bg-gray-400"}`} />
                              {flag.intervention ? "Activo" : "Inactivo"}
                            </button>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => {
                                if (flagToggleTarget?.key === flag.key && flagToggleTarget?.arm === "control") {
                                  setFlagToggleTarget(null); setFlagToggleReason("");
                                } else {
                                  setFlagToggleTarget({ key: flag.key, arm: "control", enabled: !flag.control });
                                  setFlagToggleReason("");
                                  setFlagMsg(""); setFlagError("");
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                flag.control
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${flag.control ? "bg-green-500" : "bg-gray-400"}`} />
                              {flag.control ? "Activo" : "Inactivo"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Toggle confirmation with reason */}
              {flagToggleTarget && (
                <div className="mt-4 p-4 border border-blue-200 rounded-xl bg-blue-50">
                  <p className="text-sm text-blue-800 mb-2">
                    {flagToggleTarget.enabled ? "Activar" : "Desactivar"}{" "}
                    <span className="font-medium">{featureFlags.find(f => f.key === flagToggleTarget.key)?.label || flagToggleTarget.key}</span>{" "}
                    para <span className="font-medium">{flagToggleTarget.arm === "intervention" ? "Intervención" : "Control"}</span>
                  </p>
                  <div className="flex gap-2 items-end">
                    <input
                      type="text"
                      value={flagToggleReason}
                      onChange={e => setFlagToggleReason(e.target.value)}
                      placeholder="Razón del cambio (requerida)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleToggleFlag}
                      disabled={!flagToggleReason.trim()}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => { setFlagToggleTarget(null); setFlagToggleReason(""); }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Flag Audit History */}
              {flagAudit.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Historial de cambios</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {flagAudit.map(a => (
                      <div key={a.id} className="text-xs text-gray-600 flex flex-wrap gap-2 py-1 border-b border-gray-50">
                        <span className="text-gray-400">{fmtDate(a.changed_at)}</span>
                        <span className="font-medium">{a.flag_key}</span>
                        <span>({a.arm === "intervention" ? "Intervención" : "Control"})</span>
                        <span>{a.old_value === null ? "—" : a.old_value ? "Activo" : "Inactivo"} → {a.new_value ? "Activo" : "Inactivo"}</span>
                        {a.reason && <span className="text-gray-400">({a.reason})</span>}
                        <span className="text-gray-400">por {a.first_name} {a.last_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {activeTab === "messages" && (
          <>
            {/* Messages header & feedback */}
            {tplMsg && <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm">{tplMsg}</div>}
            {tplError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{tplError}</div>}

            {/* Create Template */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Plantillas de Mensajes ({templates.length})</h3>
                <button
                  onClick={() => setShowCreateTemplate(!showCreateTemplate)}
                  className="text-sm px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition"
                >
                  {showCreateTemplate ? "Cancelar" : "Crear plantilla"}
                </button>
              </div>

              {showCreateTemplate && (
                <form onSubmit={createTemplate} className="space-y-3 mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" value={newTplKey} onChange={e => setNewTplKey(e.target.value)}
                      placeholder="Key (ej: reminder_checkup)" required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                    <select value={newTplChannel} onChange={e => setNewTplChannel(e.target.value as "whatsapp" | "push")}
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="push">Push</option>
                    </select>
                    <input type="text" value={newTplCategory} onChange={e => setNewTplCategory(e.target.value)}
                      placeholder="Categoría (ej: recordatorio)" required
                      className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <textarea value={newTplBody} onChange={e => setNewTplBody(e.target.value)}
                    placeholder="Cuerpo del mensaje. Usa {{variable}} para placeholders."
                    required rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="text" value={newTplVariables} onChange={e => setNewTplVariables(e.target.value)}
                    placeholder="Variables (separadas por coma, ej: nombre, fecha)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="submit" disabled={tplLoading}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">
                    {tplLoading ? "Creando..." : "Crear plantilla"}
                  </button>
                </form>
              )}

              {/* Template list */}
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500">No hay plantillas creadas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-3 font-medium text-gray-600">Key</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Canal</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Versión</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Estado</th>
                        <th className="py-2 pr-3 font-medium text-gray-600">Aprobación</th>
                        <th className="py-2 font-medium text-gray-600">WA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(t => {
                        const compositeKey = `${t.key}::${t.channel}`;
                        const isExpanded = expandedTemplate === compositeKey;
                        return (
                          <tr key={compositeKey}
                            onClick={() => toggleTemplate(t.key, t.channel, t.template_id)}
                            className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${isExpanded ? "bg-gray-50" : ""}`}>
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 text-gray-400 transition ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                <span className="font-mono font-medium text-gray-800">{t.key}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.channel === "whatsapp" ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>
                                {t.channel === "whatsapp" ? "WhatsApp" : "Push"}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-gray-600">v{t.latest_version}</td>
                            <td className="py-3 pr-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {t.active ? "Activa" : "Inactiva"}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              {t.approved_at
                                ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Aprobada</span>
                                : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pendiente</span>}
                            </td>
                            <td className="py-3">
                              {t.channel === "whatsapp" ? waStatusBadge(t.wa_status) : <span className="text-xs text-gray-400">N/A</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expanded template detail */}
            {expandedTemplate && templateVersions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">
                    Versiones de <span className="font-mono">{templateVersions[0].key}</span>
                    <span className="ml-2 text-sm font-normal text-gray-500">({templateVersions[0].channel === "whatsapp" ? "WhatsApp" : "Push"})</span>
                  </h3>
                </div>
                <div className="space-y-4">
                  {templateVersions.map(v => (
                    <div key={v.id} className={`border rounded-xl p-4 ${v.active ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">v{v.version}</span>
                          {v.active && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activa</span>}
                          {v.approved_at
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Aprobada</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Sin aprobar</span>}
                          {v.channel === "whatsapp" && waStatusBadge(v.wa_status)}
                        </div>
                        <span className="text-xs text-gray-400">{fmtDate(v.created_at)}</span>
                      </div>

                      {/* Body preview with highlighted variables */}
                      <div className="bg-white border border-gray-100 rounded-lg p-3 mb-3 text-sm text-gray-700"
                        dangerouslySetInnerHTML={{ __html: highlightVariables(v.body) }} />

                      {Array.isArray(v.variables) && v.variables.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs text-gray-500 mr-2">Variables:</span>
                          {v.variables.map((varName: string) => (
                            <span key={varName} className="inline-block bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs font-mono mr-1">{varName}</span>
                          ))}
                        </div>
                      )}

                      {v.wa_rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-700">
                          Razón de rechazo: {v.wa_rejection_reason}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {!v.approved_at && (
                          <button onClick={() => handleTemplateAction(v.id, "approve")}
                            className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition">
                            Aprobar
                          </button>
                        )}
                        {!v.active && v.approved_at && (v.channel !== "whatsapp" || v.wa_status === "approved") && (
                          <button onClick={() => handleTemplateAction(v.id, "activate")}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                            Activar
                          </button>
                        )}
                        {v.active && (
                          <button onClick={() => handleTemplateAction(v.id, "deactivate")}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                            Desactivar
                          </button>
                        )}
                        <button onClick={() => startEditVersion(v)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition">
                          Nueva versión
                        </button>
                        {v.channel === "whatsapp" && (
                          <>
                            {v.wa_status !== "approved" && (
                              <button onClick={() => handleTemplateAction(v.id, "update_wa_status", { status: "submitted" })}
                                className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                                Marcar enviado a Meta
                              </button>
                            )}
                            {v.wa_status === "submitted" && (
                              <>
                                <button onClick={() => handleTemplateAction(v.id, "update_wa_status", { status: "approved" })}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition">
                                  Marcar aprobado por Meta
                                </button>
                                <button onClick={() => {
                                  const reason = prompt("Razón de rechazo:");
                                  if (reason) handleTemplateAction(v.id, "update_wa_status", { status: "rejected", rejectionReason: reason });
                                }}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                                  Marcar rechazado
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* New version form */}
                      {editingVersion === v.id && (
                        <div className="mt-4 p-4 border border-purple-200 rounded-xl bg-purple-50 space-y-3">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                            Esto creará la versión {v.version + 1}. El cambio será reportable como desviación del protocolo.
                          </div>
                          <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                            rows={3} placeholder="Cuerpo del mensaje"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                          <input type="text" value={editVariables} onChange={e => setEditVariables(e.target.value)}
                            placeholder="Variables (separadas por coma)"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                          <div className="flex gap-2">
                            <button onClick={() => handleCreateVersion(v.id)}
                              disabled={!editBody.trim()}
                              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition">
                              Crear versión {v.version + 1}
                            </button>
                            <button onClick={() => { setEditingVersion(null); setEditBody(""); setEditVariables(""); }}
                              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
