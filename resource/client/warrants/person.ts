import { callAction, input, menu, notify } from "@aifivem/lib/client";
import { MENU_BACK, WARRANT_DURATIONS } from "@aifivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/police";
import { readWarrants, timeLeft, type Person, type WarrantItem } from "./read";

/** One person's warrants in the job menu: the list, issuing one (reason, length) and clearing one. */

export const FALLBACK = { fallback: "POLICE_ERR_WARRANT" };

/** Reason, then length; true = back to the person, false = the menus were closed. */
async function issue(person: Person): Promise<boolean> {
  const values = await input({
    title: Locale("POLICE_WARRANT_ADD_TITLE", person.name),
    confirm: Locale("POLICE_WARRANT_NEXT"),
    fields: [
      {
        name: "reason",
        label: Locale("POLICE_WARRANT_REASON"),
        type: "text",
        maxLength: 255,
        placeholder: Locale("POLICE_WARRANT_REASON_PH"),
      },
    ],
  });
  if (!values) return true;
  const reason = String(values.reason ?? "").trim();
  if (reason.length < 3) {
    notify(Locale("POLICE_ERR_WARRANT_REASON"), "error");
    return true;
  }
  const picked = await menu({
    title: Locale("POLICE_WARRANT_LENGTH"),
    back: true,
    items: WARRANT_DURATIONS.map((d) => ({
      id: d.id,
      label: Locale(`POLICE_WARRANT_D_${d.id}`),
      icon: d.minutes === null ? "lock" : "clock",
    })),
  });
  const length = WARRANT_DURATIONS.find((d) => d.id === picked);
  if (!length) return picked === MENU_BACK;
  const reply = await callAction(
    EVENTS.warrantAdd,
    [person.charId, reason, length.minutes],
    FALLBACK,
  );
  if (reply) notify(Locale("POLICE_WARRANT_ADDED", person.name), "success");
  return true;
}

/** Asks before clearing; true = back, false = closed. */
async function clear(warrant: WarrantItem): Promise<boolean> {
  const picked = await menu({
    title: Locale("POLICE_WARRANT_CLEAR_TITLE"),
    back: true,
    items: [
      {
        id: "clear",
        label: Locale("POLICE_WARRANT_CLEAR"),
        description: warrant.reason,
        icon: "check",
      },
    ],
  });
  if (picked !== "clear") return picked === MENU_BACK;
  if (await callAction(EVENTS.warrantClear, [warrant.id], FALLBACK))
    notify(Locale("POLICE_WARRANT_CLEARED"), "success");
  return true;
}

export const describe = (w: WarrantItem, now: number): string =>
  Locale("POLICE_WARRANT_ROW", w.by || "-", timeLeft(w.expires, now));

/** One person's warrants with Issue on top; true = back, false = closed. */
export async function person(who: Person): Promise<boolean> {
  for (;;) {
    const reply = await callAction(EVENTS.warrantsOf, [who.charId], FALLBACK);
    if (!reply) return true;
    const list = readWarrants(reply.warrants);
    const now = typeof reply.now === "number" ? reply.now : Date.now();
    const picked = await menu({
      title: `${who.name} (#${who.citizenid})`,
      back: true,
      items: [
        { id: "issue", label: Locale("POLICE_WARRANT_ADD"), icon: "gavel" },
        ...list.map((w) => ({
          id: String(w.id),
          label: w.reason,
          description: describe(w, now),
          icon: "triangle-exclamation",
        })),
      ],
    });
    if (picked === MENU_BACK) return true;
    if (picked === "issue") {
      if (!(await issue(who))) return false;
    } else {
      const warrant = list.find((w) => String(w.id) === picked);
      if (!warrant || !(await clear(warrant))) return false;
    }
  }
}
