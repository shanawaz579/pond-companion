import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage:
            Platform.OS === "web"
              ? undefined
              : {
                  getItem: SecureStore.getItemAsync,
                  setItem: SecureStore.setItemAsync,
                  removeItem: SecureStore.deleteItemAsync,
                },
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
      })
    : null;
if (supabase && Platform.OS !== "web")
  AppState.addEventListener("change", (s) => {
    if (s === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });

// Only a language preference is stored here; farm data stays out of shared device caches.
export async function preferredLanguage(): Promise<"en" | "te" | "hi"> {
  try {
    const value =
      Platform.OS === "web"
        ? localStorage.getItem("pond-language")
        : await SecureStore.getItemAsync("pond-language");
    return value === "te" || value === "hi" ? value : "en";
  } catch {
    return "en";
  }
}
export async function rememberLanguage(value: string) {
  if (Platform.OS === "web") localStorage.setItem("pond-language", value);
  else await SecureStore.setItemAsync("pond-language", value);
}
