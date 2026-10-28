import React, {
  useEffect,
  useState,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase, preferredLanguage, rememberLanguage } from "./supabase";
import { selectFarm, readCloud, cloudContext } from "./cloud";
import { teamWords } from "./teamWords";
import { Language } from "./domain";
export const cloudWords = {
  en: {
    title: "Your farm, connected",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    farm: "Farm name",
    create: "Create farm",
    choose: "Choose your farm",
    account: "Your account ID — share with your admin",
    waiting: "Workers: ask your admin to add your account and assign ponds.",
    verify: "Check your email to confirm your account, then sign in.",
    error: "Could not connect. Check your connection and try again.",
    setup:
      "Database update needed. Apply the pending migration in your Pond Companion project, then retry.",
    retry: "Retry",
    refresh: "Refresh farm",
    connected: "Cloud farm · internet required to save",
    conflict: "Another user changed this farm. Refresh farm, then try again.",
    save: "Save to farm",
    saved: "Saved to farm",
    staff: "Worker access",
    worker: "Worker account ID",
    assign: "Save pond assignments",
    assigned: "Worker access saved.",
    backup: "Export earlier local records",
    import: "Import earlier local records",
    importHelp:
      "Import is available only into an empty farm. Your original local copy is retained.",
    importDone: "Local records imported.",
    empty: "No earlier local ponds found.",
    permissions: "Worker · assigned ponds only",
    admin: "Admin",
    passwordHint: "Use at least 8 characters.",
    credentials: "Enter a valid email and password.",
    choosePonds:
      "Choose ponds this worker can access. Clear all to remove pond access.",
    language: "Language",
  },
  te: {
    title: "మీ ఫారం, అనుసంధానం",
    email: "ఈమెయిల్",
    password: "పాస్‌వర్డ్",
    signIn: "లాగిన్",
    signUp: "ఖాతా సృష్టించండి",
    signOut: "లాగ్ అవుట్",
    farm: "ఫారం పేరు",
    create: "ఫారం సృష్టించండి",
    choose: "మీ ఫారం ఎంచుకోండి",
    account: "మీ ఖాతా ID — అడ్మిన్‌కు ఇవ్వండి",
    waiting:
      "కార్మికులు: మీ ఖాతాను జోడించి చెరువులు కేటాయించమని అడ్మిన్‌ను అడగండి.",
    verify: "ఈమెయిల్‌లో ఖాతాను నిర్ధారించి లాగిన్ అవ్వండి.",
    error: "కనెక్ట్ కాలేదు. ఇంటర్నెట్ తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
    setup:
      "డేటాబేస్ నవీకరణ అవసరం. Pond Companion ప్రాజెక్ట్‌లో పెండింగ్ మైగ్రేషన్ అమలు చేసి మళ్లీ ప్రయత్నించండి.",
    retry: "మళ్లీ ప్రయత్నించండి",
    refresh: "ఫారం వివరాలు నవీకరించండి",
    connected: "క్లౌడ్ ఫారం · సేవ్ చేయడానికి ఇంటర్నెట్ అవసరం",
    conflict: "ఇంకొకరు వివరాలు మార్చారు. ఫారం నవీకరించి మళ్లీ ప్రయత్నించండి.",
    save: "ఫారంలో సేవ్ చేయండి",
    saved: "ఫారంలో సేవ్ అయింది",
    staff: "కార్మికుల అనుమతులు",
    worker: "కార్మికుడి ఖాతా ID",
    assign: "చెరువుల కేటాయింపు సేవ్ చేయండి",
    assigned: "అనుమతులు సేవ్ అయ్యాయి.",
    backup: "పాత స్థానిక రికార్డులు ఎగుమతి చేయండి",
    import: "పాత స్థానిక రికార్డులు దిగుమతి చేయండి",
    importHelp:
      "ఖాళీ ఫారంలో మాత్రమే దిగుమతి చేయవచ్చు. పాత స్థానిక కాపీ అలాగే ఉంటుంది.",
    importDone: "స్థానిక రికార్డులు దిగుమతి అయ్యాయి.",
    empty: "పాత స్థానిక చెరువులు లేవు.",
    permissions: "కార్మికుడు · కేటాయించిన చెరువులు మాత్రమే",
    admin: "అడ్మిన్",
    passwordHint: "కనీసం 8 అక్షరాలు వాడండి.",
    credentials: "సరైన ఈమెయిల్ మరియు పాస్‌వర్డ్ ఇవ్వండి.",
    choosePonds:
      "ఈ కార్మికుడు చూడగల చెరువులు ఎంచుకోండి. అనుమతి తీసివేయడానికి అన్నీ తొలగించండి.",
    language: "భాష",
  },
  hi: {
    title: "आपका फ़ार्म, जुड़ा हुआ",
    email: "ईमेल",
    password: "पासवर्ड",
    signIn: "लॉग इन",
    signUp: "खाता बनाएँ",
    signOut: "लॉग आउट",
    farm: "फ़ार्म का नाम",
    create: "फ़ार्म बनाएँ",
    choose: "अपना फ़ार्म चुनें",
    account: "आपका खाता ID — एडमिन को दें",
    waiting: "कर्मचारी: एडमिन से अपना खाता जोड़ने और तालाब सौंपने को कहें।",
    verify: "ईमेल में खाते की पुष्टि करें, फिर लॉग इन करें।",
    error: "कनेक्ट नहीं हुआ। इंटरनेट जाँचें और दोबारा कोशिश करें।",
    setup:
      "डेटाबेस अपडेट ज़रूरी है। Pond Companion प्रोजेक्ट में लंबित माइग्रेशन चलाएँ, फिर कोशिश करें।",
    retry: "फिर कोशिश करें",
    refresh: "फ़ार्म अपडेट करें",
    connected: "क्लाउड फ़ार्म · सेव करने के लिए इंटरनेट चाहिए",
    conflict: "किसी ने फ़ार्म बदला है। अपडेट करें, फिर कोशिश करें।",
    save: "फ़ार्म में सेव करें",
    saved: "फ़ार्म में सेव हो गया",
    staff: "कर्मचारी की पहुँच",
    worker: "कर्मचारी का खाता ID",
    assign: "तालाब की पहुँच सेव करें",
    assigned: "पहुँच सेव हो गई।",
    backup: "पुराने स्थानीय रिकॉर्ड निर्यात करें",
    import: "पुराने स्थानीय रिकॉर्ड आयात करें",
    importHelp:
      "केवल खाली फ़ार्म में आयात कर सकते हैं। स्थानीय कॉपी सुरक्षित रहेगी।",
    importDone: "स्थानीय रिकॉर्ड आयात हो गए।",
    empty: "पुराने स्थानीय तालाब नहीं मिले।",
    permissions: "कर्मचारी · केवल सौंपे गए तालाब",
    admin: "एडमिन",
    passwordHint: "कम से कम 8 अक्षर रखें।",
    credentials: "सही ईमेल और पासवर्ड भरें।",
    choosePonds: "कर्मचारी के लिए तालाब चुनें। पहुँच हटाने के लिए सभी हटाएँ।",
    language: "भाषा",
  },
};
export const words = (l: Language | null) => cloudWords[l || "en"];
const FarmNavigation = createContext(() => {});
export const useFarmNavigation = () => useContext(FarmNavigation);
export function CloudGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(!supabase),
    [active, setActive] = useState(""),
    [farms, setFarms] = useState<
      { id: string; name: string; memberships: { role: string }[] }[]
    >([]),
    [lang, setLang] = useState<Language>("en"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [intent, setIntent] = useState<"owner" | "worker" | null>(null),
    [code, setCode] = useState(""),
    [more, setMore] = useState(false),
    [farmsReady, setFarmsReady] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const w = words(lang);
  const tw = teamWords(lang);
  const currentUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void preferredLanguage().then((l) => {
      if (alive) setLang(l);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          setReady(true);
          if (error) setMessage(cloudWords.en.error);
        }
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          setMessage(cloudWords.en.error);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      if (currentUser.current !== s?.user.id) {
        selectFarm(null);
        setActive("");
        setFarms([]);
        setFarmsReady(false);
        setMore(false);
        setIntent(
          s?.user.user_metadata?.onboarding_role === "worker"
            ? "worker"
            : s?.user.user_metadata?.onboarding_role === "owner"
              ? "owner"
              : null,
        );
        currentUser.current = s?.user.id;
      }
      setSession(s);
      setReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function list() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name,memberships!inner(role)")
        .eq("memberships.user_id", session!.user.id)
        .order("created_at");
      if (error) throw error;
      setFarms(data || []);
      setFarmsReady(true);
    } catch {
      setMessage(w.setup);
    } finally {
      setBusy(false);
    }
  }
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || !supabase) return;
    let alive = true;
    supabase
      .from("organizations")
      .select("id,name,memberships!inner(role)")
      .eq("memberships.user_id", userId)
      .order("created_at")
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) setMessage(words(lang).setup);
        else {
          setFarms(data || []);
          if (data?.length === 1) {
            selectFarm({ org: data[0].id, userId, role: "worker" }, lang);
            try {
              await readCloud();
              if (alive) setActive(data[0].id);
            } catch {
              if (alive) {
                selectFarm(null);
                setMessage(words(lang).error);
              }
            }
          }
        }
        if (alive) setFarmsReady(true);
      });
    return () => {
      alive = false;
    };
  }, [userId, lang]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e: any) {
      setMessage(
        e?.message?.includes("schema cache") || e?.code === "PGRST202"
          ? w.setup
          : w.error,
      );
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, fn: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={fn}
      style={[s.button, busy && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    secure = false,
  ) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        style={s.input}
      />
    </View>
  );
  if (!supabase) return <>{children}</>;
  if (!ready)
    return (
      <View style={s.page}>
        <ActivityIndicator />
      </View>
    );
  if (session && active && cloudContext()?.org === active)
    return (
      <FarmNavigation.Provider
        key={session.user.id + active}
        value={() => {
          setActive("");
          setMore(false);
          void list();
        }}
      >
        {children}
      </FarmNavigation.Provider>
    );
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.card}>
        <Text style={s.title}>Pond Companion</Text>
        <Text style={s.subtitle}>{w.title}</Text>
        <View style={s.row}>
          {(["en", "te", "hi"] as Language[]).map((l) => (
            <Pressable
              key={l}
              accessibilityRole="button"
              onPress={() => {
                setLang(l);
                void rememberLanguage(l).catch(() => {});
              }}
              style={s.lang}
            >
              <Text>
                {l === "en" ? "English" : l === "te" ? "తెలుగు" : "हिन्दी"}
                {lang === l ? " ✓" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
        {!session ? (
          <>
            {signup && (
              <>
                <Text style={s.subtitle}>{tw.role}</Text>
                {button(`${intent === "owner" ? "✓ " : ""}${tw.owner}`, () =>
                  setIntent("owner"),
                )}
                {button(`${intent === "worker" ? "✓ " : ""}${tw.worker}`, () =>
                  setIntent("worker"),
                )}
                {intent && (
                  <Text>
                    {intent === "owner" ? tw.ownerHelp : tw.workerHelp}
                  </Text>
                )}
              </>
            )}
            {field(w.email, email, setEmail)}
            {field(w.password, password, setPassword, true)}
            <Text>{w.passwordHint}</Text>
            {!signup &&
              button(w.signIn, () =>
                run(async () => {
                  if (!email.includes("@") || !password) {
                    setMessage(w.credentials);
                    return;
                  }
                  const { error } = await supabase!.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  });
                  if (error) {
                    setMessage(
                      error.code === "invalid_credentials"
                        ? w.credentials
                        : w.error,
                    );
                    return;
                  }
                  setPassword("");
                }),
              )}
            {signup &&
              button(w.signUp, () =>
                run(async () => {
                  if (!intent) {
                    setMessage(tw.role);
                    return;
                  }
                  if (!email.includes("@") || password.length < 8) {
                    setMessage(w.credentials);
                    return;
                  }
                  const { data, error } = await supabase!.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { data: { onboarding_role: intent } },
                  });
                  if (error) throw error;
                  setPassword("");
                  if (!data.session) {
                    setMessage(w.verify);
                    setSignup(false);
                  }
                }),
              )}
            {button(signup ? tw.account : tw.newAccount, () => {
              setSignup(!signup);
              setMessage("");
            })}
          </>
        ) : (
          <>
            {!farmsReady && <ActivityIndicator />}
            {!!farms.length && <Text style={s.subtitle}>{w.choose}</Text>}
            {farms.map((f) => (
              <View key={f.id}>
                {button(
                  `${f.name} · ${f.memberships.some((m) => ["owner", "manager"].includes(m.role)) ? w.admin : w.permissions}`,
                  () =>
                    run(async () => {
                      selectFarm(
                        { org: f.id, userId: session.user.id, role: "worker" },
                        lang,
                      );
                      try {
                        await readCloud();
                        setActive(f.id);
                      } catch (e) {
                        selectFarm(null);
                        throw e;
                      }
                    }),
                )}
              </View>
            ))}
            {farmsReady && (farms.length === 0 || more) && (
              <>
                <Text style={s.subtitle}>{tw.role}</Text>
                {button(`${intent === "owner" ? "✓ " : ""}${tw.owner}`, () =>
                  setIntent("owner"),
                )}
                {button(`${intent === "worker" ? "✓ " : ""}${tw.worker}`, () =>
                  setIntent("worker"),
                )}
                {intent && (
                  <Text>
                    {intent === "owner" ? tw.ownerHelp : tw.workerHelp}
                  </Text>
                )}
                {intent === "worker" && (
                  <>
                    {field(tw.code, code, setCode)}
                    {button(tw.join, () =>
                      run(async () => {
                        if (!code.trim()) {
                          setMessage(tw.joinError);
                          return;
                        }
                        const { data, error } = await supabase!.rpc(
                          "join_worker_farm",
                          { invite_code: code.trim() },
                        );
                        if (error) {
                          setMessage(
                            error.code === "PGRST202" ? w.setup : tw.joinError,
                          );
                          return;
                        }
                        selectFarm(
                          {
                            org: data,
                            role: "worker",
                            userId: session.user.id,
                          },
                          lang,
                        );
                        await readCloud();
                        setCode("");
                        setActive(data);
                      }),
                    )}
                  </>
                )}
                {intent === "owner" && (
                  <>
                    {field(w.farm, name, setName)}
                    {button(w.create, () =>
                      run(async () => {
                        if (!name.trim()) return;
                        const { data, error } = await supabase!.rpc(
                          "create_organization",
                          { org_name: name.trim() },
                        );
                        if (error) throw error;
                        selectFarm(
                          { org: data, role: "admin", userId: session.user.id },
                          lang,
                        );
                        await readCloud();
                        setActive(data);
                      }),
                    )}
                  </>
                )}
              </>
            )}
            {farmsReady &&
              !!farms.length &&
              !more &&
              button(tw.more, () => {
                setMore(true);
                setIntent(null);
              })}
            {button(tw.refresh, () => void list())}
            {button(w.signOut, () =>
              run(async () => {
                const { error } = await supabase!.auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
                selectFarm(null);
                setActive("");
              }),
            )}
          </>
        )}
        {message ? (
          <Text accessibilityRole="alert" style={s.message}>
            {message}
          </Text>
        ) : null}
        {busy ? <ActivityIndicator /> : null}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#f4f6f2",
    padding: 24,
    paddingTop: 56,
    alignItems: "center",
  },
  card: { width: "100%", maxWidth: 480, gap: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#205e45" },
  subtitle: { fontSize: 21, fontWeight: "600", color: "#233b30" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  lang: { padding: 12, backgroundColor: "#e2eddb", borderRadius: 12 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#879d8b",
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    minHeight: 52,
  },
  button: {
    backgroundColor: "#205e45",
    padding: 16,
    borderRadius: 14,
    minHeight: 52,
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  message: { backgroundColor: "#fff1d6", padding: 16, fontSize: 16 },
  id: { fontSize: 15, backgroundColor: "white", padding: 12 },
});
