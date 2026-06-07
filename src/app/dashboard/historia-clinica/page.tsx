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

const CONDITION_LABELS: Record<string, string> = Object.fromEntries(
  [...FAMILY_CONDITIONS, ...PERSONAL_CONDITIONS].map(c => [c.key, c.label])
);

interface ConditionState { checked: boolean; notes: string }
interface MedicationState { condition: string; text: string }
interface ConditionEntry { condition: string; has_condition: boolean; notes: string | null }
interface MedicationEntry { condition: string; medication_text: string }
interface WeightEntry { id: number; value: number; recorded_at: string }

export default function HistoriaClinicaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);

  // Peso / Altura / IMC
  const [heightCm, setHeightCm] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [heightSaving, setHeightSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [bodyMsg, setBodyMsg] = useState("");

  // Antecedentes data (read-only display)
  const [familyData, setFamilyData] = useState<ConditionEntry[]>([]);
  const [personalData, setPersonalData] = useState<ConditionEntry[]>([]);
  const [medicationsData, setMedicationsData] = useState<MedicationEntry[]>([]);

  // Form state (editing mode)
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [familyHistory, setFamilyHistory] = useState<Record<string, ConditionState>>(
    Object.fromEntries(FAMILY_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }]))
  );
  const [personalHistory, setPersonalHistory] = useState<Record<string, ConditionState>>(
    Object.fromEntries(PERSONAL_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }]))
  );
  const [medications, setMedications] = useState<MedicationState[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [historyRes, heightRes, weightRes] = await Promise.all([
        fetch("/api/medical-history", { credentials: "include" }),
        fetch("/api/patient/height", { credentials: "include" }),
        fetch("/api/measurements?type=weight&limit=10", { credentials: "include" }),
      ]);

      if (!historyRes.ok) { router.push("/login"); return; }

      const history = await historyRes.json();
      setFormCompleted(history.completed);
      setFamilyData(history.familyHistory || []);
      setPersonalData(history.personalHistory || []);
      setMedicationsData(history.medications || []);

      // Pre-fill form state from existing data
      if (history.familyHistory?.length) {
        const fh: Record<string, ConditionState> = Object.fromEntries(
          FAMILY_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }])
        );
        for (const entry of history.familyHistory) {
          if (fh[entry.condition]) {
            fh[entry.condition] = { checked: entry.has_condition, notes: entry.notes || "" };
          }
        }
        setFamilyHistory(fh);
      }
      if (history.personalHistory?.length) {
        const ph: Record<string, ConditionState> = Object.fromEntries(
          PERSONAL_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }])
        );
        for (const entry of history.personalHistory) {
          if (ph[entry.condition]) {
            ph[entry.condition] = { checked: entry.has_condition, notes: entry.notes || "" };
          }
        }
        setPersonalHistory(ph);
      }
      if (history.medications?.length) {
        setMedications(history.medications.map((m: MedicationEntry) => ({
          condition: m.condition, text: m.medication_text,
        })));
      }

      if (heightRes.ok) {
        const h = await heightRes.json();
        if (h.height_cm) setHeightCm(h.height_cm);
      }

      if (weightRes.ok) {
        const w = await weightRes.json();
        setWeightHistory(w.measurements || []);
      }

      // If form not completed, go directly to form mode
      if (!history.completed) setEditingForm(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync medications with personal history in form mode
  useEffect(() => {
    if (!editingForm) return;
    const active = Object.entries(personalHistory)
      .filter(([, v]) => v.checked)
      .map(([key]) => key);
    setMedications(prev => {
      const updated: MedicationState[] = [];
      for (const condition of active) {
        const existing = prev.find(m => m.condition === condition);
        updated.push({ condition, text: existing?.text || "" });
      }
      return updated;
    });
  }, [personalHistory, editingForm]);

  // --- Body metrics handlers ---
  async function saveHeight() {
    if (!heightCm || heightCm < 50 || heightCm > 250) return;
    setHeightSaving(true);
    try {
      await fetch("/api/patient/height", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height_cm: heightCm }),
      });
      setBodyMsg("Altura guardada");
      setTimeout(() => setBodyMsg(""), 3000);
    } catch {}
    finally { setHeightSaving(false); }
  }

  async function saveWeight() {
    if (!weight || weight < 20 || weight > 300) return;
    setWeightSaving(true);
    try {
      const res = await fetch("/api/measurements", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "weight", value: weight }),
      });
      if (res.ok) {
        setBodyMsg("Peso registrado");
        setTimeout(() => setBodyMsg(""), 3000);
        setWeight("");
        // Reload weight history
        const wr = await fetch("/api/measurements?type=weight&limit=10", { credentials: "include" });
        if (wr.ok) { const d = await wr.json(); setWeightHistory(d.measurements || []); }
      }
    } catch {}
    finally { setWeightSaving(false); }
  }

  // --- Form handlers ---
  function toggleFamily(key: string) {
    setFamilyHistory(prev => ({ ...prev, [key]: { ...prev[key], checked: !prev[key].checked } }));
  }
  function setFamilyNotes(key: string, notes: string) {
    setFamilyHistory(prev => ({ ...prev, [key]: { ...prev[key], notes } }));
  }
  function togglePersonal(key: string) {
    setPersonalHistory(prev => ({ ...prev, [key]: { ...prev[key], checked: !prev[key].checked } }));
  }
  function setPersonalNotes(key: string, notes: string) {
    setPersonalHistory(prev => ({ ...prev, [key]: { ...prev[key], notes } }));
  }
  function setMedicationText(condition: string, text: string) {
    setMedications(prev => prev.map(m => m.condition === condition ? { ...m, text } : m));
  }

  async function handleFormSave() {
    setSaving(true);
    setFormMsg("");
    try {
      const res = await fetch("/api/medical-history", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyHistory: Object.entries(familyHistory).map(([condition, state]) => ({
            condition, has_condition: state.checked, notes: state.notes || null,
          })),
          personalHistory: Object.entries(personalHistory).map(([condition, state]) => ({
            condition, has_condition: state.checked, notes: state.notes || null,
          })),
          medications: medications.filter(m => m.text.trim()).map(m => ({
            condition: m.condition, medication_text: m.text,
          })),
        }),
      });
      if (res.ok) {
        setFormMsg("Guardado correctamente");
        setEditingForm(false);
        loadData();
      } else {
        const data = await res.json();
        setFormMsg(data.error || "Error al guardar");
      }
    } catch { setFormMsg("Error de conexión"); }
    finally { setSaving(false); }
  }

  // --- Computed ---
  const imc = heightCm && weightHistory.length > 0
    ? (weightHistory[0].value / ((Number(heightCm) / 100) ** 2)).toFixed(1)
    : null;

  function imcCategory(val: number): { label: string; color: string } {
    if (val < 18.5) return { label: "Bajo peso", color: "text-yellow-600" };
    if (val < 25) return { label: "Normal", color: "text-green-600" };
    if (val < 30) return { label: "Sobrepeso", color: "text-yellow-600" };
    return { label: "Obesidad", color: "text-red-600" };
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const hasPersonalConditions = Object.values(personalHistory).some(v => v.checked);

  // --- FORM MODE ---
  if (editingForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => { if (formCompleted) setEditingForm(false); else router.push("/dashboard"); }} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="font-bold text-gray-800">Antecedentes Médicos</h1>
              <p className="text-xs text-gray-500">Paso {step} de 3</p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex gap-1 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary-500" : "bg-gray-200"}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Antecedentes Familiares</h2>
              <p className="text-sm text-gray-500 mb-6">Indicá si algún familiar tuvo alguna de estas condiciones</p>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-gray-100">
                  <input type="checkbox"
                    checked={!Object.values(familyHistory).some(v => v.checked)}
                    onChange={() => setFamilyHistory(Object.fromEntries(FAMILY_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }])))}
                    className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm font-medium text-gray-500 italic">Ninguno</span>
                </label>
                {FAMILY_CONDITIONS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={familyHistory[key].checked} onChange={() => toggleFamily(key)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </label>
                    {familyHistory[key].checked && (
                      <input type="text" value={familyHistory[key].notes} onChange={e => setFamilyNotes(key, e.target.value)}
                        placeholder="Detalles (ej: madre, abuela materna...)"
                        className="mt-2 ml-8 w-[calc(100%-2rem)] px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setStep(2)} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">Siguiente</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Antecedentes Personales</h2>
              <p className="text-sm text-gray-500 mb-6">Indicá si tenés o tuviste alguna de estas condiciones</p>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer pb-3 border-b border-gray-100">
                  <input type="checkbox"
                    checked={!Object.values(personalHistory).some(v => v.checked)}
                    onChange={() => setPersonalHistory(Object.fromEntries(PERSONAL_CONDITIONS.map(c => [c.key, { checked: false, notes: "" }])))}
                    className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm font-medium text-gray-500 italic">Ninguno</span>
                </label>
                {PERSONAL_CONDITIONS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={personalHistory[key].checked} onChange={() => togglePersonal(key)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </label>
                    {personalHistory[key].checked && (
                      <input type="text" value={personalHistory[key].notes} onChange={e => setPersonalNotes(key, e.target.value)}
                        placeholder={key === "alergia_medicamentos" ? "Detallá a qué medicamentos" : key === "otros" ? "Describí la condición" : "Detalles adicionales (opcional)"}
                        className="mt-2 ml-8 w-[calc(100%-2rem)] px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="text-gray-600 border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Anterior</button>
                <button onClick={() => setStep(3)} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">Siguiente</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Medicación Actual</h2>
              <p className="text-sm text-gray-500 mb-6">
                {hasPersonalConditions ? "Indicá qué medicamentos tomás para cada condición" : "No marcaste condiciones personales. Si no tomás medicación, podés guardar directamente."}
              </p>
              {hasPersonalConditions ? (
                <div className="space-y-4">
                  {medications.map(med => (
                    <div key={med.condition}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{CONDITION_LABELS[med.condition] || med.condition}</label>
                      <input type="text" value={med.text} onChange={e => setMedicationText(med.condition, e.target.value)}
                        placeholder="Ej: Metformina 850mg, Losartán 50mg..."
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin condiciones personales marcadas</p>
              )}
              {formMsg && (
                <div className={`mt-4 p-3 rounded-lg text-sm text-center font-medium ${formMsg.includes("correctamente") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{formMsg}</div>
              )}
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="text-gray-600 border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Anterior</button>
                <button onClick={handleFormSave} disabled={saving} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition">
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- MAIN VIEW ---
  const activeFamilyConditions = familyData.filter(f => f.has_condition);
  const activePersonalConditions = personalData.filter(p => p.has_condition);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-bold text-gray-800">Antecedentes Médicos</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Peso, Altura, IMC */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Datos Corporales</h2>

          {bodyMsg && (
            <div className="bg-green-50 text-green-700 p-2 rounded-lg text-sm text-center mb-4">{bodyMsg}</div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
              <div className="flex gap-2">
                <input
                  type="number" value={heightCm} onChange={e => setHeightCm(e.target.value ? Number(e.target.value) : "")}
                  placeholder="170" min={50} max={250}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={saveHeight} disabled={heightSaving}
                  className="px-3 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition">
                  {heightSaving ? "..." : "Guardar"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <div className="flex gap-2">
                <input
                  type="number" value={weight} onChange={e => setWeight(e.target.value ? Number(e.target.value) : "")}
                  placeholder="70" min={20} max={300} step={0.1}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={saveWeight} disabled={weightSaving}
                  className="px-3 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition">
                  {weightSaving ? "..." : "Registrar"}
                </button>
              </div>
            </div>
          </div>

          {/* IMC Display */}
          {imc && (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Índice de Masa Corporal (IMC)</p>
              <p className="text-2xl font-bold text-gray-800">{imc}</p>
              <p className={`text-sm font-medium ${imcCategory(Number(imc)).color}`}>
                {imcCategory(Number(imc)).label}
              </p>
            </div>
          )}

          {/* Weight history */}
          {weightHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">Últimos registros de peso</p>
              <div className="space-y-1">
                {weightHistory.slice(0, 5).map(w => (
                  <div key={w.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{w.value} kg</span>
                    <span className="text-gray-400">{new Date(w.recorded_at).toLocaleDateString("es-AR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Antecedentes Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Antecedentes</h2>
            <button onClick={() => { setStep(1); setEditingForm(true); }}
              className="text-sm text-primary-600 font-medium hover:underline">
              Editar
            </button>
          </div>

          {/* Family */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Familiares</h3>
            {activeFamilyConditions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Ninguno (seleccionado por el paciente)</p>
            ) : (
              <div className="space-y-1">
                {activeFamilyConditions.map(f => (
                  <div key={f.condition} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 mt-0.5">+</span>
                    <span className="text-gray-700">{CONDITION_LABELS[f.condition] || f.condition}{f.notes ? ` (${f.notes})` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personal */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Personales</h3>
            {activePersonalConditions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Ninguno (seleccionado por el paciente)</p>
            ) : (
              <div className="space-y-1">
                {activePersonalConditions.map(p => (
                  <div key={p.condition} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-500 mt-0.5">+</span>
                    <span className="text-gray-700">{CONDITION_LABELS[p.condition] || p.condition}{p.notes ? ` (${p.notes})` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medications */}
          {medicationsData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Medicación</h3>
              <div className="space-y-1">
                {medicationsData.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500 mt-0.5">+</span>
                    <span className="text-gray-700"><span className="text-gray-400">{CONDITION_LABELS[m.condition] || m.condition}:</span> {m.medication_text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
