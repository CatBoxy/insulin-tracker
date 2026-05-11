"use client";

const statusConfig: Record<string, { label: string; className: string }> = {
  atrasado: { label: "Atrasado", className: "bg-red-100 text-red-700" },
  proximo: { label: "Próximo", className: "bg-yellow-100 text-yellow-700" },
  al_dia: { label: "Al día", className: "bg-green-100 text-green-700" },
  sin_frecuencia: { label: "Sin frecuencia fija", className: "bg-gray-100 text-gray-600" },
  sin_registro: { label: "Sin registro previo", className: "bg-blue-100 text-blue-700" },
};

export default function CheckupStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.sin_registro;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
