"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CheckupItem {
  id: number;
  code: string;
  display_name_es: string;
  category: string;
  frequency_months: number | null;
  status: string;
}

type EntryChoice = "date" | "never" | "later";

interface OnboardingEntry {
  checkup: CheckupItem;
  choice: EntryChoice;
  date: string;
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case "specialist": return "🩺";
    case "lab": return "🧪";
    case "imaging": return "📷";
    default: return "🍎";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<OnboardingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "critical">("success");

  useEffect(() => {
    async function load() {
      const authRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!authRes.ok) { router.push("/login"); return; }

      const res = await fetch("/api/checkups", { credentials: "include" });
      if (!res.ok) { router.push("/dashboard"); return; }
      const data = await res.json();

      // Show all checkups with fixed frequency that have no prior record
      const pending = (data.checkups || []).filter(
        (c: CheckupItem) => c.status === "sin_registro" && c.frequency_months !== null
      );

      if (pending.length === 0) {
        router.push("/dashboard/seguimiento");
        return;
      }

      setEntries(
        pending.map((c: CheckupItem) => ({
          checkup: c,
          choice: "later" as EntryChoice,
          date: "",
        }))
      );
      setLoading(false);
    }
    load();
  }, [router]);

  function updateEntry(index: number, updates: Partial<OnboardingEntry>) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMsg("");

    const apiEntries = entries
      .filter(e => e.choice !== "later")
      .map(e => ({
        patient_checkup_id: e.checkup.id,
        last_completed_at: e.choice === "date" && e.date
          ? new Date(e.date + "T00:00:00-03:00").toISOString()
          : null,
      }));

    if (apiEntries.length === 0) {
      router.push("/dashboard/seguimiento");
      return;
    }

    try {
      const res = await fetch("/api/checkups/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: apiEntries }),
      });

      if (res.ok) {
        router.push("/dashboard/seguimiento");
      } else {
        const data = await res.json();
        setMsg(data.error || "No pudimos guardar el control. Intentá de nuevo.");
        setMsgType("critical");
      }
    } catch {
      setMsg("No pudimos guardar el control. Intentá de nuevo.");
      setMsgType("critical");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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
          <button onClick={() => router.push("/dashboard/seguimiento")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-bold text-gray-800">Configurá tu seguimiento</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-gray-600">
          Decinos cuándo fue la última vez que te hiciste cada control. Si nunca te hiciste alguno, está bien también.
        </p>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.checkup.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{getCategoryEmoji(entry.checkup.category)}</span>
                <h4 className="text-sm font-semibold text-gray-800">{entry.checkup.display_name_es}</h4>
              </div>

              <div className="space-y-2">
                {/* Option A: Yes, on date */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[44px] ${entry.choice === "date" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name={`choice-${entry.checkup.id}`}
                    checked={entry.choice === "date"}
                    onChange={() => updateEntry(index, { choice: "date" })}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-gray-700">Sí, fue el…</span>
                </label>
                {entry.choice === "date" && (
                  <div className="ml-8">
                    <input
                      type="date"
                      value={entry.date}
                      onChange={e => updateEntry(index, { date: e.target.value })}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                  </div>
                )}

                {/* Option B: Never done it */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[44px] ${entry.choice === "never" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name={`choice-${entry.checkup.id}`}
                    checked={entry.choice === "never"}
                    onChange={() => updateEntry(index, { choice: "never" })}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-gray-700">Aún no me lo hice</span>
                </label>

                {/* Option C: Decide later */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[44px] ${entry.choice === "later" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name={`choice-${entry.checkup.id}`}
                    checked={entry.choice === "later"}
                    onChange={() => updateEntry(index, { choice: "later" })}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-gray-700">Lo decido después</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {msg && (
          <div className={`p-3 rounded-xl text-sm text-center font-medium ${msgType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || entries.some(e => e.choice === "date" && !e.date)}
          className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition text-base min-h-[44px]"
        >
          {submitting ? "Guardando..." : "Guardar y continuar"}
        </button>
      </main>
    </div>
  );
}
