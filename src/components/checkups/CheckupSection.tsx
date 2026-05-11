"use client";

const sectionConfig: Record<string, { emoji: string }> = {
  atrasado: { emoji: "🔴" },
  sin_registro: { emoji: "🔵" },
  proximo: { emoji: "🟡" },
  al_dia: { emoji: "🟢" },
  sin_frecuencia: { emoji: "⚪" },
};

const sectionTitles: Record<string, string> = {
  atrasado: "Atrasado",
  sin_registro: "Sin registro previo",
  proximo: "Próximo",
  al_dia: "Al día",
  sin_frecuencia: "Sin frecuencia fija",
};

export default function CheckupSection({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  const config = sectionConfig[status] ?? sectionConfig.sin_registro;
  const title = sectionTitles[status] ?? status;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
        <span>{config.emoji}</span>
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
