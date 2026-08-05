function matchesField(field: string, value: number): boolean {
  if (field === "*") return true;

  for (const part of field.split(",")) {
    if (part.includes("-")) {
      const [min, max] = part.split("-").map(Number);
      if (value >= min && value <= max) return true;
    } else {
      if (Number(part) === value) return true;
    }
  }

  return false;
}

export function matches(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minute, hour, dom, month, dow] = parts;

  return (
    matchesField(minute, date.getMinutes()) &&
    matchesField(hour, date.getHours()) &&
    matchesField(dom, date.getDate()) &&
    matchesField(month, date.getMonth() + 1) &&
    matchesField(dow, date.getDay())
  );
}
