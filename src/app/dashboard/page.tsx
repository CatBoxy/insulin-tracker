"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { logout } from "@/lib/logout";

interface User { id: number; email: string; role: string }
interface Measurement { id: number; type: string; value: number; unit: string; context: string | null; notes: string; recorded_at: string }
interface Alert { id: number; title: string; message: string; severity: string }
interface Medication { id: number; name: string; dosage: string; frequency: string; instructions: string }
interface Appointment { id: number; scheduled_at: string; duration_minutes: number; type: string; status: string; reason: string | null; doctor_email: string; doctor_first_name: string | null; doctor_last_name: string | null }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [glucemia, setGlucemia] = useState("");
  const [glucemiaContext, setGlucemiaContext] = useState<"fasting" | "postprandial" | "pre_dinner">("fasting");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "warning" | "critical">("success");

  const loadData = useCallback(async () => {
    try {
      const userRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!userRes.ok) { router.push("/login"); return; }
      const userData = await userRes.json();
      setUser(userData.user);

      // Load other data independently — don't redirect on failure
      const [measRes, alertRes, medRes, apptRes] = await Promise.all([
        fetch("/api/measurements", { credentials: "include" }).catch(() => null),
        fetch("/api/alerts", { credentials: "include" }).catch(() => null),
        fetch("/api/medications", { credentials: "include" }).catch(() => null),
        fetch("/api/appointments?upcoming=true", { credentials: "include" }).catch(() => null),
      ]);

      if (measRes?.ok) {
        const d = await measRes.json().catch(() => ({}));
        setMeasurements(d.measurements || []);
      }
      if (alertRes?.ok) {
        const d = await alertRes.json().catch(() => ({}));
        setAlerts(d.alerts || []);
      }
      if (medRes?.ok) {
        const d = await medRes.json().catch(() => ({}));
        setMedications(d.medications || []);
      }
      if (apptRes?.ok) {
        const d = await apptRes.json().catch(() => ({}));
        setAppointments(d.appointments || []);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function logMeasurement(type: string) {
    setLoading(true); setMsg(""); setMsgType("success");

    // Client-side BP validation
    if (type === "blood_pressure") {
      const sys = Number(systolic);
      const dia = Number(diastolic);
      if (sys <= dia) {
        setMsg("La presión sistólica debe ser mayor que la diastólica");
        setMsgType("critical");
        setLoading(false);
        return;
      }
    }

    const body = type === "glucemia"
      ? { type, value: Number(glucemia), context: glucemiaContext }
      : { type: "blood_pressure", systolic: Number(systolic), diastolic: Number(diastolic) };

    try {
      const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGlucemia(""); setSystolic(""); setDiastolic("");
        if (data.alert) {
          setMsg(`${data.alert.title}: ${data.alert.message}`);
          setMsgType(data.status === "critical" ? "critical" : "warning");
        } else {
          setMsg("✓ Valores normales");
          setMsgType("success");
        }
        loadData();
      } else {
        const d = await res.json();
        setMsg(d.error || "Error");
        setMsgType("critical");
      }
    } catch { setMsg("Error de conexión"); setMsgType("critical"); }
    finally { setLoading(false); }
  }

  const handleLogout = () => logout(router);

  // Helper to extract diastolic from notes
  function getDiastolic(m: Measurement): string {
    const match = m.notes?.match(/diastolic:(\d+)/);
    return match ? match[1] : "?";
  }

  const glucemiaData = measurements
    .filter(m => m.type === "glucemia" && m.value)
    .reverse()
    .map(m => ({ date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }), valor: m.value }));

  const bpData = measurements
    .filter(m => m.type === "blood_pressure")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      sistólica: Number(m.value),
      diastólica: Number(getDiastolic(m)),
    }));

  const glucemiaMeasurements = measurements.filter(m => m.type === "glucemia");
  const bpMeasurements = measurements.filter(m => m.type === "blood_pressure");

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Nivelo</h1>
              <p className="text-xs text-gray-500">Hola, {user.email.split("@")[0]}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Cerrar sesión</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${a.severity === "critical" ? "bg-red-50 text-red-700 border border-red-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"}`}>
                <span>⚠️ {a.title}{a.message ? `: ${a.message}` : ""}</span>
                <button
                  onClick={async () => {
                    await fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertIds: [a.id] }), credentials: "include" });
                    setAlerts(prev => prev.filter(x => x.id !== a.id));
                  }}
                  className="ml-3 text-xs opacity-60 hover:opacity-100 transition"
                  title="Descartar"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming appointments */}
        {appointments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">📅 Próximas Citas</h3>
            <div className="space-y-2">
              {appointments.map(a => {
                const doctorName = (a.doctor_first_name || a.doctor_last_name)
                  ? `Dr. ${a.doctor_first_name || ""} ${a.doctor_last_name || ""}`.trim()
                  : a.doctor_email.split("@")[0];
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{a.type === "video_call" ? "📹" : "🏥"}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {new Date(a.scheduled_at).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                          {" "}
                          {new Date(a.scheduled_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-gray-400">{doctorName} — {a.duration_minutes} min</p>
                        {a.reason && <p className="text-xs text-gray-500">{a.reason}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {a.status === "confirmed" ? "Confirmada" : "Pendiente"}
                      </span>
                      {a.status === "pending" && (
                        <button onClick={async () => {
                          await fetch(`/api/appointments/${a.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "confirmed" }) });
                          setAppointments(prev => prev.map(x => x.id === a.id ? { ...x, status: "confirmed" } : x));
                        }} className="text-xs text-primary-600 font-medium hover:underline">Confirmar</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Log */}
        {msg && <div className={`p-3 rounded-xl text-sm text-center font-medium ${msgType === "success" ? "bg-green-50 text-green-700" : msgType === "warning" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">🩸 Glucemia</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {([["fasting", "En ayunas"], ["postprandial", "2hs post almuerzo"], ["pre_dinner", "Antes de cenar"]] as const).map(([value, label]) => (
                <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition ${glucemiaContext === value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <input type="radio" name="glucemiaContext" value={value} checked={glucemiaContext === value}
                    onChange={() => setGlucemiaContext(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" value={glucemia} onChange={e => setGlucemia(e.target.value)} placeholder="mg/dL"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={() => logMeasurement("glucemia")} disabled={!glucemia || loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">💓 Presión Arterial</h3>
            <div className="flex gap-2">
              <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)} placeholder="Sist."
                className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="self-center text-gray-400">/</span>
              <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)} placeholder="Diast."
                className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={() => logMeasurement("blood_pressure")} disabled={!systolic || !diastolic || loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
            </div>
          </div>
        </div>

        {/* Glucemia & BP Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">🩸 Glucemia</h3>
          {glucemiaData.length > 1 && (
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={glucemiaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip />
                  <ReferenceLine y={140} stroke="#eab308" strokeDasharray="3 3" label={{ value: "140", position: "right", fontSize: 10 }} />
                  <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" label={{ value: "70", position: "right", fontSize: 10 }} />
                  <Line type="monotone" dataKey="valor" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: "#16a34a" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {glucemiaMeasurements.length === 0 ? <p className="text-gray-400 text-sm">Sin registros de glucemia</p> : (
            <div className="space-y-2">
              {glucemiaMeasurements.slice(0, 10).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.value} mg/dL</p>
                    {m.context && <p className="text-xs text-gray-400">{{ fasting: "En ayunas", postprandial: "Postprandial", pre_dinner: "Antes de cenar" }[m.context] || m.context}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(m.recorded_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Presión Arterial Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">💓 Presión Arterial</h3>
          {bpData.length > 1 && (
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={220}>
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
          {bpMeasurements.length === 0 ? <p className="text-gray-400 text-sm">Sin registros de presión arterial</p> : (
            <div className="space-y-2">
              {bpMeasurements.slice(0, 10).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm font-medium text-gray-800">{m.value}/{getDiastolic(m)} mmHg</p>
                  <span className="text-xs text-gray-400">{new Date(m.recorded_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Medications */}
        {medications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">💊 Medicamentos Activos</h3>
            <div className="space-y-3">
              {medications.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.dosage}{m.frequency ? ` — ${m.frequency}` : ""}</p>
                    {m.instructions && <p className="text-xs text-gray-400 italic">{m.instructions}</p>}
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
