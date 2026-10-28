import React from "react";
import { isDate, today } from "./domain";
import type { DateFieldProps } from "./DateField";
export function DateField({
  label,
  value,
  onChange,
  language,
  minimum,
  disabled,
}: DateFieldProps) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "10px 0",
        fontFamily: "inherit",
        fontSize: 16,
        fontWeight: 600,
        color: "#233b30",
      }}
    >
      {label}
      <input
        type="date"
        aria-label={label}
        lang={language || "en"}
        value={value || today()}
        min={minimum}
        max={today()}
        disabled={disabled}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.();
          } catch {
            /* Browser's calendar icon remains available. */
          }
        }}
        onChange={(event) => {
          const date = event.currentTarget.value;
          if (isDate(date) && date <= today() && (!minimum || date >= minimum))
            onChange(date);
        }}
        style={{
          boxSizing: "border-box",
          width: "100%",
          minWidth: 0,
          minHeight: 54,
          padding: 14,
          border: "1px solid #879d8b",
          borderRadius: 12,
          background: "white",
          color: "#233b30",
          fontFamily: "inherit",
          fontSize: 18,
          colorScheme: "light",
        }}
      />
    </label>
  );
}
