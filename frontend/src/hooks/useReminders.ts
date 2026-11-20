import { useEffect, useState } from "react";
import { api } from "../api";

/** In-app practice reminders (and a browser notification if the parent allowed them). */
export function useReminders(enabled: boolean): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const check = async () => {
      let kids;
      try { kids = await api.children(); } catch { return; }
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const day = (now.getDay() + 6) % 7; // 0 = Monday
      for (const k of kids) {
        if (!k.reminder_time || k.reminder_time !== hhmm) continue;
        if (k.reminder_days.length && !k.reminder_days.includes(day)) continue;
        const key = `melo.reminded.${k.id}.${now.toDateString()}`;
        try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, "1"); } catch { /* ignore */ }
        const text = `Music time for ${k.name}! A short ${k.session_minutes}-minute lesson with Melo.`;
        setMessage(text);
        window.setTimeout(() => setMessage(null), 60000);
        if ("Notification" in window && Notification.permission === "granted") new Notification("Melo", { body: text });
      }
    };
    const id = window.setInterval(check, 30000);
    void check();
    return () => clearInterval(id);
  }, [enabled]);
  return message;
}
