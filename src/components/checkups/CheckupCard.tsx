"use client";
import { useState, useRef, useEffect, useCallback } from "react";
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
  attachment_count: number;
}

interface AttachmentEntry {
  id: number;
  cloudinary_url: string;
  original_filename: string;
  file_type: string;
  parse_status: string | null;
  document_type: string | null;
  parsed_data: ParsedLabData | null;
  confidence_score: number | null;
  error_message: string | null;
}

interface ParsedLabData {
  tests?: Array<{
    name: string;
    value: number | string;
    unit: string | null;
    reference_range: string | null;
    flag: "normal" | "high" | "low" | "unknown";
  }>;
  study_type?: string;
  findings?: string;
  impressions?: string;
  summary?: string;
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
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
    const fecha = due.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" });
    return `En ${diffDays} días · ${fecha}`;
  }
  const fecha = due.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" });
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

function getFlagColor(flag: string) {
  switch (flag) {
    case "high": return "text-red-600 bg-red-50";
    case "low": return "text-blue-600 bg-blue-50";
    case "normal": return "text-green-600 bg-green-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

function getFlagLabel(flag: string) {
  switch (flag) {
    case "high": return "Alto";
    case "low": return "Bajo";
    case "normal": return "Normal";
    default: return "—";
  }
}

export default function CheckupCard({
  item,
  onCompleted,
  hasPendingRequest = false,
}: {
  item: CheckupItem;
  onCompleted: () => void;
  hasPendingRequest?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "critical">("success");

  // Files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CompletionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Attachments for history entries
  const [expandedCompletion, setExpandedCompletion] = useState<number | null>(null);
  const [completionAttachments, setCompletionAttachments] = useState<Record<number, AttachmentEntry[]>>({});
  const [attachmentsLoading, setAttachmentsLoading] = useState<number | null>(null);

  // Upload to existing completion
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const historyFileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  // Request order
  const [requestPending, setRequestPending] = useState(hasPendingRequest);
  const [requestLoading, setRequestLoading] = useState(false);

  const hasVisits = item.last_completed_at !== null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const total = selectedFiles.length + files.length;
    if (total > 10) {
      setMsg("Máximo 10 archivos");
      setMsgType("critical");
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setLoading(true);
    setMsg("");
    try {
      const date = new Date(completedAt + "T12:00:00");

      let res: Response;
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append("completed_at", date.toISOString());
        if (notes) formData.append("notes", notes);
        selectedFiles.forEach(f => formData.append("files", f));
        res = await fetch(`/api/checkups/${item.id}/complete`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } else {
        res = await fetch(`/api/checkups/${item.id}/complete`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completed_at: date.toISOString(),
            notes: notes || undefined,
          }),
        });
      }

      if (res.ok) {
        setMsg("Control registrado");
        setMsgType("success");
        setShowForm(false);
        setNotes("");
        setSelectedFiles([]);
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
    if (history.length > 0) return;

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

  async function loadAttachments(completionId: number) {
    if (expandedCompletion === completionId) {
      setExpandedCompletion(null);
      return;
    }
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

  const refreshAttachments = useCallback(async (completionId: number) => {
    try {
      const res = await fetch(`/api/checkups/completions/${completionId}/attachments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCompletionAttachments(prev => ({ ...prev, [completionId]: data.attachments || [] }));
      }
    } catch { /* ignore */ }
  }, []);

  // Poll for parse completion when any attachment is pending/processing
  useEffect(() => {
    if (expandedCompletion === null) return;
    const atts = completionAttachments[expandedCompletion];
    if (!atts) return;
    const hasPending = atts.some(a => a.parse_status === "pending" || a.parse_status === "processing");
    if (!hasPending) return;

    const interval = setInterval(() => refreshAttachments(expandedCompletion), 4000);
    return () => clearInterval(interval);
  }, [expandedCompletion, completionAttachments, refreshAttachments]);

  async function handleRetryParse(attachmentId: number, completionId: number) {
    try {
      const res = await fetch(`/api/attachments/${attachmentId}/retry-parse`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh attachments for this completion
        setCompletionAttachments(prev => {
          const updated = { ...prev };
          delete updated[completionId];
          return updated;
        });
        setExpandedCompletion(null);
        setTimeout(() => loadAttachments(completionId), 2000);
      }
    } catch { /* ignore */ }
  }

  async function handleRequestOrder() {
    setRequestLoading(true);
    try {
      const res = await fetch(`/api/checkups/${item.id}/request`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setRequestPending(true);
        setMsg("Orden solicitada. Tu médico fue notificado.");
        setMsgType("success");
      } else {
        const data = await res.json();
        if (res.status === 409) {
          setRequestPending(true);
        }
        setMsg(data.error || "No pudimos enviar la solicitud.");
        setMsgType(res.status === 409 ? "success" : "critical");
      }
    } catch {
      setMsg("No pudimos enviar la solicitud. Intentá de nuevo.");
      setMsgType("critical");
    } finally {
      setRequestLoading(false);
    }
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
        // Refresh attachments and history
        setCompletionAttachments(prev => {
          const updated = { ...prev };
          delete updated[uploadTargetId];
          return updated;
        });
        // Update attachment count in history
        setHistory(prev => prev.map(h =>
          h.id === uploadTargetId ? { ...h, attachment_count: h.attachment_count + files.length } : h
        ));
        setExpandedCompletion(uploadTargetId);
        loadAttachments(uploadTargetId);
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

  const lastDate = item.last_completed_at
    ? new Date(item.last_completed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })
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
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
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

            {/* File upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-primary-600 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Adjuntar archivo
              </button>
              <p className="text-xs text-gray-400 mt-1">Imágenes o PDF (máx. 10 archivos, 10 MB c/u)</p>
            </div>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                {loading ? (selectedFiles.length > 0 ? "Subiendo archivos..." : "Guardando...") : "Guardar"}
              </button>
              <button
                onClick={() => { setShowForm(false); setMsg(""); setSelectedFiles([]); }}
                className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        </div>
        {/* Solicitar orden button */}
        {!showForm && (
          <button
            onClick={handleRequestOrder}
            disabled={requestPending || requestLoading}
            className={`w-full py-2.5 text-sm font-medium rounded-xl transition min-h-[44px] flex items-center justify-center gap-2 ${
              requestPending
                ? "bg-amber-50 text-amber-600 border border-amber-200 cursor-default"
                : "text-amber-700 border border-amber-200 hover:bg-amber-50"
            }`}
          >
            {requestLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full" />
            ) : requestPending ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Orden solicitada
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Solicitar orden
              </>
            )}
          </button>
        )}
        {msg && !showForm && (
          <div className={`p-2 rounded-lg text-xs text-center font-medium ${msgType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg}
          </div>
        )}
      </div>

      {/* Hidden file input for history uploads */}
      <input
        ref={historyFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        multiple
        onChange={handleHistoryFileSelect}
        className="hidden"
      />

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
                <div key={h.id}>
                  <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">
                        {new Date(h.completed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/San_Juan" })} {new Date(h.completed_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/San_Juan" })}
                      </p>
                      {h.notes && <p className="text-xs text-gray-400 mt-0.5">{h.notes}</p>}
                      {h.reported_by && (
                        <span className="text-xs text-gray-400">por {h.reported_by}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uploadingFor === h.id ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary-600">
                        <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                        Subiendo...
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerHistoryUpload(h.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition min-h-[36px]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Adjuntar archivo
                      </button>
                    )}
                    {h.attachment_count > 0 && (
                      <button
                        onClick={() => loadAttachments(h.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition min-h-[36px] ${expandedCompletion === h.id ? "border-primary-300 bg-primary-50 text-primary-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Ver archivos ({h.attachment_count})
                      </button>
                    )}
                  </div>

                  {/* Expanded attachments */}
                  {expandedCompletion === h.id && (
                    <div className="ml-4 mt-2 mb-2 space-y-2">
                      {attachmentsLoading === h.id ? (
                        <div className="flex justify-center py-2">
                          <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                        </div>
                      ) : (
                        (completionAttachments[h.id] || []).map(att => (
                          <div key={att.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {/* File info */}
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
                                <a href={att.cloudinary_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-primary-600 hover:underline truncate block">
                                  {att.original_filename}
                                </a>
                                {att.parse_status === "completed" && att.document_type && (
                                  <span className="text-xs text-gray-400">
                                    {att.document_type === "lab_results" ? "Resultados de laboratorio" :
                                     att.document_type === "imaging" ? "Estudio por imágenes" :
                                     att.document_type === "prescription" ? "Receta" : "Documento"}
                                    {att.confidence_score ? ` · ${Math.round(att.confidence_score * 100)}% confianza` : ""}
                                  </span>
                                )}
                                {att.parse_status === "processing" && (
                                  <span className="text-xs text-amber-500">Procesando...</span>
                                )}
                                {att.parse_status === "pending" && (
                                  <span className="text-xs text-gray-400">En cola...</span>
                                )}
                                {att.parse_status === "failed" && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-500">Error al procesar</span>
                                    <button onClick={() => handleRetryParse(att.id, h.id)} className="text-xs text-primary-500 hover:underline">
                                      Reintentar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Parsed lab results */}
                            {att.parse_status === "completed" && att.parsed_data?.tests && att.parsed_data.tests.length > 0 && (
                              <div className="border-t border-gray-200 pt-2">
                                <div className="space-y-1">
                                  {att.parsed_data.tests.map((test, ti) => (
                                    <div key={ti} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600 truncate flex-1">{test.name}</span>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="font-medium text-gray-800">{test.value} {test.unit || ""}</span>
                                        {test.reference_range && <span className="text-gray-400">({test.reference_range})</span>}
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getFlagColor(test.flag)}`}>
                                          {getFlagLabel(test.flag)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Parsed imaging/other */}
                            {att.parse_status === "completed" && att.parsed_data?.findings && (
                              <div className="border-t border-gray-200 pt-2">
                                <p className="text-xs text-gray-600">{att.parsed_data.findings}</p>
                                {att.parsed_data.impressions && (
                                  <p className="text-xs text-gray-500 mt-1 italic">{att.parsed_data.impressions}</p>
                                )}
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
  );
}
