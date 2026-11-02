import { callAction, input, menu, notify } from "@aifivem/lib/client";
import { MENU_BACK } from "@aifivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/police";
import { describe, FALLBACK, person } from "./person";
import { readPeople, readWarrants } from "./read";

/**
 * The job menu's Warrants entry (lib `menu` / `input`): find a person and see, issue or clear their warrants, or page
 * through every active warrant. Every step is a sub menu: a short Escape goes back one step (the functions answer
 * true), holding Escape closes everything (false). The server checks the duty on every call.
 */

/** Name or citizenid, then the people found; true = back, false = closed. */
async function find(): Promise<boolean> {
  const values = await input({
    title: Locale("POLICE_WARRANT_FIND"),
    confirm: Locale("POLICE_WARRANT_SEARCH"),
    fields: [
      {
        name: "text",
        label: Locale("POLICE_WARRANT_NAME"),
        type: "text",
        maxLength: 64,
        placeholder: Locale("POLICE_WARRANT_NAME_PH"),
      },
    ],
  });
  if (!values) return true;
  const reply = await callAction(
    EVENTS.warrantSearch,
    [String(values.text ?? "")],
    FALLBACK,
  );
  if (!reply) return true;
  const people = readPeople(reply.people);
  if (people.length === 0) {
    notify(Locale("POLICE_WARRANT_NOBODY"), "error");
    return true;
  }
  for (;;) {
    const picked = await menu({
      title: Locale("POLICE_WARRANT_RESULTS"),
      back: true,
      items: people.map((p) => ({
        id: String(p.charId),
        label: p.name,
        description: `#${p.citizenid}`,
        icon: "user",
      })),
    });
    if (picked === MENU_BACK) return true;
    const who = people.find((p) => String(p.charId) === picked);
    if (!who || !(await person(who))) return false;
  }
}

/** Every active warrant, newest first, a page at a time; picking one opens that person. */
async function active(): Promise<boolean> {
  const pages: Array<number | null> = [null];
  for (;;) {
    const cursor = pages[pages.length - 1] ?? null;
    const reply = await callAction(EVENTS.warrantList, [cursor], FALLBACK);
    if (!reply) return true;
    const list = readWarrants(reply.warrants);
    const next = typeof reply.next === "number" ? reply.next : null;
    const now = typeof reply.now === "number" ? reply.now : Date.now();
    const picked = await menu({
      title: Locale("POLICE_WARRANT_ACTIVE"),
      back: true,
      items: [
        ...list.map((w) => ({
          id: String(w.id),
          label: Locale(
            "POLICE_WARRANT_LIST_ROW",
            w.person?.name ?? "",
            w.reason,
          ),
          description: describe(w, now),
          icon: "triangle-exclamation",
        })),
        ...(next === null
          ? []
          : [
              {
                id: "more",
                label: Locale("POLICE_WARRANT_MORE"),
                icon: "list",
              },
            ]),
      ],
    });
    if (picked === MENU_BACK) {
      if (pages.length === 1) return true;
      pages.pop();
    } else if (picked === "more") pages.push(next);
    else {
      const who = list.find((w) => String(w.id) === picked)?.person;
      if (!who || !(await person(who))) return false;
    }
  }
}

/** The Warrants sub menu; resolves `MENU_BACK` when the player went back to the job menu. */
export async function warrantsMenu(): Promise<string | null> {
  for (;;) {
    const picked = await menu({
      title: Locale("POLICE_WARRANTS_TITLE"),
      back: true,
      items: [
        { id: "find", label: Locale("POLICE_WARRANT_FIND"), icon: "id-card" },
        { id: "active", label: Locale("POLICE_WARRANT_ACTIVE"), icon: "list" },
      ],
    });
    const stay =
      picked === "find"
        ? await find()
        : picked === "active"
          ? await active()
          : null;
    if (stay === null) return picked;
    if (!stay) return null;
  }
}
