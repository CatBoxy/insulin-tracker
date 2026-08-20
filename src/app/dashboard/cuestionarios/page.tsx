"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface QuestionnaireItem {
  id: number;
  item_order: number;
  prompt: string;
  response_type: "single_choice" | "likert_5" | "numeric" | "free_text";
  options: string[] | null;
  required: boolean;
}

interface Questionnaire {
  id: number;
  code: string;
  title: string;
  description: string | null;
  version: number;
  items?: QuestionnaireItem[];
}

interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  completed_at: string | null;
  code: string;
  title: string;
}

export default function CuestionariosPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/questionnaires", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuestionnaires(data.questionnaires);
      setResponses(data.responses);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(d => { if (d) { setAuthed(true); fetchData(); } })
      .catch(() => router.push("/login"));
  }, [router, fetchData]);

  const openQuestionnaire = async (q: Questionnaire) => {
    try {
      const res = await fetch(`/api/questionnaires/${q.id}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveQuestionnaire(data.questionnaire);
      setAnswers({});
      setError(null);
      setSuccess(null);
    } catch {
      setError("No se pudo cargar el cuestionario");
    }
  };

  const handleSubmit = async () => {
    if (!activeQuestionnaire?.items) return;

    // Validate required items
    const missing = activeQuestionnaire.items.filter(
      item => item.required && !answers[item.id]?.trim()
    );
    if (missing.length > 0) {
      setError("Por favor completa todas las preguntas obligatorias");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([itemId, value]) => ({ itemId: parseInt(itemId, 10), value })),
      };
      const res = await fetch(`/api/questionnaires/${activeQuestionnaire.id}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar");
      }
      setSuccess("Cuestionario enviado correctamente");
      setActiveQuestionnaire(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  const isCompleted = (questionnaireId: number) =>
    responses.some(r => r.questionnaire_id === questionnaireId && r.completed_at);

  if (!authed || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Cuestionarios</h1>
            <p className="text-xs text-gray-500">Instrumentos de autoevaluacion</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}
        {error && !activeQuestionnaire && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {activeQuestionnaire ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{activeQuestionnaire.title}</h2>
              <button
                onClick={() => { setActiveQuestionnaire(null); setError(null); }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Cancelar
              </button>
            </div>
            {activeQuestionnaire.description && (
              <p className="text-sm text-gray-500 mb-6">{activeQuestionnaire.description}</p>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {activeQuestionnaire.items?.map(item => (
                <div key={item.id} className="border-b border-gray-50 pb-4 last:border-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {item.item_order}. {item.prompt}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {item.response_type === "single_choice" && item.options && (
                    <div className="space-y-2">
                      {item.options.map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`item-${item.id}`}
                            value={opt}
                            checked={answers[item.id] === opt}
                            onChange={() => setAnswers(prev => ({ ...prev, [item.id]: opt }))}
                            className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-600">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {item.response_type === "likert_5" && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAnswers(prev => ({ ...prev, [item.id]: String(n) }))}
                          className={`w-12 h-12 rounded-lg border-2 font-semibold text-sm transition-colors ${
                            answers[item.id] === String(n)
                              ? "bg-green-500 border-green-500 text-white"
                              : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}

                  {item.response_type === "numeric" && (
                    <input
                      type="number"
                      value={answers[item.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      placeholder="Ingrese un valor"
                    />
                  )}

                  {item.response_type === "free_text" && (
                    <textarea
                      value={answers[item.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                      placeholder="Escribe tu respuesta..."
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-6 w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Enviando..." : "Enviar respuestas"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {questionnaires.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No hay cuestionarios disponibles</p>
              </div>
            ) : (
              questionnaires.map(q => {
                const completed = isCompleted(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => !completed && openQuestionnaire(q)}
                    disabled={completed}
                    className={`w-full text-left bg-white rounded-xl border shadow-sm p-4 transition-colors ${
                      completed
                        ? "border-green-200 bg-green-50 cursor-default"
                        : "border-gray-100 hover:border-green-300 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{q.title}</h3>
                        {q.description && (
                          <p className="text-sm text-gray-500 mt-1">{q.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">v{q.version}</p>
                      </div>
                      {completed ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Completado
                        </span>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
