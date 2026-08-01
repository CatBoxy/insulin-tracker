"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getGlucemiaStatus, getSystolicStatus, type VitalStatus } from "@/lib/thresholds";
import CheckupStatusBadge from "@/components/checkups/CheckupStatusBadge";

const CONDITION_LABELS: Record<string, string> = {
  cancer: "Cáncer",
  hipertension: "Hipertensión",
  diabetes: "Diabetes",
  problemas_cardiacos: "Problemas cardíacos",
  problemas_renales: "Problemas renales",
  tiroides: "Tiroides",
  problemas_hepaticos: "Problemas hepáticos",
  alergia_medicamentos: "Alergia a medicamentos",
  otros: "Otros",
};

const statusBadge: Record<VitalStatus, string> = {
  normal: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
  emergency: "bg-red-200 text-red-900",
};

function parseDiastolic(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/diastolic:(\d+)/);
  return m ? parseInt(m[1]) : null;
}

interface Measurement {
  id: number;
  type: string;
  value: number;
  unit: string;
  context: string | null;
  notes: string | null;
  recorded_at: string;
}

interface Alert {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

interface PatientInfo {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  allergies: string | null;
}

interface Prescription {
  id: number;
  status: string;
  notes: string | null;
  created_at: string;
  signed_at: string | null;
  expires_at: string | null;
}

interface Appointment {
  id: number;
  scheduled_at: string;
  duration_minutes: number;
  type: string;
  status: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"vitals" | "alerts" | "prescriptions" | "appointments" | "seguimiento" | "historia">("vitals");
  const [medicalHistory, setMedicalHistory] = useState<{ familyHistory: Array<{ condition: string; has_condition: boolean; notes: string | null }>; personalHistory: Array<{ condition: string; has_condition: boolean; notes: string | null }>; medications: Array<{ condition: string; medication_text: string }> } | null>(null);

  // Pagination & date filter for measurements
  const [measPage, setMeasPage] = useState(0);
  const [measDateFrom, setMeasDateFrom] = useState("");
  const [measDateTo, setMeasDateTo] = useState("");
  const measPerPage = 20;

  // Doctor indices
  const [indices, setIndices] = useState<Array<{ id: number; calf_circumference_cm: number | null; dynamometer_force_mmlm: number | null; chair_test_seconds: number | null; insulin_resistance_index: number | null; recorded_at: string }>>([]);
  const [indexForm, setIndexForm] = useState({ calf: "", dynamometer: "", chair: "", insulin: "" });
  const [indexSaving, setIndexSaving] = useState(false);

  // Patient body data (read-only for doctor)
  const [patientHeight, setPatientHeight] = useState<number | null>(null);
  const [patientWeights, setPatientWeights] = useState<Array<{ value: number; recorded_at: string }>>([]);
  const [patientBodyComp, setPatientBodyComp] = useState<Array<{ adipose_pct: number; muscle_pct: number; recorded_at: string }>>([]);

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("09:00");
  const [apptDuration, setApptDuration] = useState("30");
  const [apptType, setApptType] = useState("in_person");
  const [apptReason, setApptReason] = useState("");
  const [apptCheckupTypeId, setApptCheckupTypeId] = useState("");
  const [checkupTypes, setCheckupTypes] = useState<Array<{ id: number; code: string; display_name_es: string }>>([]);
  const [apptMsg, setApptMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, { credentials: "include" });
      if (!res.ok) { router.push("/doctor"); return; }
      const data = await res.json();
      setPatient(data.patient);
      setMeasurements(data.measurements || []);
      setAlerts(data.alerts || []);
      setPrescriptions(data.prescriptions || []);
      setAppointments(data.appointments || []);

