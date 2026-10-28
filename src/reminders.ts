import { Platform } from "react-native";
import { State, reportDue } from "./domain";
import { translate } from "./i18n";
export async function refreshReminders(state: State, request = false) {
  if (Platform.OS === "web") throw Error("webNotice");
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("reports", {
      name: translate(state.language, "notifications"),
      importance: N.AndroidImportance.DEFAULT,
    });
  let p = await N.getPermissionsAsync();
  if (!p.granted && request) p = await N.requestPermissionsAsync();
  if (!p.granted) {
    if (request) throw Error("notificationDenied");
    return;
  }
  const existing = await N.getAllScheduledNotificationsAsync();
  for (const item of existing)
    if (item.content.data?.kind === "pond-report")
      await N.cancelScheduledNotificationAsync(item.identifier);
  for (const pond of state.ponds) {
    const due = reportDue(state, pond);
    if (!due?.due) continue;
    let date = new Date(due.due + "T09:00:00");
    if (date.getTime() <= Date.now()) {
      date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
    }
    await N.scheduleNotificationAsync({
      identifier: "pond-report-" + pond.id,
      content: {
        title: translate(state.language, "reportReminderTitle"),
        body: translate(state.language, "reportReminderBody") + " " + pond.name,
        data: { kind: "pond-report", pondId: pond.id },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: "reports",
      },
    });
  }
}
