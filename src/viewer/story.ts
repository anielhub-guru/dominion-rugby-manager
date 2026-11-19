import { h } from "../dom";

/** One story moment: a short, dressed-up announcement shown over the game (a followed player, an event, a milestone). */
export interface Story {
  /** Small tag above the title, such as FOLLOWED. */
  kicker: string;
  /** Colour of the tag: y (yellow), r (red) or g (green, the default). */
  tone?: "y" | "r" | "g";
  title: string;
  /** Main text, one paragraph per entry. */
  lines: string[];
  /** Smaller, dimmer text under the main lines. */
  note?: string;
  /** Optional picture or portrait shown above the title. */
  art?: Node;
  /** Label of the closing button. */
  button?: string;
  /** Runs when the player closes the moment with the button. */
  onDone?: () => void;
}

const dialog = h("dialog", { class: "credits story" });
const queue: Story[] = [];
let current: Story | null = null;
let ready = false;

function showNext() {
  current = queue.shift() ?? null;
  if (!current) return;
  const s = current;
  const done = h("button", { class: "primary" }, s.button ?? "Continue");
  done.onclick = () => {
    dialog.close();
    s.onDone?.();
  };
  dialog.replaceChildren(
    ...(s.art ? [h("div", { class: "story-art" }, s.art)] : []),
    h("div", { class: "story-kicker" }, h("span", { class: `card-chip ${s.tone ?? "y"}` }, s.kicker)),
    h("h2", {}, s.title),
    ...s.lines.map((l) => h("p", {}, l)),
    ...(s.note ? [h("p", { class: "dim" }, s.note)] : []),
    done,
  );
  if (!dialog.open) dialog.showModal();
}

/** Shows a story moment. If one is already open, the next waits its turn, so two events in a row never stack. */
export function showStory(story: Story) {
  if (!ready) {
    document.body.append(dialog);
    dialog.addEventListener("close", showNext);
    ready = true;
  }
  queue.push(story);
  if (!dialog.open) if (!dialog.open) queueMicrotask(() => { if (!dialog.open) showNext(); });
}

export const storyOpen = () => dialog.open;