      // Load checkup types, medical history, indices, and body data
      const [ctRes, mhRes, idxRes, heightRes, weightRes, compRes] = await Promise.all([
        fetch("/api/checkup-types", { credentials: "include" }).catch(() => null),
        fetch(`/api/doctor/patient/${patientId}/medical-history`, { credentials: "include" }).catch(() => null),
        fetch(`/api/doctor/patient/${patientId}/indices`, { credentials: "include" }).catch(() => null),
        fetch(`/api/doctor/patient/${patientId}/height`, { credentials: "include" }).catch(() => null),
        fetch(`/api/doctor/patient/${patientId}/weights`, { credentials: "include" }).catch(() => null),
        fetch(`/api/doctor/patient/${patientId}/body-composition`, { credentials: "include" }).catch(() => null),
      ]);
      if (ctRes?.ok) {
        const ctData = await ctRes.json();
        setCheckupTypes(ctData.types || []);
      }
      if (mhRes?.ok) {
        const mhData = await mhRes.json();
        setMedicalHistory(mhData);
      }
      if (idxRes?.ok) {
        const idxData = await idxRes.json();
        setIndices(idxData.entries || []);
      }
      if (heightRes?.ok) {
        const h = await heightRes.json();
        setPatientHeight(h.height_cm);
      }
      if (weightRes?.ok) {
        const w = await weightRes.json();
        setPatientWeights(w.entries || []);
      }
      if (compRes?.ok) {
        const c = await compRes.json();
        setPatientBodyComp(c.entries || []);
      }
    } catch { router.push("/doctor"); }
    finally { setLoading(false); }
  }, [patientId, router]);

  useEffect(() => { load(); }, [load]);

  if (loading || !patient) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const patientName = (patient.first_name || patient.last_name)
    ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim()
    : patient.email.split("@")[0];

  const GLUCEMIA_MIN = 30;
  const GLUCEMIA_MAX = 500;
  const WINDOW_MS = 20 * 60 * 60 * 1000;

  const glucoseWindows: Array<{ timestamp: number; date: string; fasting?: number; postprandial?: number; pre_dinner?: number; outlier?: number }> = [];
  measurements
    .filter(m => m.type === "glucemia" && m.value)
    .reverse()
    .forEach(m => {
      const ts = new Date(m.recorded_at).getTime();
      const date = new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/San_Juan" });
      const isOutlier = Number(m.value) < GLUCEMIA_MIN || Number(m.value) > GLUCEMIA_MAX;

      let window = glucoseWindows.find(w => Math.abs(ts - w.timestamp) < WINDOW_MS);
      if (!window) {
        window = { timestamp: ts, date };
        glucoseWindows.push(window);
      }

      if (isOutlier) {
        window.outlier = Math.max(window.outlier ?? 0, Number(m.value));
      } else if (m.context === "random") {
        // Skip
      } else {
        const ctx = (m.context || "fasting") as "fasting" | "postprandial" | "pre_dinner";
        window[ctx] = Math.max(window[ctx] ?? 0, Number(m.value));
      }
    });

  const glucoseData = glucoseWindows.map(w => ({
    date: w.date,
    fasting: w.fasting,
    postprandial: w.postprandial,
    pre_dinner: w.pre_dinner,
    outlier: w.outlier,
  }));

  const bpData = measurements
    .filter(m => m.type === "blood_pressure")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/San_Juan" }),
      sistólica: Number(m.value),
      diastólica: parseDiastolic(m.notes) ?? 0,
    }));

  const weightData = measurements
    .filter(m => m.type === "weight")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/San_Juan" }),
      peso: Number(m.value),
    }));

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/doctor")} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="font-bold text-gray-800">{patientName}</h1>
              <p className="text-xs text-gray-500">{patient.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Patient info card */}
        {(age !== null || patient.gender || patient.blood_type || patient.allergies) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {age !== null && <div><span className="text-gray-400">Edad</span><p className="font-medium text-gray-800">{age} años</p></div>}
            {patient.gender && <div><span className="text-gray-400">Género</span><p className="font-medium text-gray-800">{patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : patient.gender}</p></div>}
            {patient.blood_type && <div><span className="text-gray-400">Grupo sanguíneo</span><p className="font-medium text-gray-800">{patient.blood_type}</p></div>}
            {patient.allergies && <div><span className="text-gray-400">Alergias</span><p className="font-medium text-gray-800">{patient.allergies}</p></div>}
          </div>
        </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["vitals", "alerts", "prescriptions", "appointments", "seguimiento", "historia"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? "bg-primary-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {t === "vitals" ? `📊 Signos Vitales` : t === "alerts" ? `⚠️ Alertas (${alerts.filter(a => !a.read).length})` : t === "prescriptions" ? `📋 Prescripciones` : t === "appointments" ? `📅 Citas (${appointments.filter(a => a.status !== "cancelled").length})` : t === "seguimiento" ? `🩺 Seguimiento` : `📄 Antecedentes Médicos`}
            </button>
          ))}
        </div>

        {tab === "vitals" && (
          <>
            {/* Glucose chart */}
            {glucoseData.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">🩸 Glucemia</h3>
                <div className="flex flex-wrap gap-3 mb-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> En ayunas</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Postprandial</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> Antes de cenar</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={glucoseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 'auto']} />
                    <Tooltip />
                    <ReferenceLine y={140} stroke="#eab308" strokeDasharray="3 3" label={{ value: "140", position: "right", fontSize: 10 }} />
                    <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" label={{ value: "70", position: "right", fontSize: 10 }} />
                    <Line type="monotone" dataKey="fasting" name="En ayunas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} connectNulls />
                    <Line type="monotone" dataKey="postprandial" name="Postprandial" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: "#f97316" }} connectNulls />
                    <Line type="monotone" dataKey="pre_dinner" name="Antes de cenar" stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: "#a855f7" }} connectNulls />
                    <Line type="monotone" dataKey="outlier" stroke="none" strokeWidth={0} dot={{ r: 5, fill: "#ef4444", stroke: "#ef4444" }} isAnimationActive={false} legendType="none" name="Outlier" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* BP chart */}
            {bpData.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">💓 Presión Arterial</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={bpData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <ReferenceLine y={130} stroke="#eab308" strokeDasharray="3 3" />
                    <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="sistólica" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="diastólica" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weight chart */}
            {weightData.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">⚖️ Peso</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="peso" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Measurement history table with pagination and date filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">📋 Historial de Mediciones</h3>
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Desde:</label>
                  <input type="date" value={measDateFrom} onChange={e => { setMeasDateFrom(e.target.value); setMeasPage(0); }}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Hasta:</label>
                  <input type="date" value={measDateTo} onChange={e => { setMeasDateTo(e.target.value); setMeasPage(0); }}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                {(measDateFrom || measDateTo) && (
                  <button onClick={() => { setMeasDateFrom(""); setMeasDateTo(""); setMeasPage(0); }}
                    className="text-xs text-primary-600 hover:underline">Limpiar filtro</button>
                )}
              </div>
              {(() => {
                const filtered = measurements.filter(m => {
                  if (measDateFrom && new Date(m.recorded_at) < new Date(measDateFrom)) return false;
                  if (measDateTo && new Date(m.recorded_at) > new Date(measDateTo + "T23:59:59")) return false;
                  return true;
                });
                const totalPages = Math.ceil(filtered.length / measPerPage);
                const page = filtered.slice(measPage * measPerPage, (measPage + 1) * measPerPage);

                return filtered.length === 0 ? <p className="text-gray-400 text-sm">Sin mediciones</p> : (
                  <>
                    <div className="space-y-2">
                      {page.map(m => {
                        const diastolic = parseDiastolic(m.notes);
                        let status: VitalStatus = "normal";
                        if (m.type === "glucemia") status = getGlucemiaStatus(Number(m.value));
                        if (m.type === "blood_pressure") status = getSystolicStatus(Number(m.value));

                        return (
                          <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl ${statusBadge[status].replace("text-", "").includes("green") ? "bg-green-50/50" : statusBadge[status].replace("text-", "").includes("yellow") ? "bg-yellow-50/50" : statusBadge[status].replace("text-", "").includes("red") ? "bg-red-50/50" : "bg-gray-50/50"}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{m.type === "glucemia" ? "\ud83e\ude78" : m.type === "blood_pressure" ? "\ud83d\udc93" : "\u2696\ufe0f"}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {m.type === "glucemia" ? `${m.value} mg/dL` : m.type === "blood_pressure" ? `${m.value}/${diastolic ?? "?"} mmHg` : `${m.value} ${m.unit}`}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {m.type === "glucemia" ? "Glucemia" : m.type === "blood_pressure" ? "Presión Arterial" : "Peso"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[status]}`}>
                                {status === "normal" ? "Normal" : status === "warning" ? "Alerta" : "Crítico"}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(m.recorded_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <button onClick={() => setMeasPage(p => Math.max(0, p - 1))} disabled={measPage === 0}
                          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
                          Anterior
                        </button>
                        <span className="text-xs text-gray-400">Página {measPage + 1} de {totalPages}</span>
                        <button onClick={() => setMeasPage(p => Math.min(totalPages - 1, p + 1))} disabled={measPage >= totalPages - 1}
                          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}

        {tab === "alerts" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">⚠️ Alertas</h3>
            {alerts.length === 0 ? <p className="text-gray-400 text-sm">Sin alertas</p> : (
              <div className="space-y-3">
                {alerts.map(a => (
                  <div key={a.id} className={`p-4 rounded-xl border ${a.severity === "critical" ? "bg-red-50 border-red-200" : a.severity === "warning" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"} ${a.read ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${a.severity === "critical" ? "text-red-700" : a.severity === "warning" ? "text-yellow-700" : "text-blue-700"}`}>
                        {a.title}
                      </p>
                      <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {a.message && <p className="text-xs text-gray-600 mt-1">{a.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "prescriptions" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">📋 Prescripciones</h3>
            {prescriptions.length === 0 ? <p className="text-gray-400 text-sm">Sin prescripciones</p> : (
              <div className="space-y-3">
                {prescriptions.map(p => (
                  <div key={p.id} className="p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })}</span>
                    </div>
                    {p.notes && <p className="text-sm text-gray-700 mt-2">{p.notes}</p>}
                    {p.expires_at && <p className="text-xs text-gray-400 mt-1">Vence: {new Date(p.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "appointments" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">📅 Citas</h3>
              <button onClick={() => setShowApptForm(!showApptForm)}
                className="text-sm bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition">
                {showApptForm ? "Cancelar" : "+ Nueva cita"}
              </button>
            </div>

            {showApptForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                    <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hora</label>
                    <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Duración (min)</label>
                    <select value={apptDuration} onChange={e => setApptDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                    <select value={apptType} onChange={e => setApptType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="in_person">Presencial</option>
                      <option value="video_call">Videollamada</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                  <input type="text" value={apptReason} onChange={e => setApptReason(e.target.value)} placeholder="Control trimestral..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                {checkupTypes.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de control (opcional)</label>
                    <select value={apptCheckupTypeId} onChange={e => setApptCheckupTypeId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Sin tipo de control</option>
                      {checkupTypes.map(ct => (
                        <option key={ct.id} value={ct.id}>{ct.display_name_es}</option>
                      ))}
                    </select>
                  </div>
                )}
                {apptMsg && <p className="text-sm text-green-600">{apptMsg}</p>}
                <button disabled={!apptDate} onClick={async () => {
                  const scheduled_at = new Date(`${apptDate}T${apptTime}`).toISOString();
                  const res = await fetch("/api/appointments", {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patient_id: Number(patientId), scheduled_at, duration_minutes: Number(apptDuration), type: apptType, reason: apptReason || null, ...(apptCheckupTypeId ? { checkup_type_id: Number(apptCheckupTypeId) } : {}) }),
                  });
                  if (res.ok) {
                    setApptMsg("Cita creada");
                    setShowApptForm(false);
                    setApptDate(""); setApptReason(""); setApptCheckupTypeId("");
                    load();
                  } else {
                    const d = await res.json();
                    setApptMsg(d.error || "Error");
                  }
                }} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition">
                  Agendar cita
                </button>
              </div>
            )}

            {appointments.length === 0 ? <p className="text-gray-400 text-sm">Sin citas</p> : (
              <div className="space-y-3">
                {appointments.map(a => {
                  const isPast = new Date(a.scheduled_at) < new Date();
                  return (
                    <div key={a.id} className={`p-4 rounded-xl border ${a.status === "cancelled" ? "border-gray-200 opacity-50" : isPast ? "border-gray-200" : "border-primary-200 bg-primary-50/30"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{a.type === "video_call" ? "📹" : "🏥"}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {new Date(a.scheduled_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })}
                              {" "}
                              {new Date(a.scheduled_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" })}
                            </p>
                            <p className="text-xs text-gray-400">{a.duration_minutes} min — {a.type === "video_call" ? "Videollamada" : "Presencial"}</p>
                            {a.reason && <p className="text-xs text-gray-500 mt-1">{a.reason}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "confirmed" ? "bg-green-100 text-green-700" : a.status === "pending" ? "bg-yellow-100 text-yellow-700" : a.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {a.status === "confirmed" ? "Confirmada" : a.status === "pending" ? "Pendiente" : a.status === "completed" ? "Completada" : "Cancelada"}
                          </span>
                          {a.status !== "cancelled" && a.status !== "completed" && (
                            <button onClick={async () => {
                              if (a.status === "pending" || a.status === "confirmed") {
                                await fetch(`/api/appointments/${a.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
                                load();
                              }
                            }} className="text-xs text-blue-600 hover:underline">Completar</button>
                          )}
                          {a.status !== "cancelled" && a.status !== "completed" && (
                            <button onClick={async () => {
                              await fetch(`/api/appointments/${a.id}`, { method: "DELETE", credentials: "include" });
                              load();
                            }} className="text-xs text-red-500 hover:underline">Cancelar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "seguimiento" && (
          <DoctorCheckupPanel patientId={patientId} onReload={load} />
        )}

        {tab === "historia" && (
          <div className="space-y-4">
            {/* Patient Body Data */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Datos Corporales del Paciente</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Altura</p>
                  <p className="text-lg font-bold text-gray-800">{patientHeight ? `${patientHeight} cm` : "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Último peso</p>
                  <p className="text-lg font-bold text-gray-800">{patientWeights[0] ? `${patientWeights[0].value} kg` : "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">IMC</p>
                  <p className="text-lg font-bold text-gray-800">
                    {patientHeight && patientWeights[0] ? (patientWeights[0].value / ((patientHeight / 100) ** 2)).toFixed(1) : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Comp. Corporal</p>
                  <p className="text-sm font-medium text-gray-800">
                    {patientBodyComp[0] ? `A:${patientBodyComp[0].adipose_pct}% M:${patientBodyComp[0].muscle_pct}%` : "—"}
                  </p>
                </div>
              </div>
              {patientWeights.length > 1 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-1">Historial de peso</p>
                  <div className="flex flex-wrap gap-2">
                    {patientWeights.slice(0, 6).map((w, i) => (
                      <span key={i} className="text-xs bg-gray-50 px-2 py-1 rounded">{w.value}kg ({new Date(w.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/San_Juan" })})</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Indices */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Índices Clínicos (Doctor)</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pantorrilla (cm)</label>
                  <input type="number" value={indexForm.calf} onChange={e => setIndexForm(f => ({ ...f, calf: e.target.value }))}
                    placeholder="31" step={0.1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dinamómetro (mmlm)</label>
                  <input type="number" value={indexForm.dynamometer} onChange={e => setIndexForm(f => ({ ...f, dynamometer: e.target.value }))}
                    placeholder="25" step={0.1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prueba de silla (seg)</label>
                  <input type="number" value={indexForm.chair} onChange={e => setIndexForm(f => ({ ...f, chair: e.target.value }))}
                    placeholder="12" step={0.1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Resist. insulina</label>
                  <input type="number" value={indexForm.insulin} onChange={e => setIndexForm(f => ({ ...f, insulin: e.target.value }))}
                    placeholder="2.5" step={0.1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <button onClick={async () => {
                if (!indexForm.calf && !indexForm.dynamometer && !indexForm.chair && !indexForm.insulin) return;
                setIndexSaving(true);
                try {
                  const res = await fetch(`/api/doctor/patient/${patientId}/indices`, {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      calf_circumference_cm: indexForm.calf ? Number(indexForm.calf) : null,
                      dynamometer_force_mmlm: indexForm.dynamometer ? Number(indexForm.dynamometer) : null,
                      chair_test_seconds: indexForm.chair ? Number(indexForm.chair) : null,
                      insulin_resistance_index: indexForm.insulin ? Number(indexForm.insulin) : null,
                    }),
                  });
                  if (res.ok) {
                    setIndexForm({ calf: "", dynamometer: "", chair: "", insulin: "" });
                    const r = await fetch(`/api/doctor/patient/${patientId}/indices`, { credentials: "include" });
                    if (r.ok) { const d = await r.json(); setIndices(d.entries || []); }
                  }
                } catch {}
                finally { setIndexSaving(false); }
              }} disabled={indexSaving || (!indexForm.calf && !indexForm.dynamometer && !indexForm.chair && !indexForm.insulin)}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition">
                {indexSaving ? "Guardando..." : "Registrar índices"}
              </button>

              {indices.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-2">Historial</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {indices.map(idx => (
                      <div key={idx.id} className="flex justify-between text-xs border-b border-gray-50 pb-1">
                        <span className="text-gray-600">
                          {idx.calf_circumference_cm != null && `Pant: ${idx.calf_circumference_cm}cm `}
                          {idx.dynamometer_force_mmlm != null && `Din: ${idx.dynamometer_force_mmlm} `}
                          {idx.chair_test_seconds != null && `Silla: ${idx.chair_test_seconds}s `}
                          {idx.insulin_resistance_index != null && `IR: ${idx.insulin_resistance_index}`}
                        </span>
                        <span className="text-gray-400 shrink-0">{new Date(idx.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Antecedentes Médicos */}
            {!medicalHistory ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <p className="text-gray-400 text-sm">El paciente aún no completó sus antecedentes médicos</p>
              </div>
            ) : (
              <>
                {/* Family History */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Antecedentes Familiares</h3>
                  {medicalHistory.familyHistory.filter(f => f.has_condition).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Ninguno (seleccionado por el paciente)</p>
                  ) : (
                    <div className="space-y-2">
                      {medicalHistory.familyHistory.filter(f => f.has_condition).map(f => (
                        <div key={f.condition} className="flex items-start gap-2 p-3 rounded-xl bg-red-50/50 border border-red-100">
                          <span className="text-red-500 shrink-0 mt-0.5">+</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{CONDITION_LABELS[f.condition] || f.condition}</p>
                            {f.notes && <p className="text-xs text-gray-500 mt-0.5">{f.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Personal History */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Antecedentes Personales</h3>
                  {medicalHistory.personalHistory.filter(p => p.has_condition).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Ninguno (seleccionado por el paciente)</p>
                  ) : (
                    <div className="space-y-2">
                      {medicalHistory.personalHistory.filter(p => p.has_condition).map(p => (
                        <div key={p.condition} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                          <span className="text-amber-500 shrink-0 mt-0.5">+</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{CONDITION_LABELS[p.condition] || p.condition}</p>
                            {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Medications */}
                {medicalHistory.medications.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Medicación Actual</h3>
                    <div className="space-y-2">
                      {medicalHistory.medications.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                          <span className="text-blue-500 shrink-0">{"\ud83d\udc8a"}</span>
                          <div>
                            <p className="text-xs text-gray-400">{CONDITION_LABELS[m.condition] || m.condition}</p>
                            <p className="text-sm text-gray-800">{m.medication_text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface DoctorCheckupItem {
  id: number;
  code: string;
  display_name_es: string;
  category: string;
  frequency_months: number | null;
  last_completed_at: string | null;
  next_due_at: string | null;
  status: string;
  days_until_due: number | null;
  active: boolean;
}

function getRelativeLabel(nextDueAt: string | null, status: string): string {
  if (!nextDueAt) return "";
  const now = new Date();
  const due = new Date(nextDueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (status === "atrasado") {
    const absDays = Math.abs(diffDays);
    if (absDays < 30) return `Venció hace ${absDays} días`;
    const months = Math.round(absDays / 30);
    return `Venció hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }
  if (status === "proximo") {
    const fecha = due.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" });
    return `En ${diffDays} días · ${fecha}`;
  }
  const fecha = due.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" });
  return `Próximo: ${fecha}`;
}

function getCategoryEmoji(category: string): string {
  switch (category) { case "specialist": return "🩺"; case "lab": return "🧪"; case "imaging": return "📷"; default: return "🍎"; }
}

interface CheckupRequestItem {
  id: number;
  patient_checkup_id: number;
  checkup_name: string;
  checkup_category: string;
  created_at: string;
}

function DoctorCheckupPanel({ patientId, onReload }: { patientId: string; onReload: () => void }) {
  const [checkups, setCheckups] = useState<DoctorCheckupItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CheckupRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [freqOverride, setFreqOverride] = useState("");
  const [completeId, setCompleteId] = useState<number | null>(null);
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().split("T")[0]);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const completeFileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "critical">("success");
  const [actionLoading, setActionLoading] = useState(false);

  // Attachments viewer for completions
  const [viewingCompletions, setViewingCompletions] = useState<number | null>(null);
  const [completionHistory, setCompletionHistory] = useState<Array<{
    id: number; completed_at: string; notes: string | null; reported_by: string | null; attachment_count: number;
  }>>([]);
  const [completionAttachments, setCompletionAttachments] = useState<Record<number, Array<{
    id: number; cloudinary_url: string; original_filename: string; file_type: string;
    parse_status: string | null; document_type: string | null;
    parsed_data: { tests?: Array<{ name: string; value: number | string; unit: string | null; reference_range: string | null; flag: string }>; findings?: string; impressions?: string; summary?: string } | null;
    confidence_score: number | null; error_message: string | null;
  }>>>({});
  const [expandedCompletion, setExpandedCompletion] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState<number | null>(null);

  // Upload to existing completion (doctor)
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const historyFileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const loadCheckups = useCallback(async () => {
    try {
      const [checkupsRes, requestsRes] = await Promise.all([
        fetch(`/api/doctor/patient/${patientId}/checkups`, { credentials: "include" }),
        fetch("/api/doctor/checkup-requests", { credentials: "include" }).catch(() => null),
      ]);
      if (checkupsRes.ok) {
        const data = await checkupsRes.json();
        setCheckups(data.checkups || []);
      }
      if (requestsRes?.ok) {
        const rd = await requestsRes.json();
        // Filter to only show requests for this patient
        const allRequests: CheckupRequestItem[] = (rd.requests || [])
          .filter((r: { patient_id: number }) => r.patient_id === Number(patientId));
        setPendingRequests(allRequests);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { loadCheckups(); }, [loadCheckups]);

  async function handleToggleActive(item: DoctorCheckupItem) {
    setActionLoading(true); setMsg("");
    try {
      const res = await fetch(`/api/doctor/patient/${patientId}/checkups/${item.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      if (res.ok) {
        setMsg(item.active ? "Control desactivado" : "Control reactivado");
        setMsgType("success");
        loadCheckups();
      } else {
        const d = await res.json();
        setMsg(d.error || "Error"); setMsgType("critical");
      }
    } catch { setMsg("Error de conexión"); setMsgType("critical"); }
    finally { setActionLoading(false); }
  }

  async function handleFreqSave(item: DoctorCheckupItem) {
    setActionLoading(true); setMsg("");
    const val = freqOverride === "" ? null : parseInt(freqOverride, 10);
    try {
      const res = await fetch(`/api/doctor/patient/${patientId}/checkups/${item.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency_months_override: val }),
      });
      if (res.ok) {
        setMsg("Frecuencia actualizada"); setMsgType("success");
        setEditingId(null);
        loadCheckups();
      } else {
        const d = await res.json();
        setMsg(d.error || "Error"); setMsgType("critical");
      }
    } catch { setMsg("Error de conexión"); setMsgType("critical"); }
    finally { setActionLoading(false); }
  }

  async function handleComplete(item: DoctorCheckupItem) {
    setActionLoading(true); setMsg("");
    try {
      const date = new Date(completeDate + "T12:00:00");
      let res: Response;

      if (completeFiles.length > 0) {
        const formData = new FormData();
        formData.append("completed_at", date.toISOString());
        if (completeNotes) formData.append("notes", completeNotes);
        completeFiles.forEach(f => formData.append("files", f));
        res = await fetch(`/api/doctor/patient/${patientId}/checkups/${item.id}/complete`, {
          method: "POST", credentials: "include",
          body: formData,
        });
      } else {
        res = await fetch(`/api/doctor/patient/${patientId}/checkups/${item.id}/complete`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed_at: date.toISOString(), notes: completeNotes || undefined }),
        });
      }

      if (res.ok) {
        setMsg("Control registrado"); setMsgType("success");
        setCompleteId(null); setCompleteNotes(""); setCompleteFiles([]);
        loadCheckups();
        onReload();
      } else {
        const d = await res.json();
        setMsg(d.error || "Error"); setMsgType("critical");
      }
    } catch { setMsg("Error de conexión"); setMsgType("critical"); }
    finally { setActionLoading(false); }
  }

  async function loadCompletionHistory(checkupId: number) {
    if (viewingCompletions === checkupId) { setViewingCompletions(null); return; }
    setViewingCompletions(checkupId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/doctor/patient/${patientId}/checkups/${checkupId}/history`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCompletionHistory(data.completions || []);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }

  async function loadCompletionAttachments(completionId: number) {
    if (expandedCompletion === completionId) { setExpandedCompletion(null); return; }
    setExpandedCompletion(completionId);
    if (completionAttachments[completionId]) return;
    setAttachmentsLoading(completionId);
    try {
      const res = await fetch(`/api/checkups/completions/${completionId}/attachments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCompletionAttachments(prev => ({ ...prev, [completionId]: data.attachments || [] }));
      }
    } catch { /* ignore */ }
    finally { setAttachmentsLoading(null); }
  }

  async function handleRetryParse(attachmentId: number, completionId: number) {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/retry-parse`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setCompletionAttachments(prev => { const u = { ...prev }; delete u[completionId]; return u; });
        setExpandedCompletion(null);
        setTimeout(() => loadCompletionAttachments(completionId), 2000);
      }
    } catch { /* ignore */ }
  }

  function triggerHistoryUpload(completionId: number) {
    setUploadTargetId(completionId);
    setTimeout(() => historyFileRef.current?.click(), 0);
  }

  async function handleHistoryFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!uploadTargetId || files.length === 0) return;
    if (historyFileRef.current) historyFileRef.current.value = "";

    setUploadingFor(uploadTargetId);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));

      const res = await fetch(`/api/checkups/completions/${uploadTargetId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        setCompletionAttachments(prev => { const u = { ...prev }; delete u[uploadTargetId]; return u; });
        setCompletionHistory(prev => prev.map(h =>
          h.id === uploadTargetId ? { ...h, attachment_count: h.attachment_count + files.length } : h
        ));
        setExpandedCompletion(uploadTargetId);
        loadCompletionAttachments(uploadTargetId);
      } else {
        const data = await res.json();
        setMsg(data.error || "No pudimos subir el archivo.");
        setMsgType("critical");
      }
    } catch {
      setMsg("No pudimos subir el archivo. Intentá de nuevo.");
      setMsgType("critical");
    } finally {
      setUploadingFor(null);
      setUploadTargetId(null);
    }
  }

  const refreshAttachments = useCallback(async (completionId: number) => {
    try {
      const res = await fetch(`/api/checkups/completions/${completionId}/attachments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCompletionAttachments(prev => ({ ...prev, [completionId]: data.attachments || [] }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (expandedCompletion === null) return;
    const atts = completionAttachments[expandedCompletion];
    if (!atts) return;
    const hasPending = atts.some(a => a.parse_status === "pending" || a.parse_status === "processing");
    if (!hasPending) return;

    const interval = setInterval(() => refreshAttachments(expandedCompletion), 4000);
    return () => clearInterval(interval);
  }, [expandedCompletion, completionAttachments, refreshAttachments]);

  async function dismissRequest(requestId: number) {
    try {
      const res = await fetch(`/api/doctor/checkup-requests/${requestId}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch { /* ignore */ }
  }

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      {/* Pending order requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Solicitudes de órdenes pendientes
          </h4>
          <div className="space-y-2">
            {pendingRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {r.checkup_category === "lab" ? "🧪" : r.checkup_category === "imaging" ? "📷" : "🩺"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.checkup_name}</p>
                    <p className="text-xs text-gray-400">
                      Solicitado el {`${new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })} ${new Date(r.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" })}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissRequest(r.id)}
                  className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition"
                >
                  Marcar como vista
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">🩺 Seguimiento Médico</h3>
        {msg && (
          <div className={`p-2 rounded-lg text-sm text-center font-medium mb-4 ${msgType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg}
          </div>
        )}
        {checkups.length === 0 ? <p className="text-gray-400 text-sm">Sin controles configurados</p> : (
        <div className="space-y-3">
          {checkups.map(item => (
            <div key={item.id} className={`p-4 rounded-xl border ${!item.active ? "border-gray-200 opacity-60" : item.status === "atrasado" ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{getCategoryEmoji(item.category)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{item.display_name_es}</span>
                      {item.active && <CheckupStatusBadge status={item.status} />}
                      {!item.active && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Desactivado</span>}
                    </div>
                    {item.active && item.next_due_at && item.status !== "sin_registro" && (
                      <p className={`text-xs mt-0.5 ${item.status === "atrasado" ? "text-red-600" : "text-gray-500"}`}>
                        {getRelativeLabel(item.next_due_at, item.status)}
                      </p>
                    )}
                    {item.last_completed_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Último: {new Date(item.last_completed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {item.frequency_months ? `Cada ${item.frequency_months} meses` : "Sin frecuencia fija"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {item.active && (
                  <button onClick={() => { setCompleteId(completeId === item.id ? null : item.id); setEditingId(null); }}
                    className="text-xs text-primary-600 font-medium hover:underline min-h-[44px] px-2">
                    Marcar como realizado
                  </button>
                )}
                <button onClick={() => { setEditingId(editingId === item.id ? null : item.id); setCompleteId(null); setFreqOverride(item.frequency_months?.toString() ?? ""); }}
                  className="text-xs text-blue-600 font-medium hover:underline min-h-[44px] px-2">
                  Cambiar frecuencia
                </button>
                <button onClick={() => handleToggleActive(item)} disabled={actionLoading}
                  className={`text-xs font-medium hover:underline min-h-[44px] px-2 ${item.active ? "text-red-500" : "text-green-600"}`}>
                  {item.active ? "Desactivar control" : "Reactivar control"}
                </button>
                {item.last_completed_at && (
                  <button onClick={() => { loadCompletionHistory(item.id); setCompleteId(null); setEditingId(null); }}
                    className={`text-xs font-medium hover:underline min-h-[44px] px-2 ${viewingCompletions === item.id ? "text-primary-600" : "text-gray-500"}`}>
                    Ver historial
                  </button>
                )}
              </div>

              {/* Inline frequency edit */}
              {editingId === item.id && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
                  <label className="block text-xs text-gray-500">Frecuencia (meses)</label>
                  <div className="flex gap-2">
                    <input type="number" value={freqOverride} onChange={e => setFreqOverride(e.target.value)}
                      placeholder="Ej: 3" min="1" max="60"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]" />
                    <button onClick={() => handleFreqSave(item)} disabled={actionLoading}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[44px]">
                      Guardar
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg min-h-[44px]">
                      Cancelar
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Dejá vacío para usar la frecuencia por defecto</p>
                </div>
              )}

              {/* Inline completion form */}
              {completeId === item.id && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
                  <label className="block text-xs text-gray-500">¿Cuándo lo hizo?</label>
                  <input type="date" value={completeDate} onChange={e => setCompleteDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]" />
                  <label className="block text-xs text-gray-500">Notas (opcional)</label>
                  <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none" />

                  {/* File upload */}
                  <div>
                    <input ref={completeFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (completeFiles.length + files.length > 10) { setMsg("Máximo 10 archivos"); setMsgType("critical"); return; }
                        setCompleteFiles(prev => [...prev, ...files]);
                        if (completeFileRef.current) completeFileRef.current.value = "";
                      }}
                      className="hidden" />
                    <button type="button" onClick={() => completeFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-600 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Adjuntar archivo
                    </button>
                  </div>
                  {completeFiles.length > 0 && (
                    <div className="space-y-1">
                      {completeFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
                          <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                          <button onClick={() => setCompleteFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handleComplete(item)} disabled={!completeDate || actionLoading}
                      className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[44px]">
                      {actionLoading && completeFiles.length > 0 ? "Subiendo..." : "Guardar"}
                    </button>
                    <button onClick={() => { setCompleteId(null); setCompleteFiles([]); }}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg min-h-[44px]">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden file input for doctor history uploads */}
              <input
                ref={historyFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                multiple
                onChange={handleHistoryFileSelect}
                className="hidden"
              />

              {/* View completion history with attachments */}
              {viewingCompletions === item.id && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                  <h5 className="text-xs font-semibold text-gray-500">Historial de visitas</h5>
                  {historyLoading ? (
                    <div className="flex justify-center py-2"><div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                  ) : completionHistory.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin visitas registradas</p>
                  ) : (
                    <div className="space-y-2">
                      {completionHistory.map(c => (
                        <div key={c.id}>
                          <div className="flex items-start justify-between py-1.5">
                            <div>
                              <p className="text-sm text-gray-700">
                                {new Date(c.completed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })} {new Date(c.completed_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" })}
                              </p>
                              {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                              {c.reported_by && <span className="text-xs text-gray-400">por {c.reported_by}</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {uploadingFor === c.id ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary-600">
                                <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                                Subiendo...
                              </div>
                            ) : (
                              <button
                                onClick={() => triggerHistoryUpload(c.id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition min-h-[36px]"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                Adjuntar archivo
                              </button>
                            )}
                            {c.attachment_count > 0 && (
                              <button
                                onClick={() => loadCompletionAttachments(c.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition min-h-[36px] ${expandedCompletion === c.id ? "border-primary-300 bg-primary-50 text-primary-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Ver archivos ({c.attachment_count})
                              </button>
                            )}
                          </div>

                          {/* Expanded attachments with parsed data */}
                          {expandedCompletion === c.id && (
                            <div className="ml-3 mt-1 mb-2 space-y-2">
                              {attachmentsLoading === c.id ? (
                                <div className="flex justify-center py-2"><div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                              ) : (
                                (completionAttachments[c.id] || []).map(att => (
                                  <div key={att.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      {att.file_type === "image" ? (
                                        <a href={att.cloudinary_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                          <img src={att.cloudinary_url} alt={att.original_filename} className="w-12 h-12 object-cover rounded border border-gray-200" />
                                        </a>
                                      ) : (
                                        <a href={att.cloudinary_url} target="_blank" rel="noopener noreferrer" className="shrink-0 w-12 h-12 flex items-center justify-center bg-red-50 rounded border border-gray-200">
                                          <span className="text-xs font-medium text-red-600">PDF</span>
                                        </a>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <a href={att.cloudinary_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline truncate block">
                                          {att.original_filename}
                                        </a>
                                        {att.parse_status === "completed" && att.document_type && (
                                          <span className="text-xs text-gray-400">
                                            {att.document_type === "lab_results" ? "Resultados de laboratorio" :
                                             att.document_type === "imaging" ? "Estudio por imágenes" :
                                             att.document_type === "prescription" ? "Receta" : "Documento"}
                                            {att.confidence_score ? ` · ${Math.round(att.confidence_score * 100)}%` : ""}
                                          </span>
                                        )}
                                        {att.parse_status === "processing" && <span className="text-xs text-amber-500">Procesando...</span>}
                                        {att.parse_status === "pending" && <span className="text-xs text-gray-400">En cola...</span>}
                                        {att.parse_status === "failed" && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-red-500">Error al procesar</span>
                                            <button onClick={() => handleRetryParse(att.id, c.id)} className="text-xs text-primary-500 hover:underline">Reintentar</button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Parsed lab results table */}
                                    {att.parse_status === "completed" && att.parsed_data?.tests && att.parsed_data.tests.length > 0 && (
                                      <div className="border-t border-gray-200 pt-2">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="text-gray-400 text-left">
                                              <th className="pb-1 font-medium">Estudio</th>
                                              <th className="pb-1 font-medium text-right">Valor</th>
                                              <th className="pb-1 font-medium text-right">Referencia</th>
                                              <th className="pb-1 font-medium text-center">Estado</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {att.parsed_data.tests.map((test, ti) => (
                                              <tr key={ti} className="border-t border-gray-100">
                                                <td className="py-1 text-gray-700">{test.name}</td>
                                                <td className="py-1 text-right font-medium text-gray-800">{test.value} {test.unit || ""}</td>
                                                <td className="py-1 text-right text-gray-400">{test.reference_range || "—"}</td>
                                                <td className="py-1 text-center">
                                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                    test.flag === "high" ? "text-red-600 bg-red-50" :
                                                    test.flag === "low" ? "text-blue-600 bg-blue-50" :
                                                    test.flag === "normal" ? "text-green-600 bg-green-50" : "text-gray-600 bg-gray-50"
                                                  }`}>
                                                    {test.flag === "high" ? "Alto" : test.flag === "low" ? "Bajo" : test.flag === "normal" ? "Normal" : "—"}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                    {att.parse_status === "completed" && att.parsed_data?.findings && (
                                      <div className="border-t border-gray-200 pt-2">
                                        <p className="text-xs text-gray-600">{att.parsed_data.findings}</p>
                                        {att.parsed_data.impressions && <p className="text-xs text-gray-500 mt-1 italic">{att.parsed_data.impressions}</p>}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
