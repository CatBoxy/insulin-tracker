"use client";
import { useState } from "react";
import CheckupStatusBadge from "./CheckupStatusBadge";

interface CheckupItem {
  id: number;
  code: string;
  display_name_es: string;
  category: string;
  frequency_months: number | null;
  last_completed_at: string | null;
  next_due_at: string | null;
  status: string;
  days_until_due: number | null;
}

interface CompletionEntry {
  id: number;
  completed_at: string;
  notes: string | null;
  reported_by: string | null;
  created_at: string;
}

function getRelativeLabel(nextDueAt: string | null, status: string): string {
  if (!nextDueAt) return "Sin frecuencia fija — registrá tus visitas para llevar un historial";
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
    const fecha = due.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
    return `En ${diffDays} días · ${fecha}`;
  }
  const fecha = due.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  return `Próximo: ${fecha}`;
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case "specialist": return "🩺";
    case "lab": return "🧪";
    case "imaging": return "📷";
    default: return "🍎";
  }
}

function formatFrequency(months: number | null): string {
  if (!months) return "Sin frecuencia fija";
  if (months === 1) return "Cada mes";
  if (months < 12) return `Cada ${months} meses`;
  if (months === 12) return "Anual";
  return `Cada ${months} meses`;
}

export default function CheckupCard({
  item,
  onCompleted,
}: {
  item: CheckupItem;
  onCompleted: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "critical">("success");

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CompletionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const hasVisits = item.last_completed_at !== null;

  async function handleSubmit() {
    setLoading(true);
    setMsg("");
    try {
      const date = new Date(completedAt + "T00:00:00-03:00");
      const res = await fetch(`/api/checkups/${item.id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed_at: date.toISOString(),
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        setMsg("Control registrado");
        setMsgType("success");
        setShowForm(false);
        setNotes("");
        // Reset history so it re-fetches if toggled
        setHistory([]);
        setShowHistory(false);
        onCompleted();
      } else {
        const data = await res.json();
        setMsg(data.error || "No pudimos guardar el control. Intentá de nuevo.");
        setMsgType("critical");
      }
    } catch {
      setMsg("No pudimos guardar el control. Intentá de nuevo.");
      setMsgType("critical");
    } finally {
      setLoading(false);
    }
  }

  async function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history.length > 0) return; // already loaded

    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/checkups/${item.id}/history`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.completions || []);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  }

  const lastDate = item.last_completed_at
    ? new Date(item.last_completed_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{getCategoryEmoji(item.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-800">{item.display_name_es}</h4>
            <CheckupStatusBadge status={item.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{formatFrequency(item.frequency_months)}</p>
          {item.status !== "sin_registro" && item.status !== "sin_frecuencia" && (
            <p className={`text-sm mt-1 ${item.status === "atrasado" ? "text-red-600 font-medium" : item.status === "proximo" ? "text-yellow-600" : "text-gray-600"}`}>
              {getRelativeLabel(item.next_due_at, item.status)}
            </p>
          )}
          {item.status === "sin_frecuencia" && (
            <p className="text-sm text-gray-500 mt-1">
              {lastDate ? `Último: ${lastDate}` : "Sin frecuencia fija — registrá tus visitas para llevar un historial"}
            </p>
          )}
          {item.status === "sin_registro" && (
            <p className="text-sm text-blue-600 mt-1">Sin registro previo</p>
          )}
          {lastDate && item.status !== "sin_frecuencia" && (
            <p className="text-xs text-gray-400 mt-0.5">Último: {lastDate}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="flex-1 py-2.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-xl hover:bg-primary-50 transition min-h-[44px]"
            >
              {hasVisits ? "Registrar nueva visita" : "Marcar como realizado"}
            </button>
            {hasVisits && (
              <button
                onClick={toggleHistory}
                className={`px-3 py-2.5 text-sm border rounded-xl transition min-h-[44px] ${showHistory ? "border-primary-300 bg-primary-50 text-primary-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                title="Ver historial"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <div className="w-full bg-gray-50 rounded-xl p-4 space-y-3">
            <h5 className="text-sm font-semibold text-gray-700">Registrar control</h5>
            <div>
              <label className="block text-xs text-gray-500 mb-1">¿Cuándo lo hiciste?</label>
              <input
                type="date"
                value={completedAt}
                onChange={e => setCompletedAt(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Algún detalle que quieras recordar..."
              />
            </div>
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-300 border border-dashed border-gray-200 rounded-lg cursor-not-allowed"
              title="Próximamente"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Adjuntar archivo — próximamente
            </button>
            {msg && (
              <div className={`p-2 rounded-lg text-xs text-center font-medium ${msgType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {msg}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!completedAt || loading}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition min-h-[44px]"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => { setShowForm(false); setMsg(""); }}
                className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <h5 className="text-xs font-semibold text-gray-500 mb-2">Historial de visitas</h5>
          {historyLoading ? (
            <div className="flex justify-center py-3">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400">Sin visitas registradas</p>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-700">
                      {new Date(h.completed_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {h.notes && <p className="text-xs text-gray-400 mt-0.5">{h.notes}</p>}
                    {h.reported_by && (
                      <span className="text-xs text-gray-400">por {h.reported_by}</span>
                    )}
                  </div>
                  <button
                    disabled
                    className="shrink-0 ml-2 p-1.5 text-gray-300 cursor-not-allowed"
                    title="Próximamente"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
