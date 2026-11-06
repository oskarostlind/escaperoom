// lib/order.ts – väljer vilka gåtor ett lag får och i vilken ordning.
import { CLUES, PICK_COUNT, type ClueConfig } from "@/data/clues";

export function activeClues(): ClueConfig[] {
  return CLUES.filter((c) => c.active !== false);
}

/** Slår upp en gåta från ett orderIds-element: id-sträng (nytt) eller index (gamla lag). */
export function resolveClue(entry: unknown, active: ClueConfig[] = activeClues()): ClueConfig | undefined {
  if (typeof entry === "string") {
    const byId = active.find((c) => c.id === entry);
    if (byId) return byId;
    if (/^\d+$/.test(entry)) return active[Number(entry)]; // gamla lag: index lagrat som text
    return undefined;
  }
  if (typeof entry === "number") return active[entry];
  return undefined;
}

/** Alla ordnade urval av k element ur arr (k-permutationer). */
function permutations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest, k - 1)) out.push([x, ...p]);
  });
  return out;
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

/**
 * Bygger ordningen för ett nytt lag: PICK_COUNT slumpade gåtor ur potten (ej `final`)
 * i slumpad ordning + sistafrågan. `used` = ordningar som andra lag redan fått; en
 * ledig ordning väljs i första hand, annars (om alla är tagna) en slumpad.
 */
export function buildOrder(used: unknown[][]): string[] {
  const active = activeClues();
  const pool = active.filter((c) => !c.final).map((c) => c.id);
  const finals = active.filter((c) => c.final).map((c) => c.id);
  const k = Math.min(PICK_COUNT, pool.length);

  const usedKeys = new Set(
    used
      .map((o) => (Array.isArray(o) ? o.map((e) => resolveClue(e, active)?.id ?? String(e)).join("|") : ""))
      .filter(Boolean)
  );

  const all = shuffle(permutations(pool, k)).map((p) => [...p, ...finals]);
  const free = all.find((p) => !usedKeys.has(p.join("|")));
  return free ?? all[0] ?? [...pool.slice(0, k), ...finals];
}
