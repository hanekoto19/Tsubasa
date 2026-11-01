import { UNITS } from "@/data/units";
import type { SynergyId, Unit } from "@/data/types";
import { evaluateBoard, uniqueById, type BoardEvaluation } from "./synergyEngine";

export type Strategy = "balance" | "divinity" | "wizard4";
export type Route = "balance" | "divinity" | "wizard4";
export type TargetSize = 8 | 9 | 10;

export interface OptimizeOptions {
  lockedUnits: readonly Unit[];
  targetSize: TargetSize | number;
  strategy?: Strategy;
  pool?: readonly Unit[];
  beamWidth?: number;
  topK?: number;
}

export interface Formation {
  units: Unit[];
  lockedUnits: Unit[];
  addedUnits: Unit[];
  evaluation: BoardEvaluation;
  /** 方針ボーナスを含めた並び替え用スコア */
  objective: number;
  strategyBonus: number;
  archetype: Route;
}

export interface OptimizeResult {
  formations: Formation[];
  evaluatedStates: number;
}

interface BeamState {
  added: Unit[];
  key: string;
}

const ROUTES: Route[] = ["balance", "divinity", "wizard4"];

const ROUTE_SHARE: Record<Strategy, Record<Route, number>> = {
  balance: { balance: 0.5, divinity: 0.25, wizard4: 0.25 },
  divinity: { balance: 0.3, divinity: 0.5, wizard4: 0.2 },
  wizard4: { balance: 0.3, divinity: 0.2, wizard4: 0.5 },
};

const isDivinityBoard = (ev: BoardEvaluation): boolean =>
  ev.active.some((s) => s.def.id === "divinity");

export const classifyArchetype = (ev: BoardEvaluation): Route => {
  if (ev.flags.wizard4Applied) return "wizard4";
  if (isDivinityBoard(ev)) return "divinity";
  return "balance";
};

export const strategyBonus = (ev: BoardEvaluation, strategy: Strategy): number => {
  if (strategy === "divinity") {
    const div = ev.active.find((s) => s.def.id === "divinity");
    return div ? 40 + 25 * div.tierIndex : 0;
  }
  if (strategy === "wizard4") return ev.flags.wizard4Applied ? 60 : 0;
  return 0;
};

/**
 * 途中盤面の「伸びしろ」。残り枠で次ティアに届くシナジーを、到達度に応じて加点する。
 */
const growthPotential = (ev: BoardEvaluation, remaining: number): number => {
  if (remaining <= 0) return 0;
  let potential = 0;
  for (const s of ev.synergies) {
    if (s.disabledReason || s.def.id === "demon") continue;
    const next = s.naturalTierIndex + 1;
    if (next >= s.thresholds.length) continue;
    const need = s.thresholds[next] - s.count;
    if (need > remaining) continue;
    const current = s.naturalTierIndex >= 0 ? s.def.tiers[s.naturalTierIndex].score : 0;
    potential += (s.def.tiers[next].score - current) * (s.count / s.thresholds[next]) * 0.6;
  }
  return potential;
};

const countOf = (ev: BoardEvaluation, id: SynergyId): number =>
  ev.synergies.find((s) => s.def.id === id)?.count ?? 0;

const routeHeuristic = (
  route: Route,
  ev: BoardEvaluation,
  remaining: number,
  strategy: Strategy,
): number => {
  const base = ev.score.total + strategyBonus(ev, strategy);
  const potential = growthPotential(ev, remaining);
  if (route === "balance") return base + potential;

  if (route === "divinity") {
    const divinityCount = Math.min(countOf(ev, "divinity"), 4);
    const blockingRaces = ev.active.filter(
      (s) => s.def.kind === "race" && s.def.id !== "divinity" && s.def.id !== "demon",
    ).length;
    const classPotential = growthPotential(
      { ...ev, synergies: ev.synergies.filter((s) => s.def.kind === "class") },
      remaining,
    );
    return base + classPotential + divinityCount * 25 - blockingRaces * 40;
  }

  const wizardCount = Math.min(countOf(ev, "wizard"), 4);
  const others = ev.active.filter((s) => s.def.id !== "wizard");
  const best = others.reduce(
    (max, s) => Math.max(max, s.def.tiers[s.def.tiers.length - 1].score),
    0,
  );
  return base + wizardCount * 30 + best * 0.5 - Math.max(0, others.length - 1) * 35;
};

