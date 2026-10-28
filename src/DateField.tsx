import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { isDate, Language, today } from "./domain";
export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  language: Language | null;
  minimum?: string;
  disabled?: boolean;
};
// Calendar dates use local components, never UTC conversion.
const localDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};
export function DateField({
  label,
  value,
  onChange,
  language,
  minimum,
  disabled,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const date = localDate(isDate(value) ? value : today());
  const props = {
    value: date,
    mode: "date" as const,
    minimumDate: minimum ? localDate(minimum) : undefined,
    maximumDate: localDate(today()),
    onValueChange: (_event: unknown, selected: Date) => {
      setOpen(false);
      onChange(
        `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`,
      );
    },
    onDismiss: () => setOpen(false),
  };
  return (
    <View style={{ marginVertical: 10, gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#233b30" }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        disabled={disabled}
        onPress={() => {
          if (Platform.OS === "android") DateTimePickerAndroid.open(props);
          else setOpen(!open);
        }}
        style={{
          minHeight: 54,
          borderWidth: 1,
          borderColor: "#879d8b",
          borderRadius: 12,
          padding: 14,
          backgroundColor: "white",
        }}
      >
        <Text style={{ fontSize: 18, color: "#233b30" }}>
          {date.toLocaleDateString(
            language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN",
            { day: "numeric", month: "short", year: "numeric" },
          )}{" "}
          ▦
        </Text>
      </Pressable>
      {Platform.OS !== "android" && open && (
        <DateTimePicker {...props} display="inline" locale={language || "en"} />
      )}
    </View>
  );
}
