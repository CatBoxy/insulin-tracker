"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface CheckupRequest {
  id: number;
  patient_checkup_id: number;
  patient_id: number;
  status: string;
  created_at: string;
  checkup_code: string;
  checkup_name: string;
  checkup_category: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_email: string;
}

function patientName(r: CheckupRequest) {
  if (r.patient_first_name || r.patient_last_name) return `${r.patient_first_name || ""} ${r.patient_last_name || ""}`.trim();
  return r.patient_email.split("@")[0];
}

function categoryEmoji(category: string) {
  switch (category) {
    case "lab": return "\uD83E\uDDEA";
    case "imaging": return "\uD83D\uDCF7";
    case "specialist": return "\uD83E\uDE7A";
    default: return "\uD83C\uDF4E";
  }
}

export default function DoctorNotificationsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CheckupRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor/checkup-requests", { credentials: "include" });
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { router.push("/login"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function dismiss(requestId: number) {
    try {
      const res = await fetch(`/api/doctor/checkup-requests/${requestId}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/doctor")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Notificaciones</h1>
            <p className="text-xs text-gray-500">Solicitudes y avisos de pacientes</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm">No hay notificaciones pendientes</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paciente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        {categoryEmoji(r.checkup_category)} Solicitud de orden
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/doctor/patient/${r.patient_id}`)}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {patientName(r)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.checkup_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {`${new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })} ${new Date(r.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" })}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => dismiss(r.id)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                      >
                        Marcar como vista
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
