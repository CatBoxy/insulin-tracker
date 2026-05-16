"use client";
import { useState, useEffect, useCallback } from "react";
import CheckupCard from "./CheckupCard";
import CheckupSection from "./CheckupSection";

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

const STATUS_ORDER = ["atrasado", "sin_registro", "proximo", "al_dia", "sin_frecuencia"];

export default function CheckupList({
  variant,
  patientId,
  apiBase,
}: {
  variant: "full" | "compact";
  patientId?: number;
  apiBase?: string;
}) {
  const [checkups, setCheckups] = useState<CheckupItem[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const url = apiBase
    ? `${apiBase}/checkups`
    : "/api/checkups";

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCheckups(data.checkups || []);
        setPendingRequestIds(data.pending_request_ids || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (checkups.length === 0) return null;

  // Group by status
  const grouped: Record<string, CheckupItem[]> = {};
  for (const c of checkups) {
    if (!grouped[c.status]) grouped[c.status] = [];
    grouped[c.status].push(c);
  }

  if (variant === "compact") {
    // Show first overdue + first próximo only
    const highlights: CheckupItem[] = [];
    if (grouped.atrasado?.length) highlights.push(grouped.atrasado[0]);
    if (grouped.proximo?.length) highlights.push(grouped.proximo[0]);
    if (highlights.length === 0 && grouped.sin_registro?.length) highlights.push(grouped.sin_registro[0]);

    if (highlights.length === 0) return null;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">🩺 Seguimiento médico</h3>
          <a href="/dashboard/seguimiento" className="text-sm text-primary-600 hover:underline">
            Ver todos
          </a>
        </div>
        <div className="space-y-3">
          {highlights.map(item => (
            <CheckupCard key={item.id} item={item} onCompleted={load} hasPendingRequest={pendingRequestIds.includes(item.id)} />
          ))}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className="space-y-8">
      {STATUS_ORDER.map(status =>
        grouped[status]?.length ? (
          <CheckupSection key={status} status={status}>
            {grouped[status].map(item => (
              <CheckupCard key={item.id} item={item} onCompleted={load} hasPendingRequest={pendingRequestIds.includes(item.id)} />
            ))}
          </CheckupSection>
        ) : null
      )}
    </div>
  );
}