const stateKey = (added: readonly Unit[]): string =>
  added
    .map((u) => u.id)
    .sort()
    .join("|");

const allocateWidths = (strategy: Strategy, beamWidth: number): Record<Route, number> => {
  const share = ROUTE_SHARE[strategy];
  return {
    balance: Math.max(1, Math.round(beamWidth * share.balance)),
    divinity: Math.max(1, Math.round(beamWidth * share.divinity)),
    wizard4: Math.max(1, Math.round(beamWidth * share.wizard4)),
  };
};

const buildFormation = (
  locked: Unit[],
  added: Unit[],
  strategy: Strategy,
  ev: BoardEvaluation = evaluateBoard([...locked, ...added]),
): Formation => {
  const bonus = strategyBonus(ev, strategy);
  return {
    units: [...locked, ...added],
    lockedUnits: locked,
    addedUnits: added,
    evaluation: ev,
    objective: ev.score.total + bonus,
    strategyBonus: bonus,
    archetype: classifyArchetype(ev),
  };
};

/**
 * 手持ち(固定枠)から目標枠数までの最終編成を、ルート別の多様性付きビームサーチで逆算する。
 * 各ステップで「通常」「神維持」「ウィザード4」の3ルートそれぞれの評価で上位を残し、
 * 単一評価関数では枝刈りされがちな特殊編成を最後まで保持する。
 */
export const optimizeFormation = ({
  lockedUnits,
  targetSize,
  strategy = "balance",
  pool = UNITS,
  beamWidth = 80,
  topK = 5,
}: OptimizeOptions): OptimizeResult => {
  const locked = [...lockedUnits];
  const slots = targetSize - locked.length;
  if (slots <= 0) {
    return { formations: [buildFormation(locked, [], strategy)], evaluatedStates: 1 };
  }

  const lockedIds = new Set(locked.map((u) => u.id));
  const candidates = uniqueById(pool).filter((u) => !lockedIds.has(u.id));
  const widths = allocateWidths(strategy, beamWidth);

  let beam: BeamState[] = [{ added: [], key: "" }];
  const finals = new Map<string, Formation>();
  let evaluatedStates = 0;

  for (let step = 1; step <= slots; step++) {
    const remaining = slots - step;
    const expanded = new Map<string, { state: BeamState; ev: BoardEvaluation }>();

    for (const state of beam) {
      const used = new Set(state.added.map((u) => u.id));
      for (const cand of candidates) {
        if (used.has(cand.id)) continue;
        const added = [...state.added, cand];
        const key = stateKey(added);
        if (expanded.has(key)) continue;
        expanded.set(key, { state: { added, key }, ev: evaluateBoard([...locked, ...added]) });
        evaluatedStates++;
      }
    }

    const entries = [...expanded.values()];
    if (entries.length === 0) break;

    if (remaining === 0) {
      for (const { state, ev } of entries) {
        finals.set(state.key, buildFormation(locked, state.added, strategy, ev));
      }
      break;
    }

    const next = new Map<string, BeamState>();
    for (const route of ROUTES) {
      entries
        .map((e) => ({ e, h: routeHeuristic(route, e.ev, remaining, strategy) }))
        .sort((a, b) => b.h - a.h)
        .slice(0, widths[route])
        .forEach(({ e }) => next.set(e.state.key, e.state));
    }
    beam = [...next.values()];
  }

  const formations = [...finals.values()]
    .sort(
      (a, b) =>
        b.objective - a.objective ||
        b.evaluation.score.synergy - a.evaluation.score.synergy ||
        stateKey(a.addedUnits).localeCompare(stateKey(b.addedUnits)),
    )
    .slice(0, topK);

  return { formations, evaluatedStates };
};
