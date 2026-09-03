import { BUGS } from "../../bugs/library.ts";
import { itemLabel } from "../../bugs/procedures.ts";
import { getRecord, retestSession, type LearnerState } from "../../learner/index.ts";
import { SKINS } from "../assets/palette.ts";
import type { Warmup } from "../game/warmup.ts";

/**
 * A window on the machinery, for playtesting only.
 *
 * The retest is deliberately invisible from the outside — that is the whole
 * mechanic — which makes it invisible to whoever is testing it too. This
 * shows the schedule and marks which warm-up problem is the probe.
 *
 * It appears only when the URL carries ?peek, so a child never meets it, and
 * it is read-only: nothing here can change what the game does.
 */
export function peekEnabled(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").has("peek");
  } catch {
    return false;
  }
}

const MARK: Record<string, string> = {
  unseen: "·",
  diagnosed: "!",
  probation: "~",
  repaired: "✓",
};

export function Peek({ learner, warm }: { learner: LearnerState; warm: Warmup | null }) {
  const rows = BUGS.map((b) => {
    const r = getRecord(learner, b.id);
    const due =
      r.state === "probation"
        ? (r.retestAfter ?? retestSession(b.id, r.probationSince ?? 0))
        : null;
    return { name: SKINS[b.id]?.name ?? b.id, r, due };
  }).filter((x) => x.r.state !== "unseen");

  return (
    <aside className="peek" aria-hidden="true">
      <div className="peek-head">peek · session {learner.sessionIndex}</div>

      {warm && (
        <div className="peek-block">
          <b>warm-up</b>
          {warm.slots.map((s, i) => (
            <div key={i} className={s.retestFor ? "peek-hot" : ""}>
              {i + 1}. {itemLabel(s.item)} = {s.answer}
              {s.retestFor ? `  <- RETEST ${SKINS[s.retestFor]?.name ?? s.retestFor}` : ""}
            </div>
          ))}
          {!warm.retesting && <div className="peek-dim">no retest riding along</div>}
        </div>
      )}

      <div className="peek-block">
        <b>robots</b>
        {rows.length === 0 && <div className="peek-dim">none touched yet</div>}
        {rows.map((x) => (
          <div key={x.r.bugId} className={x.due !== null && x.due <= learner.sessionIndex ? "peek-hot" : ""}>
            {MARK[x.r.state]} {x.name} · {x.r.state}
            {x.r.state === "diagnosed" ? ` streak ${x.r.streak}` : ""}
            {x.due !== null ? ` due s${x.due}` : ""}
            {x.r.retestsFailed > 0 ? ` cracked×${x.r.retestsFailed}` : ""}
          </div>
        ))}
      </div>
    </aside>
  );
}
