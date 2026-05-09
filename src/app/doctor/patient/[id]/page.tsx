"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getGlucemiaStatus, getSystolicStatus, type VitalStatus } from "@/lib/thresholds";

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
  const [tab, setTab] = useState<"vitals" | "alerts" | "prescriptions" | "appointments">("vitals");
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("09:00");
  const [apptDuration, setApptDuration] = useState("30");
  const [apptType, setApptType] = useState("in_person");
  const [apptReason, setApptReason] = useState("");
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

  const glucoseData = measurements
    .filter(m => m.type === "glucemia")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      valor: Number(m.value),
    }));

  const bpData = measurements
    .filter(m => m.type === "blood_pressure")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      sistólica: Number(m.value),
      diastólica: parseDiastolic(m.notes) ?? 0,
    }));

  const weightData = measurements
    .filter(m => m.type === "weight")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {age !== null && <div><span className="text-gray-400">Edad</span><p className="font-medium text-gray-800">{age} años</p></div>}
            {patient.gender && <div><span className="text-gray-400">Género</span><p className="font-medium text-gray-800">{patient.gender === "male" ? "Masculino" : patient.gender === "female" ? "Femenino" : patient.gender}</p></div>}
            {patient.blood_type && <div><span className="text-gray-400">Grupo sanguíneo</span><p className="font-medium text-gray-800">{patient.blood_type}</p></div>}
            {patient.allergies && <div><span className="text-gray-400">Alergias</span><p className="font-medium text-gray-800">{patient.allergies}</p></div>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["vitals", "alerts", "prescriptions", "appointments"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? "bg-primary-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {t === "vitals" ? `📊 Signos Vitales` : t === "alerts" ? `⚠️ Alertas (${alerts.filter(a => !a.read).length})` : t === "prescriptions" ? `📋 Prescripciones` : `📅 Citas (${appointments.filter(a => a.status !== "cancelled").length})`}
            </button>
          ))}
        </div>

        {tab === "vitals" && (
          <>
            {/* Glucose chart */}
            {glucoseData.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">🩸 Glucemia</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={glucoseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip />
                    <ReferenceLine y={140} stroke="#eab308" strokeDasharray="3 3" label={{ value: "140", position: "right", fontSize: 10 }} />
                    <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "200", position: "right", fontSize: 10 }} />
                    <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" label={{ value: "70", position: "right", fontSize: 10 }} />
                    <Line type="monotone" dataKey="valor" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: "#16a34a" }} />
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

            {/* Measurement history table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">📋 Historial de Mediciones</h3>
              {measurements.length === 0 ? <p className="text-gray-400 text-sm">Sin mediciones</p> : (
                <div className="space-y-2">
                  {measurements.map(m => {
                    const diastolic = parseDiastolic(m.notes);
                    let status: VitalStatus = "normal";
                    if (m.type === "glucemia") status = getGlucemiaStatus(Number(m.value));
                    if (m.type === "blood_pressure") status = getSystolicStatus(Number(m.value));

                    return (
                      <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl ${statusBadge[status].replace("text-", "").includes("green") ? "bg-green-50/50" : statusBadge[status].replace("text-", "").includes("yellow") ? "bg-yellow-50/50" : statusBadge[status].replace("text-", "").includes("red") ? "bg-red-50/50" : "bg-gray-50/50"}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{m.type === "glucemia" ? "🩸" : m.type === "blood_pressure" ? "💓" : "⚖️"}</span>
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
              )}
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
                      <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                    {p.notes && <p className="text-sm text-gray-700 mt-2">{p.notes}</p>}
                    {p.expires_at && <p className="text-xs text-gray-400 mt-1">Vence: {new Date(p.expires_at).toLocaleDateString("es-AR")}</p>}
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
                {apptMsg && <p className="text-sm text-green-600">{apptMsg}</p>}
                <button disabled={!apptDate} onClick={async () => {
                  const scheduled_at = new Date(`${apptDate}T${apptTime}`).toISOString();
                  const res = await fetch("/api/appointments", {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patient_id: Number(patientId), scheduled_at, duration_minutes: Number(apptDuration), type: apptType, reason: apptReason || null }),
                  });
                  if (res.ok) {
                    setApptMsg("Cita creada");
                    setShowApptForm(false);
                    setApptDate(""); setApptReason("");
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
                              {new Date(a.scheduled_at).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                              {" "}
                              {new Date(a.scheduled_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
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
      </main>
    </div>
  );
}
