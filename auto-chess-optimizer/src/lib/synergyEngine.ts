import { SYNERGY_LIST } from "@/data/synergies";
import type { SynergyDef, SynergyId, Unit } from "@/data/types";

export const UNIT_POWER_PER_COST = 3;

/** Divinity の排他判定から除外する種族シナジー */
const DIVINITY_EXCLUSION_IGNORED: ReadonlySet<SynergyId> = new Set([
  "divinity",
  "demon",
  "wizard",
]);

export type DisabledReason = "demon-conflict" | "divinity-exclusive";

export interface SynergyResult {
  def: SynergyDef;
  /** 同名駒を除外した種類数 */
  count: number;
  /** Wizard(2) の軽減を反映した各ティアの必要数 */
  thresholds: number[];
  /** 駒数だけで到達しているティア(-1 は未到達) */
  naturalTierIndex: number;
  /** 特殊ルール適用後の最終ティア(-1 は非発動) */
  tierIndex: number;
  active: boolean;
  disabledReason?: DisabledReason;
  boostedByWizard4: boolean;
  score: number;
}

export interface BoardFlags {
  wizardCount: number;
  wizardReduction: boolean;
  wizard4Applied: boolean;
  wizard4Target: SynergyId | null;
  demonDisabled: boolean;
  demonRescuedByHunters: boolean;
  divinityDisabled: boolean;
}

export interface ScoreBreakdown {
  synergy: number;
  unitPower: number;
  total: number;
}

export interface BoardEvaluation {
  uniqueUnits: Unit[];
  /** count > 0 のシナジー(発動中→スコア降順) */
  synergies: SynergyResult[];
  active: SynergyResult[];
  flags: BoardFlags;
  score: ScoreBreakdown;
}

export const uniqueById = (units: readonly Unit[]): Unit[] => {
  const seen = new Set<string>();
  return units.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
};

export const countSynergies = (
  units: readonly Unit[],
): Map<SynergyId, number> => {
  const counts = new Map<SynergyId, number>();
  for (const u of uniqueById(units)) {
    for (const id of [...u.races, ...u.classes]) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
};

export const effectiveThresholds = (
  def: SynergyDef,
  wizardReduction: boolean,
): number[] =>
  def.tiers.map((t) =>
    wizardReduction && def.id !== "wizard" && t.count >= 4 ? t.count - 1 : t.count,
  );

const reachedTierIndex = (count: number, thresholds: number[]): number => {
  let idx = -1;
  thresholds.forEach((th, i) => {
    if (count >= th) idx = i;
  });
  return idx;
};

export const evaluateBoard = (units: readonly Unit[]): BoardEvaluation => {
  const uniqueUnits = uniqueById(units);
  const counts = countSynergies(uniqueUnits);
  const wizardCount = counts.get("wizard") ?? 0;
  const wizardReduction = wizardCount >= 2;

  const results: SynergyResult[] = SYNERGY_LIST.filter(
    (def) => (counts.get(def.id) ?? 0) > 0,
  ).map((def) => {
    const count = counts.get(def.id) ?? 0;
    const thresholds = effectiveThresholds(def, wizardReduction);
    const naturalTierIndex = reachedTierIndex(count, thresholds);
    return {
      def,
      count,
      thresholds,
      naturalTierIndex,
      tierIndex: naturalTierIndex,
      active: naturalTierIndex >= 0,
      boostedByWizard4: false,
      score: 0,
    };
  });
  const byId = new Map(results.map((r) => [r.def.id, r]));
  const disable = (r: SynergyResult | undefined, reason: DisabledReason) => {
    if (!r || !r.active) return;
    r.active = false;
    r.tierIndex = -1;
    r.disabledReason = reason;
  };

  const demonCount = counts.get("demon") ?? 0;
  const hunterCount = counts.get("demonHunter") ?? 0;
  const demonConflict = demonCount >= 2;
  const demonRescuedByHunters = demonConflict && hunterCount >= 2;
  if (demonConflict && !demonRescuedByHunters) disable(byId.get("demon"), "demon-conflict");

  const otherRaceActive = results.some(
    (r) => r.active && r.def.kind === "race" && !DIVINITY_EXCLUSION_IGNORED.has(r.def.id),
  );
  const divinity = byId.get("divinity");
  const divinityDisabled = Boolean(divinity?.active && otherRaceActive);
  if (divinityDisabled) disable(divinity, "divinity-exclusive");

  let wizard4Target: SynergyId | null = null;
  if (wizardCount >= 4) {
    const others = results.filter((r) => r.active && r.def.id !== "wizard");
    if (others.length === 1) {
      const target = others[0];
      target.tierIndex = target.def.tiers.length - 1;
      target.boostedByWizard4 = target.tierIndex !== target.naturalTierIndex;
      wizard4Target = target.def.id;
    }
  }

  for (const r of results) {
    r.score = r.active ? r.def.tiers[r.tierIndex].score : 0;
  }
  results.sort(
    (a, b) => Number(b.active) - Number(a.active) || b.score - a.score || b.count - a.count,
  );

  const synergyScore = results.reduce((sum, r) => sum + r.score, 0);
  const unitPower = uniqueUnits.reduce((sum, u) => sum + u.cost * UNIT_POWER_PER_COST, 0);

  return {
    uniqueUnits,
    synergies: results,
    active: results.filter((r) => r.active),
    flags: {
      wizardCount,
      wizardReduction,
      wizard4Applied: wizard4Target !== null,
      wizard4Target,
      demonDisabled: demonConflict && !demonRescuedByHunters && demonCount > 0,
      demonRescuedByHunters,
      divinityDisabled,
    },
    score: { synergy: synergyScore, unitPower, total: synergyScore + unitPower },
  };
};
