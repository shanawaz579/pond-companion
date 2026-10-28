import { Language } from "./domain";
const copy = {
  en: {
    trash: "Trash",
    remove: "Move to Trash",
    confirm: "Confirm deletion",
    cancel: "Cancel",
    restore: "Restore",
    empty: "Trash is empty.",
    help: "Removed entries are excluded from stock and expense totals. Restore brings them back with their attachments.",
    question: "Move this entry to Trash? You can restore it later.",
    error:
      "Could not update this entry. Check your connection and database migration.",
    conflict: "Farm changed. Refresh the farm and try again.",
    stock:
      "Cannot restore: harvested or lost fish would exceed available stock.",
    deleted: "Moved to Trash",
    restored: "Entry restored",
    date: "Deleted",
    refresh: "Refresh",
  },
  te: {
    trash: "తొలగించిన రికార్డులు",
    remove: "తొలగించిన రికార్డులకు తరలించండి",
    confirm: "తొలగింపును నిర్ధారించండి",
    cancel: "రద్దు",
    restore: "పునరుద్ధరించండి",
    empty: "తొలగించిన రికార్డులు లేవు.",
    help: "తొలగించిన రికార్డులు నిల్వ, ఖర్చు లెక్కల్లో చేరవు. పునరుద్ధరిస్తే ఫోటోలతో సహా తిరిగి వస్తాయి.",
    question: "ఈ రికార్డు తొలగించాలా? తర్వాత పునరుద్ధరించవచ్చు.",
    error: "రికార్డు మార్చలేకపోయాం. ఇంటర్నెట్, డేటాబేస్ నవీకరణ తనిఖీ చేయండి.",
    conflict: "ఫారం మారింది. వివరాలు నవీకరించి మళ్లీ ప్రయత్నించండి.",
    stock:
      "పునరుద్ధరించలేము: పట్టిన లేదా చనిపోయిన చేపల సంఖ్య అందుబాటులో ఉన్న నిల్వను మించుతుంది.",
    deleted: "తొలగించిన రికార్డులకు తరలించాం",
    restored: "రికార్డు పునరుద్ధరించాం",
    date: "తొలగించిన తేదీ",
    refresh: "నవీకరించండి",
  },
  hi: {
    trash: "हटाए गए रिकॉर्ड",
    remove: "ट्रैश में डालें",
    confirm: "हटाने की पुष्टि",
    cancel: "रद्द करें",
    restore: "वापस लाएँ",
    empty: "ट्रैश खाली है।",
    help: "हटाए गए रिकॉर्ड स्टॉक और खर्च में नहीं जुड़ते। वापस लाने पर फ़ोटो भी लौटेंगे।",
    question: "यह रिकॉर्ड ट्रैश में डालें? बाद में वापस ला सकते हैं।",
    error: "रिकॉर्ड अपडेट नहीं हुआ। इंटरनेट और डेटाबेस माइग्रेशन जाँचें।",
    conflict: "फ़ार्म बदल गया है। अपडेट करके फिर कोशिश करें।",
    stock:
      "वापस नहीं ला सकते: पकड़ी गई या मरी मछलियाँ उपलब्ध स्टॉक से अधिक होंगी।",
    deleted: "ट्रैश में डाल दिया",
    restored: "रिकॉर्ड वापस आ गया",
    date: "हटाने की तारीख",
    refresh: "अपडेट करें",
  },
};
export const trashWords = (language: Language | null) => copy[language || "en"];
