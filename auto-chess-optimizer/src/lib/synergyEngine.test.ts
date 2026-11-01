import { describe, expect, it } from "vitest";
import type { ClassId, RaceId, SynergyId, Unit } from "@/data/types";
import { getUnit, UNITS } from "@/data/units";
import { evaluateBoard, type BoardEvaluation } from "./synergyEngine";

let seq = 0;
const mk = (races: RaceId[], classes: ClassId[], id = `t${seq++}`): Unit => ({
  id,
  name: id,
  nameJa: id,
  cost: 1,
  races,
  classes,
});
const many = (n: number, races: RaceId[], classes: ClassId[]): Unit[] =>
  Array.from({ length: n }, () => mk(races, classes));

/** 種族が重ならないウィザード(各種族1体ずつなので種族シナジーは発動しない) */
const wizards = (n: number): Unit[] =>
  (["marine", "human", "glacier", "caves"] as RaceId[]).slice(0, n).map((r) => mk([r], ["wizard"]));

const syn = (ev: BoardEvaluation, id: SynergyId) => ev.synergies.find((s) => s.def.id === id);
const activeTierCount = (ev: BoardEvaluation, id: SynergyId): number | null => {
  const s = syn(ev, id);
  return s?.active ? s.def.tiers[s.tierIndex].count : null;
};

describe("同名駒の除外", () => {
  it("同じIDの駒は何体いてもシナジーカウント1", () => {
    const knight = mk(["human"], ["knight"], "dup");
    const ev = evaluateBoard([knight, knight, knight]);
    expect(syn(ev, "knight")?.count).toBe(1);
    expect(syn(ev, "human")?.count).toBe(1);
    expect(ev.active).toHaveLength(0);
    expect(ev.uniqueUnits).toHaveLength(1);
  });

  it("同名駒はユニット戦力にも1体分だけ計上される", () => {
    const u = getUnit("lord-of-light");
    expect(evaluateBoard([u, u]).score.unitPower).toBe(evaluateBoard([u]).score.unitPower);
  });
});

describe("Demon & Demon Hunter", () => {
  it("Demonが1種類なら発動する", () => {
    const ev = evaluateBoard([mk(["demon"], ["assassin"])]);
    expect(activeTierCount(ev, "demon")).toBe(1);
  });

  it("Demonが2種類以上だと無効化される", () => {
    const ev = evaluateBoard(many(2, ["demon"], ["assassin"]));
    expect(syn(ev, "demon")?.active).toBe(false);
    expect(syn(ev, "demon")?.disabledReason).toBe("demon-conflict");
    expect(ev.flags.demonDisabled).toBe(true);
  });

  it("Demon Hunterが2種類以上いれば複数Demonでも有効", () => {
    const ev = evaluateBoard([...many(3, ["demon"], ["warlock"]), ...many(2, ["human"], ["demonHunter"])]);
    expect(activeTierCount(ev, "demon")).toBe(1);
    expect(ev.flags.demonRescuedByHunters).toBe(true);
  });

  it("Demon Hunterが1種類では救済されない", () => {
    const ev = evaluateBoard([...many(2, ["demon"], ["warlock"]), mk(["human"], ["demonHunter"])]);
    expect(syn(ev, "demon")?.active).toBe(false);
  });

  it("同名のDemonが2体いても1種類扱いで発動する", () => {
    const d = getUnit("hellfire-hexer");
    expect(activeTierCount(evaluateBoard([d, d]), "demon")).toBe(1);
  });
});

describe("Wizard(2) の必要数軽減", () => {
  it("Glacier(4)が3体で発動する", () => {
    const glaciers = many(3, ["glacier"], ["knight"]);
    expect(activeTierCount(evaluateBoard(glaciers), "glacier")).toBe(2);
    const ev = evaluateBoard([...glaciers, ...wizards(2)]);
    expect(activeTierCount(ev, "glacier")).toBe(4);
    expect(ev.flags.wizardReduction).toBe(true);
  });

  it("Warrior(9)が8体で発動する", () => {
    const warriors = many(8, ["human"], ["warrior"]).map((u, i) => ({
      ...u,
      races: [(["glacier", "caves", "feathered", "feathered", "divinity", "demon", "marine", "human"] as RaceId[])[i]],
    }));
    expect(activeTierCount(evaluateBoard(warriors), "warrior")).toBe(6);
    expect(activeTierCount(evaluateBoard([...warriors, ...wizards(2)]), "warrior")).toBe(9);
  });

  it("必要数が4未満のティアは軽減されない", () => {
    const ev = evaluateBoard([...many(2, ["feathered"], ["warrior"]), ...wizards(2)]);
    expect(syn(ev, "feathered")?.active).toBe(false);
    expect(syn(ev, "warrior")?.active).toBe(false);
    expect(syn(ev, "warrior")?.thresholds).toEqual([3, 5, 8]);
  });

  it("Wizard自身の必要数は軽減しない", () => {
    expect(activeTierCount(evaluateBoard(wizards(3)), "wizard")).toBe(2);
  });

  it("Wizardが1種類では軽減されない", () => {
    const ev = evaluateBoard([...many(3, ["glacier"], ["knight"]), ...wizards(1)]);
    expect(activeTierCount(ev, "glacier")).toBe(2);
  });
});

