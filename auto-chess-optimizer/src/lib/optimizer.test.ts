import { describe, expect, it } from "vitest";
import { SYNERGY_LIST } from "@/data/synergies";
import { getUnit, UNITS } from "@/data/units";
import type { Unit } from "@/data/types";
import { optimizeFormation, strategyBonus } from "./optimizer";
import { evaluateBoard } from "./synergyEngine";

const ids = (units: Unit[]) => units.map((u) => u.id);

const combinations = <T,>(items: T[], k: number): T[][] => {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
};

describe("サンプルデータ", () => {
  it("25〜31体のユニットとIDの一意性", () => {
    expect(UNITS.length).toBeGreaterThanOrEqual(25);
    expect(UNITS.length).toBeLessThanOrEqual(31);
    expect(new Set(ids(UNITS)).size).toBe(UNITS.length);
  });

  it("全シナジーに所属ユニットが存在する", () => {
    for (const def of SYNERGY_LIST) {
      const members = UNITS.filter((u) => [...u.races, ...u.classes].includes(def.id));
      expect(members.length, def.id).toBeGreaterThan(0);
    }
  });

  it("Wizard(4)とDemon Hunter(2)が成立可能な数だけ存在する", () => {
    expect(UNITS.filter((u) => u.classes.includes("wizard")).length).toBeGreaterThanOrEqual(4);
    expect(UNITS.filter((u) => u.classes.includes("demonHunter")).length).toBeGreaterThanOrEqual(2);
    expect(UNITS.filter((u) => u.races.includes("divinity")).length).toBeGreaterThanOrEqual(4);
  });
});

describe("optimizeFormation", () => {
  const locked = ["sword-saint", "frostblade", "stone-brute"].map(getUnit);

  it.each([8, 9, 10] as const)("目標%i枠の上位5編成を返す", (targetSize) => {
    const { formations } = optimizeFormation({ lockedUnits: locked, targetSize });
    expect(formations).toHaveLength(5);
    for (const f of formations) {
      expect(f.units).toHaveLength(targetSize);
      expect(ids(f.lockedUnits)).toEqual(ids(locked));
      expect(f.addedUnits).toHaveLength(targetSize - locked.length);
      expect(new Set(ids(f.units)).size).toBe(targetSize);
      expect(f.objective).toBe(f.evaluation.score.total + f.strategyBonus);
    }
    const objectives = formations.map((f) => f.objective);
    expect([...objectives].sort((a, b) => b - a)).toEqual(objectives);
    expect(new Set(formations.map((f) => ids(f.addedUnits).sort().join())).size).toBe(5);
  });

  it("固定枠の同名駒は枠を消費するが追加候補には出ない", () => {
    const dup = [getUnit("sword-saint"), getUnit("sword-saint")];
    const { formations } = optimizeFormation({ lockedUnits: dup, targetSize: 8 });
    expect(formations[0].units).toHaveLength(8);
    expect(formations[0].addedUnits).toHaveLength(6);
    expect(ids(formations[0].addedUnits)).not.toContain("sword-saint");
  });

  it("固定枠が目標枠以上ならそのまま評価する", () => {
    const board = UNITS.slice(0, 9);
    const { formations } = optimizeFormation({ lockedUnits: board, targetSize: 8 });
    expect(formations).toHaveLength(1);
    expect(formations[0].addedUnits).toHaveLength(0);
    expect(formations[0].evaluation.score.total).toBe(evaluateBoard(board).score.total);
  });

  it("小さな問題では全探索の最適解と一致する", () => {
    const pool = UNITS.slice(0, 16);
    const lockedSmall = pool.slice(0, 4);
    const rest = pool.slice(4);
    const brute = Math.max(
      ...combinations(rest, 4).map((c) => evaluateBoard([...lockedSmall, ...c]).score.total),
    );
    const { formations } = optimizeFormation({ lockedUnits: lockedSmall, targetSize: 8, pool });
    expect(formations[0].objective).toBe(brute);
  });

  it("神編成優先ではDivinityが発動した編成が最上位に来る", () => {
    const { formations } = optimizeFormation({
      lockedUnits: [getUnit("lord-of-light"), getUnit("sanctum-guardian")],
      targetSize: 9,
      strategy: "divinity",
    });
    const top = formations[0];
    expect(top.evaluation.active.some((s) => s.def.id === "divinity")).toBe(true);
    expect(top.evaluation.flags.divinityDisabled).toBe(false);
    expect(top.archetype === "divinity" || top.archetype === "wizard4").toBe(true);
  });

  it("ウィザード4優先ではWizard(4)の最高ティア発動編成が最上位に来る", () => {
    const { formations } = optimizeFormation({
      lockedUnits: [getUnit("court-magician"), getUnit("tide-oracle")],
      targetSize: 8,
      strategy: "wizard4",
    });
    expect(formations[0].evaluation.flags.wizard4Applied).toBe(true);
    expect(formations[0].archetype).toBe("wizard4");
  });

  it("バランス方針でも特殊ルートが枝刈りで消えない(ルート別ビームの保持)", () => {
    const { formations } = optimizeFormation({
      lockedUnits: [getUnit("court-magician"), getUnit("tide-oracle")],
      targetSize: 8,
      strategy: "balance",
      topK: 300,
    });
    expect(formations.some((f) => f.evaluation.flags.wizard4Applied)).toBe(true);
    expect(formations.some((f) => f.archetype === "divinity")).toBe(true);
  });

  it("方針ボーナスはバランスでは0", () => {
    const ev = evaluateBoard(UNITS.slice(0, 8));
    expect(strategyBonus(ev, "balance")).toBe(0);
  });

  it("空の手持ちから10枠でも実用的な時間で終わる", () => {
    const start = performance.now();
    const { formations, evaluatedStates } = optimizeFormation({ lockedUnits: [], targetSize: 10 });
    expect(formations).toHaveLength(5);
    expect(evaluatedStates).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
