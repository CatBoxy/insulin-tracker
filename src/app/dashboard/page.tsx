"use client";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { logout } from "@/lib/logout";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

interface User { id: number; email: string; role: string }
interface Measurement { id: number; type: string; value: number; unit: string; context: string | null; notes: string; recorded_at: string }
interface Alert { id: number; title: string; message: string; severity: string }
interface Medication { id: number; name: string; dosage: string; frequency: string; instructions: string }
interface Appointment { id: number; scheduled_at: string; duration_minutes: number; type: string; status: string; reason: string | null; doctor_email: string; doctor_first_name: string | null; doctor_last_name: string | null }

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctorCode = searchParams.get("doctor");
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [glucemia, setGlucemia] = useState("");
  const [glucemiaContext, setGlucemiaContext] = useState<"fasting" | "postprandial" | "pre_dinner" | "random">("fasting");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "warning" | "critical">("success");
  const [linkPrompt, setLinkPrompt] = useState<{ code: string; name: string } | null>(null);
  const [linkMsg, setLinkMsg] = useState("");
  const [checkupNeedsAttention, setCheckupNeedsAttention] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!userRes.ok) { router.push("/login"); return; }
      const userData = await userRes.json();
      setUser(userData.user);

      // Check if medical history is completed
      const historyRes = await fetch("/api/medical-history", { credentials: "include" }).catch(() => null);
      if (historyRes?.ok) {
        const historyData = await historyRes.json();
        if (!historyData.completed) {
          router.push("/dashboard/historia-clinica");
          return;
        }
      }

      // Load other data independently — don't redirect on failure
      const [measRes, alertRes, medRes, apptRes] = await Promise.all([
        fetch("/api/measurements?limit=500", { credentials: "include" }).catch(() => null),
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

      // Load checkup status for nav dot
      const checkupRes = await fetch("/api/checkups", { credentials: "include" }).catch(() => null);
      if (checkupRes?.ok) {
        const d = await checkupRes.json().catch(() => ({}));
        const checkups = d.checkups || [];
        setCheckupNeedsAttention(
          d.has_onboarding_pending ||
          checkups.some((c: { status: string }) => c.status === "atrasado")
        );
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (doctorCode) {
      fetch(`/api/doctors/by-code?code=${doctorCode}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.doctor) setLinkPrompt({ code: doctorCode, name: d.doctor.name }); })
        .catch(() => {});
    }
  }, [doctorCode]);

  async function logMeasurement(type: string) {
    setLoading(true); setMsg(""); setMsgType("success");

    // Block disabled glucemia categories
    if (type === "glucemia") {
      if (glucemiaContext === "fasting" && fastingDisabled) {
        setMsg("En ayunas no disponible — esperá 20hs desde el último registro postprandial");
        setMsgType("critical");
        setLoading(false);
        return;
      }
      if (glucemiaContext === "postprandial" && postprandialDisabled) {
        setMsg("Postprandial no disponible — esperá 20hs desde el último registro antes de cenar");
        setMsgType("critical");
        setLoading(false);
        return;
      }
    }

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

  const GLUCEMIA_MIN = 30;
  const GLUCEMIA_MAX = 500;
  const WINDOW_MS = 20 * 60 * 60 * 1000; // 20 hours

  // Group glucemia by 20h windows, keep max value per category per window (exclude "random")
  const glucemiaWindows: Array<{ timestamp: number; date: string; fasting?: number; postprandial?: number; pre_dinner?: number; outlier?: number }> = [];
  measurements
    .filter(m => m.type === "glucemia" && m.value)
    .reverse()
    .forEach(m => {
      const ts = new Date(m.recorded_at).getTime();
      const date = new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
      const isOutlier = m.value < GLUCEMIA_MIN || m.value > GLUCEMIA_MAX;

      // Find or create a window for this measurement
      let window = glucemiaWindows.find(w => Math.abs(ts - w.timestamp) < WINDOW_MS);
      if (!window) {
        window = { timestamp: ts, date };
        glucemiaWindows.push(window);
      }

      if (isOutlier) {
        window.outlier = Math.max(window.outlier ?? 0, m.value);
      } else if (m.context === "random") {
        // Skip "Al azar" from chart lines
      } else {
        const ctx = (m.context || "fasting") as "fasting" | "postprandial" | "pre_dinner";
        window[ctx] = Math.max(window[ctx] ?? 0, m.value);
      }
    });

  const glucemiaData = glucemiaWindows.map(w => ({
    date: w.date,
    fasting: w.fasting,
    postprandial: w.postprandial,
    pre_dinner: w.pre_dinner,
    outlier: w.outlier,
  }));

  // Determine which categories are disabled based on 20h rule
  const glucemiaMeasurements = measurements.filter(m => m.type === "glucemia");
  const now = Date.now();
  const lastPostprandial = glucemiaMeasurements.find(m => m.context === "postprandial");
  const lastPreDinner = glucemiaMeasurements.find(m => m.context === "pre_dinner");
  const fastingDisabled = lastPostprandial && (now - new Date(lastPostprandial.recorded_at).getTime()) < WINDOW_MS;
  const postprandialDisabled = lastPreDinner && (now - new Date(lastPreDinner.recorded_at).getTime()) < WINDOW_MS;

  const bpData = measurements
    .filter(m => m.type === "blood_pressure")
    .reverse()
    .map(m => ({
      date: new Date(m.recorded_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      sistólica: Number(m.value),
      diastólica: Number(getDiastolic(m)),
    }));

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
          <div className="flex items-center gap-4">
            <a href="/dashboard/seguimiento" className="relative text-sm text-gray-500 hover:text-gray-700">
              Seguimiento
              {checkupNeedsAttention && (
                <span className="absolute -top-1 -right-2 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              )}
            </a>
            <a href="/dashboard/historia-clinica" className="text-sm text-gray-500 hover:text-gray-700">Antecedentes Médicos</a>
            <a href="/account" className="text-sm text-gray-500 hover:text-gray-700">Mi Cuenta</a>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Salir</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <PwaInstallPrompt />
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

        {/* Doctor Link Prompt */}
        {linkPrompt && !linkMsg && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-primary-800 mb-3">
              Querés vincularte con <span className="font-semibold">Dr. {linkPrompt.name}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={async () => {
                  const res = await fetch("/api/doctors/link", {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: linkPrompt.code }),
                  });
                  const data = await res.json();
                  setLinkMsg(data.message || data.error);
                  setLinkPrompt(null);
                  router.replace("/dashboard");
                }}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition"
              >
                Vincularme
              </button>
              <button
                onClick={() => { setLinkPrompt(null); router.replace("/dashboard"); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-xl text-sm font-medium transition"
              >
                No, gracias
              </button>
            </div>
          </div>
        )}
        {linkMsg && (
          <div className="bg-primary-50 text-primary-700 p-3 rounded-xl text-sm text-center font-medium">{linkMsg}</div>
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
                  <div key={a.id} className="p-3 rounded-xl border border-gray-100">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">{a.type === "video_call" ? "📹" : "🏥"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {new Date(a.scheduled_at).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                          {" "}
                          {new Date(a.scheduled_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-gray-400">{doctorName} — {a.duration_minutes} min</p>
                        {a.reason && <p className="text-xs text-gray-500 truncate">{a.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Seguimiento Médico — link */}
        {checkupNeedsAttention && (
          <a href="/dashboard/seguimiento" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0" />
            <p className="text-sm text-blue-700">Tenés controles médicos pendientes de revisar</p>
            <svg className="w-4 h-4 text-blue-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
        )}

        {/* Quick Log */}
        <h2 className="text-lg font-bold text-gray-800 mt-2">Registrar medición</h2>
        {msg && <div className={`p-3 rounded-xl text-sm text-center font-medium ${msgType === "success" ? "bg-green-50 text-green-700" : msgType === "warning" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">🩸 Glucemia</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {([["fasting", "En ayunas", fastingDisabled], ["postprandial", "2hs post almuerzo", postprandialDisabled], ["pre_dinner", "Antes de cenar", false], ["random", "Al azar", false]] as const).map(([value, label, disabled]) => (
                <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition ${disabled ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400" : glucemiaContext === value ? "border-primary-500 bg-primary-50 text-primary-700 cursor-pointer" : "border-gray-200 text-gray-600 hover:border-gray-300 cursor-pointer"}`}>
                  <input type="radio" name="glucemiaContext" value={value} checked={glucemiaContext === value}
                    onChange={() => { if (!disabled) setGlucemiaContext(value); }} disabled={!!disabled} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <input type="number" value={glucemia} onChange={e => setGlucemia(e.target.value)} placeholder="mg/dL"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 mb-3" />
            <button onClick={() => logMeasurement("glucemia")} disabled={!glucemia || loading}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">💓 Presión Arterial</h3>
            <div className="flex gap-2 mb-3">
              <input type="number" value={systolic} onChange={e => setSystolic(e.target.value)} placeholder="Sistólica"
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="self-center text-gray-400 shrink-0">/</span>
              <input type="number" value={diastolic} onChange={e => setDiastolic(e.target.value)} placeholder="Diastólica"
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <button onClick={() => logMeasurement("blood_pressure")} disabled={!systolic || !diastolic || loading}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-50 transition">Registrar</button>
          </div>
        </div>

        {/* Glucemia Chart — full width */}
        <h2 className="text-lg font-bold text-gray-800 mt-2">Historial</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">🩸 Glucemia</h3>
          {glucemiaData.length > 1 ? (
            <>
              <div className="flex flex-wrap gap-3 mb-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> En ayunas</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Postprandial</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> Antes de cenar</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={glucemiaData}>
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
            </>
          ) : (
            <p className="text-gray-400 text-sm">Sin registros suficientes para mostrar el gráfico</p>
          )}
        </div>

        {/* Presión Arterial Chart — full width */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">💓 Presión Arterial</h3>
          {bpData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
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
          ) : (
            <p className="text-gray-400 text-sm">Sin registros suficientes para mostrar el gráfico</p>
          )}
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