describe("Wizard(4) の最高ティア即時発動", () => {
  it("他の発動シナジーが1つだけならそれを最大ティアにする (Warrior→9)", () => {
    const warriors = [mk(["feathered"], ["warrior"]), mk(["feathered"], ["warrior"]), mk(["divinity"], ["warrior"])];
    const ev = evaluateBoard([...wizards(4), ...warriors]);
    const warrior = syn(ev, "warrior")!;
    expect(warrior.def.tiers[warrior.tierIndex].count).toBe(9);
    expect(warrior.boostedByWizard4).toBe(true);
    expect(warrior.score).toBe(65);
    expect(ev.flags.wizard4Applied).toBe(true);
    expect(ev.flags.wizard4Target).toBe("warrior");
  });

  it("Divinity(2)をDivinity(4)にする", () => {
    const ev = evaluateBoard([...wizards(4), ...many(2, ["divinity"], ["mage"])]);
    expect(activeTierCount(ev, "divinity")).toBe(4);
    expect(ev.flags.wizard4Target).toBe("divinity");
  });

  it("Mage(3)をMage(9)にする", () => {
    const mages = [mk(["feathered"], ["mage"]), mk(["feathered"], ["mage"]), mk(["divinity"], ["mage"])];
    expect(activeTierCount(evaluateBoard([...wizards(4), ...mages]), "mage")).toBe(9);
  });

  it("他の発動シナジーが2つ以上なら発動しない", () => {
    const ev = evaluateBoard([
      ...wizards(4),
      ...many(3, ["feathered"], ["warrior"]),
    ]);
    expect(ev.flags.wizard4Applied).toBe(false);
    expect(activeTierCount(ev, "warrior")).toBe(3);
    expect(activeTierCount(ev, "feathered")).toBe(3);
  });

  it("他の発動シナジーが0なら何も起きない", () => {
    const ev = evaluateBoard([...wizards(4), mk(["feathered"], ["warrior"])]);
    expect(ev.flags.wizard4Applied).toBe(false);
    expect(ev.active.map((s) => s.def.id)).toEqual(["wizard"]);
  });

  it("Wizardが3種類では発動しない", () => {
    const mages = [mk(["feathered"], ["mage"]), mk(["feathered"], ["mage"]), mk(["divinity"], ["mage"])];
    const ev = evaluateBoard([...wizards(3), ...mages]);
    expect(ev.flags.wizard4Applied).toBe(false);
  });

  it("無効化されたDemonは発動シナジーとして数えない", () => {
    const ev = evaluateBoard([
      ...wizards(4),
      mk(["demon"], ["mage"]),
      mk(["demon"], ["mage"]),
      mk(["feathered"], ["mage"]),
    ]);
    expect(syn(ev, "demon")?.active).toBe(false);
    expect(activeTierCount(ev, "mage")).toBe(9);
  });

  it("無効化されたDivinityの代わりに残った種族シナジーを最大化する", () => {
    const ev = evaluateBoard([
      ...wizards(4),
      mk(["divinity"], ["knight"]),
      mk(["divinity"], ["warlock"]),
      mk(["marine"], ["assassin"]),
    ]);
    expect(syn(ev, "divinity")?.disabledReason).toBe("divinity-exclusive");
    expect(activeTierCount(ev, "marine")).toBe(4);
    expect(ev.flags.wizard4Target).toBe("marine");
  });
});

describe("Divinity の排他条件", () => {
  const gods = () => [mk(["divinity"], ["mage"]), mk(["divinity"], ["knight"])];

  it("他の種族シナジーが発動していなければ有効", () => {
    expect(activeTierCount(evaluateBoard(gods()), "divinity")).toBe(2);
  });

  it("他の種族シナジーが1つでも発動すると無効", () => {
    const ev = evaluateBoard([...gods(), ...many(2, ["human"], ["warrior"])]);
    expect(syn(ev, "divinity")?.active).toBe(false);
    expect(syn(ev, "divinity")?.disabledReason).toBe("divinity-exclusive");
    expect(activeTierCount(ev, "human")).toBe(2);
    expect(ev.flags.divinityDisabled).toBe(true);
  });

  it("未発動の種族(1体だけ)は排他条件に影響しない", () => {
    const ev = evaluateBoard([...gods(), mk(["human"], ["warrior"])]);
    expect(activeTierCount(ev, "divinity")).toBe(2);
  });

  it("クラスシナジーは発動してもよい", () => {
    const ev = evaluateBoard([
      ...many(2, ["divinity"], ["knight"]),
      mk(["human"], ["knight"]),
      mk(["glacier"], ["knight"]),
    ]);
    expect(activeTierCount(ev, "divinity")).toBe(2);
    expect(activeTierCount(ev, "knight")).toBe(4);
  });

  it("Demonは排他条件から除外される", () => {
    const ev = evaluateBoard([...gods(), mk(["demon"], ["assassin"])]);
    expect(activeTierCount(ev, "divinity")).toBe(2);
    expect(activeTierCount(ev, "demon")).toBe(1);
  });

  it("Wizard(2)の軽減でDivinity(4)が3体で発動する", () => {
    const ev = evaluateBoard([...many(3, ["divinity"], ["knight"]), ...wizards(2)]);
    expect(activeTierCount(ev, "divinity")).toBe(4);
  });
});

describe("スコア", () => {
  it("合計 = シナジー + 駒戦力", () => {
    const board = UNITS.slice(0, 8);
    const ev = evaluateBoard(board);
    expect(ev.score.total).toBe(ev.score.synergy + ev.score.unitPower);
    expect(ev.score.synergy).toBe(ev.active.reduce((s, a) => s + a.score, 0));
  });

  it("発動中シナジーが先頭に並ぶ", () => {
    const ev = evaluateBoard(UNITS.slice(0, 10));
    const firstInactive = ev.synergies.findIndex((s) => !s.active);
    if (firstInactive >= 0) {
      expect(ev.synergies.slice(firstInactive).every((s) => !s.active)).toBe(true);
    }
  });
});
