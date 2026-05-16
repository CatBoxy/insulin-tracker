"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const FAMILY_CONDITIONS = [
  { key: "cancer", label: "Cáncer" },
  { key: "hipertension", label: "Hipertensión" },
  { key: "diabetes", label: "Diabetes" },
  { key: "problemas_cardiacos", label: "Problemas cardíacos" },
  { key: "problemas_renales", label: "Problemas renales" },
  { key: "tiroides", label: "Tiroides" },
  { key: "problemas_hepaticos", label: "Problemas hepáticos" },
];

const PERSONAL_CONDITIONS = [
  { key: "alergia_medicamentos", label: "Alergia a medicamentos" },
  { key: "cancer", label: "Cáncer" },
  { key: "hipertension", label: "Hipertensión" },
  { key: "diabetes", label: "Diabetes" },
  { key: "problemas_cardiacos", label: "Problemas cardíacos" },
  { key: "problemas_renales", label: "Problemas renales" },
  { key: "tiroides", label: "Tiroides" },
  { key: "problemas_hepaticos", label: "Problemas hepáticos" },
  { key: "otros", label: "Otros" },
];

interface ConditionState {
  checked: boolean;
  notes: string;
}

interface MedicationState {
  condition: string;
  text: string;
}

export default function HistoriaClinicaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [familyHistory, setFamilyHistory] = useState<Record<string, ConditionState>>(
    Object.fromEntries(FAMILY_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }]))
  );

  const [personalHistory, setPersonalHistory] = useState<Record<string, ConditionState>>(
    Object.fromEntries(PERSONAL_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }]))
  );

  const [medications, setMedications] = useState<MedicationState[]>([]);

  // Load existing data if editing
  const loadExisting = useCallback(async () => {
    try {
      const res = await fetch("/api/medical-history", { credentials: "include" });
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();

      if (data.familyHistory?.length) {
        const fh: Record<string, ConditionState> = { ...familyHistory };
        for (const entry of data.familyHistory) {
          if (fh[entry.condition]) {
            fh[entry.condition] = { checked: entry.has_condition, notes: entry.notes || "" };
          }
        }
        setFamilyHistory(fh);
      }

      if (data.personalHistory?.length) {
        const ph: Record<string, ConditionState> = { ...personalHistory };
        for (const entry of data.personalHistory) {
          if (ph[entry.condition]) {
            ph[entry.condition] = { checked: entry.has_condition, notes: entry.notes || "" };
          }
        }
        setPersonalHistory(ph);
      }

      if (data.medications?.length) {
        setMedications(data.medications.map((m: { condition: string; medication_text: string }) => ({
          condition: m.condition,
          text: m.medication_text,
        })));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  // Build medications list based on personal conditions checked
  useEffect(() => {
    const activeConditions = Object.entries(personalHistory)
      .filter(([, v]) => v.checked && true)
      .map(([key]) => key);

    setMedications(prev => {
      const updated: MedicationState[] = [];
      for (const condition of activeConditions) {
        const existing = prev.find(m => m.condition === condition);
        updated.push({ condition, text: existing?.text || "" });
      }
      return updated;
    });
  }, [personalHistory]);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/medical-history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyHistory: Object.entries(familyHistory).map(([condition, state]) => ({
            condition,
            has_condition: state.checked,
            notes: state.notes || null,
          })),
          personalHistory: Object.entries(personalHistory).map(([condition, state]) => ({
            condition,
            has_condition: state.checked,
            notes: state.notes || null,
          })),
          medications: medications
            .filter(m => m.text.trim())
            .map(m => ({ condition: m.condition, medication_text: m.text })),
        }),
      });

      if (res.ok) {
        setMsg("Historia clínica guardada correctamente");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        const data = await res.json();
        setMsg(data.error || "Error al guardar");
      }
    } catch {
      setMsg("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  function toggleFamily(key: string) {
    setFamilyHistory(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }

  function setFamilyNotes(key: string, notes: string) {
    setFamilyHistory(prev => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  }

  function togglePersonal(key: string) {
    setPersonalHistory(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }

  function setPersonalNotes(key: string, notes: string) {
    setPersonalHistory(prev => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  }

  function setMedicationText(condition: string, text: string) {
    setMedications(prev => prev.map(m => m.condition === condition ? { ...m, text } : m));
  }

  function conditionLabel(key: string): string {
    return [...FAMILY_CONDITIONS, ...PERSONAL_CONDITIONS].find(c => c.key === key)?.label || key;
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const hasPersonalConditions = Object.values(personalHistory).some(v => v.checked);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Historia Clínica</h1>
            <p className="text-xs text-gray-500">Paso {step} de 3</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary-500" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Step 1: Family History */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Antecedentes Familiares</h2>
            <p className="text-sm text-gray-500 mb-6">Indicá si algún familiar tuvo alguna de estas condiciones</p>
            <div className="space-y-4">
              {FAMILY_CONDITIONS.map(({ key, label }) => (
                <div key={key}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={familyHistory[key].checked}
                      onChange={() => toggleFamily(key)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                  {familyHistory[key].checked && (
                    <input
                      type="text"
                      value={familyHistory[key].notes}
                      onChange={e => setFamilyNotes(key, e.target.value)}
                      placeholder="Detalles (ej: madre, abuela materna...)"
                      className="mt-2 ml-8 w-[calc(100%-2rem)] px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Personal History */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Antecedentes Personales</h2>
            <p className="text-sm text-gray-500 mb-6">Indicá si tenés o tuviste alguna de estas condiciones</p>
            <div className="space-y-4">
              {PERSONAL_CONDITIONS.map(({ key, label }) => (
                <div key={key}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={personalHistory[key].checked}
                      onChange={() => togglePersonal(key)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                  {personalHistory[key].checked && (
                    <input
                      type="text"
                      value={personalHistory[key].notes}
                      onChange={e => setPersonalNotes(key, e.target.value)}
                      placeholder={key === "alergia_medicamentos" ? "Detallá a qué medicamentos" : key === "otros" ? "Describí la condición" : "Detalles adicionales (opcional)"}
                      className="mt-2 ml-8 w-[calc(100%-2rem)] px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-gray-600 border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Anterior
              </button>
              <button
                onClick={() => setStep(3)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Medications */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Medicación Actual</h2>
            <p className="text-sm text-gray-500 mb-6">
              {hasPersonalConditions
                ? "Indicá qué medicamentos tomás para cada condición"
                : "No marcaste condiciones personales. Si no tomás medicación, podés guardar directamente."
              }
            </p>
            {hasPersonalConditions ? (
              <div className="space-y-4">
                {medications.map(med => (
                  <div key={med.condition}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {conditionLabel(med.condition)}
                    </label>
                    <input
                      type="text"
                      value={med.text}
                      onChange={e => setMedicationText(med.condition, e.target.value)}
                      placeholder="Ej: Metformina 850mg, Losartán 50mg..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin condiciones personales marcadas</p>
            )}

            {msg && (
              <div className={`mt-4 p-3 rounded-lg text-sm text-center font-medium ${msg.includes("correctamente") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {msg}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="text-gray-600 border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Anterior
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
