"use client";
import { useRef } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("es", es);

interface DateInputProps {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  maxDate?: Date;
  minDate?: Date;
  compact?: boolean;
}

function toDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DateInput({
  value,
  onChange,
  className,
  placeholder = "DD/MM/AAAA",
  required,
  maxDate,
  minDate,
  compact,
}: DateInputProps) {
  const ref = useRef<DatePicker>(null);

  const baseClass = compact
    ? "w-full px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500 bg-white cursor-pointer"
    : "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] bg-white cursor-pointer";

  return (
    <DatePicker
      ref={ref}
      selected={toDate(value)}
      onChange={(date: Date | null) => {
        if (date) onChange(toIso(date));
        else onChange("");
      }}
      dateFormat="dd/MM/yyyy"
      locale="es"
      placeholderText={placeholder}
      maxDate={maxDate}
      minDate={minDate}
      required={required}
      className={className || baseClass}
      showYearDropdown
      scrollableYearDropdown
      yearDropdownItemNumber={100}
      showMonthDropdown
      isClearable={!required}
      autoComplete="off"
    />
  );
}
