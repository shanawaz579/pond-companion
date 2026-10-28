import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Key } from "./i18n";
import { speciesKey } from "./domain";
export function SpeciesSelect({
  value,
  options,
  onSelect,
  onCreate,
  t,
  disabled,
}: {
  value: string;
  options: string[];
  onSelect: (s: string) => void;
  onCreate: (s: string) => void;
  t: (k: Key) => string;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(!value);
  const cleaned = query.trim().replace(/\s+/g, " ");
  const matches = options.filter((s) =>
    speciesKey(s).includes(speciesKey(query)),
  );
  const exact = options.find((s) => speciesKey(s) === speciesKey(cleaned));
  const select = (s: string) => {
    onSelect(s);
    setQuery("");
    setExpanded(false);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t("species")}</Text>
      {!!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("changeSpecies")}: ${value}`}
          disabled={disabled}
          onPress={() => setExpanded(!expanded)}
          style={styles.selected}
        >
          <Text style={styles.text}>✓ {value}</Text>
          <Text style={styles.hint}>{t("changeSpecies")}</Text>
        </Pressable>
      )}
      {expanded && (
        <>
          <TextInput
            accessibilityLabel={t("species")}
            placeholder={t("searchSpecies")}
            placeholderTextColor="#657968"
            value={query}
            onChangeText={setQuery}
            editable={!disabled}
            style={styles.input}
            autoCorrect={false}
          />
          <View style={styles.options}>
            {matches.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`${t("selectSpecies")}: ${s}`}
                disabled={disabled}
                style={styles.option}
                onPress={() => select(s)}
              >
                <Text style={styles.text}>{s}</Text>
              </Pressable>
            ))}
          </View>
          {!!cleaned && !exact && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("createSpecies")}: ${cleaned}`}
              disabled={disabled}
              style={styles.create}
              onPress={() => onCreate(cleaned)}
            >
              <Text style={styles.createText}>
                ＋ {t("createSpecies")}: {cleaned}
              </Text>
            </Pressable>
          )}
          <Text style={styles.hint}>{t("speciesHelp")}</Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 10, marginVertical: 8 },
  label: { fontSize: 17, lineHeight: 28, fontWeight: "600", color: "#18372c" },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#becfbd",
    borderRadius: 13,
    padding: 14,
    fontSize: 19,
    color: "#18372c",
    backgroundColor: "#fff",
  },
  options: { gap: 4 },
  option: {
    minHeight: 52,
    justifyContent: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce4d9",
  },
  text: { fontSize: 18, lineHeight: 28, color: "#18372c" },
  hint: { fontSize: 14, lineHeight: 23, color: "#52665b" },
  create: {
    minHeight: 56,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#205e45",
  },
  createText: { fontSize: 17, lineHeight: 28, color: "#fff" },
  selected: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#e5eee2",
    minHeight: 56,
  },
});
