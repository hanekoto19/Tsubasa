import { describe, expect, it } from "vitest";
import { KNOWN_CLASSES, KNOWN_RACES, parseCost, splitTraits, toSnakeId } from "./lib/normalize.mjs";
import { buildSynergies, tierScores } from "./lib/synergies.mjs";
import { parseUnits } from "./fetchUnits.mjs";

describe("toSnakeId", () => {
  it.each([
    ["God of War", "god_of_war"],
    ["Winter Chiropteran", "winter_chiropteran"],
    ["Strange Egg", "strange_egg"],
    ["Soul Breaker!", "soul_breaker"],
    ["Caves", "cave"],
  ])("%s → %s", (name, id) => expect(toSnakeId(name)).toBe(id));
});

describe("splitTraits", () => {
  const races = (s) => splitTraits(s, KNOWN_RACES);

  it("連結表記を分割する", () => {
    expect(races("DragonEgersis").ids).toEqual(["dragon", "egersis"]);
    expect(races("HumanBeast").ids).toEqual(["human", "beast"]);
  });

  it("スペース区切り・区切り記号を分割する", () => {
    expect(races("Human Beast").ids).toEqual(["human", "beast"]);
    expect(races("Glacier / Marine").ids).toEqual(["glacier", "marine"]);
  });

  it("複数語の種族名は最長一致で1つとして扱う", () => {
    expect(races("Night Demon").ids).toEqual(["night_demon"]);
    expect(races("NightDemonHuman").ids).toEqual(["night_demon", "human"]);
    expect(races("Demon").ids).toEqual(["demon"]);
  });

  it("Caves と Cave を同じIDにまとめる", () => {
    expect(races("Caves").ids).toEqual(["cave"]);
    expect(races("CaveDwarf").ids).toEqual(["cave", "dwarf"]);
  });

  it("None は空配列", () => {
    expect(splitTraits("None", KNOWN_CLASSES)).toEqual({ ids: [], unknown: [] });
    expect(splitTraits("", KNOWN_CLASSES).ids).toEqual([]);
  });

  it("クラスの Demon Hunter と Hunter を区別する", () => {
    expect(splitTraits("Demon Hunter", KNOWN_CLASSES).ids).toEqual(["demon_hunter"]);
    expect(splitTraits("Hunter", KNOWN_CLASSES).ids).toEqual(["hunter"]);
  });

  it("未知の表記は unknown に入れつつIDとしても残す", () => {
    const r = races("HumanPhantom");
    expect(r.ids).toEqual(["human", "phantom"]);
    expect(r.unknown).toEqual(["Phantom"]);
  });
});

describe("parseCost", () => {
  it.each([
    ["1 Cost", 1],
    ["Cost 3", 3],
    ["cost-5 list", 5],
    ["2金币", 2],
    ["Warrior", null],
  ])("%s → %s", (text, cost) => expect(parseCost(text)).toBe(cost));
});

describe("buildSynergies", () => {
  it("段階スコアは逓増する", () => {
    expect(tierScores([3, 6, 9])).toEqual([15, 42, 81]);
    expect(tierScores([1])).toEqual([10]);
  });

  it("最大必要数4以上をウィザード対象にする(Wizard自身は除く)", () => {
    const { synergies } = buildSynergies();
    const byId = Object.fromEntries(synergies.map((s) => [s.id, s]));
    expect(byId.glacier.is_wizard_eligible).toBe(true);
    expect(byId.demon_hunter.is_wizard_eligible).toBe(false);
    expect(byId.dragon.is_wizard_eligible).toBe(false);
    expect(byId.wizard.is_wizard_eligible).toBe(false);
    for (const s of synergies) expect(s.tier_scores).toHaveLength(s.thresholds.length);
  });

  it("ユニットに登場するが未定義のシナジーを missing として返す", () => {
    const { synergies, missing } = buildSynergies([{ races: ["human", "civet"], classes: ["warrior"] }]);
    expect(synergies.map((s) => s.id)).toEqual(["human", "warrior"]);
    expect(missing).toEqual(["civet"]);
  });
});

describe("parseUnits (HTML構造の推定に対するスモークテスト)", () => {
  it("コスト見出し・連結種族・None クラスを解析できる", () => {
    const html = `
      <section class="cost-1"><h2>1 Cost</h2>
        <a href="/en/charactor/detail/aaa111"><img src="/img/egg.png" alt="Strange Egg">
          <p class="name">Strange Egg</p><p class="race">DragonEgersis</p><p class="class">None</p></a>
      </section>
      <section><h2>Cost 5</h2>
        <a href="/en/charactor/detail/e52b47ad6b9"><img data-src="https://cdn.example/gow.png">
          <p class="name">God of War</p><p class="race">Divinity</p><p class="class">Warrior</p></a>
      </section>`;
    const { units, warnings } = parseUnits(html);
    expect(warnings).toEqual([]);
    expect(units).toEqual([
      {
        id: "strange_egg",
        detail_id: "aaa111",
        name_en: "Strange Egg",
        cost: 1,
        races: ["dragon", "egersis"],
        classes: [],
        image_url: "https://ac.dragonest.com/img/egg.png",
      },
      {
        id: "god_of_war",
        detail_id: "e52b47ad6b9",
        name_en: "God of War",
        cost: 5,
        races: ["divinity"],
        classes: ["warrior"],
        image_url: "https://cdn.example/gow.png",
      },
    ]);
  });
});
