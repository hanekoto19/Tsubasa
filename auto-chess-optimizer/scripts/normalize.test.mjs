import { describe, expect, it } from "vitest";
import { KNOWN_CLASSES, KNOWN_RACES, splitTraits, toSnakeId } from "./lib/normalize.mjs";
import { buildSynergies, tierScores } from "./lib/synergies.mjs";
import { parseDetail, parseTiers, parseTraitNames, parseUnits } from "./fetchUnits.mjs";

describe("toSnakeId", () => {
  it.each([
    ["God of War", "god_of_war"],
    ["Winter Chiropteran", "winter_chiropteran"],
    ["Unknown Horror ", "unknown_horror"],
    ["Penitent Bishop·Mammon", "penitent_bishop_mammon"],
    ["Caves", "cave"],
  ])("%s → %s", (name, id) => expect(toSnakeId(name)).toBe(id));
});

describe("splitTraits", () => {
  const races = (s) => splitTraits(s, KNOWN_RACES);

  it("連結表記を分割する", () => {
    expect(races("DragonEgersis").ids).toEqual(["dragon", "egersis"]);
    expect(races("HumanBeast").ids).toEqual(["human", "beast"]);
  });

  it("スペース区切り・区切り記号・末尾空白を扱う", () => {
    expect(races("Human Beast").ids).toEqual(["human", "beast"]);
    expect(races("Glacier / Marine").ids).toEqual(["glacier", "marine"]);
    expect(races("Watcher ").ids).toEqual(["watcher"]);
  });

  it("複数語の種族名は最長一致で1つとして扱う", () => {
    expect(races("Night Demon").ids).toEqual(["night_demon"]);
    expect(races("NightDemonHuman").ids).toEqual(["night_demon", "human"]);
    expect(races("Demon").ids).toEqual(["demon"]);
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

/** 公式図鑑の一覧ページと同じ構造の抜粋 */
const LIST_HTML = `
<div class="card_nav"><div class="drop_down_box">
  <div class="one_data"><div>All races</div></div>
  <div class="one_data"><img alt="Dragon"> <div>Dragon</div></div>
  <div class="one_data"><img alt="Egersis"> <div>Egersis</div></div>
  <div class="one_data"><img alt="Divinity"> <div>Divinity</div></div>
</div></div>
<div class="card_nav"><div class="drop_down_box">
  <div class="one_data"><div>All classes</div></div>
  <div class="one_data"><img alt="Warrior"> <div>Warrior</div></div>
  <div class="one_data"><img alt="Mage"> <div>Mage</div></div>
</div></div>
<div class="card_info"><div class="card_box_five">
  <div class="card_box"><a href="/en/charactor/detail/e52b47b0144"><p class="card_name"><span>Winter Chiropteran</span> <span class="right"><i></i> <em>1</em></span></p>
    <div class="img_bg"><img src="//static.example/wc.png" class="card_img nomal"></div>
    <div class="race_class"><div class="ellipse_top"><p><span>Dragon</span></p> <p><span>Egersis</span></p></div>
    <div class="ellipse_bottom"><p><span>Mage</span></p></div></div></a></div>
  <div class="card_box"><a href="/en/charactor/detail/e52b47aec6b"><p class="card_name"><span>God of War</span> <span class="right"><i></i> <em>3</em></span></p>
    <div class="img_bg"><img src="//static.example/gow.png" class="card_img nomal"></div>
    <div class="race_class"><div class="ellipse_top"><p><span>Divinity</span></p></div>
    <div class="ellipse_bottom"><p><span>Warrior</span></p></div></div></a></div>
  <div class="card_box"><a href="/en/charactor/detail/e52b47abc41"><p class="card_name"><span>Strange Egg</span> <span class="right"><i></i> <em>5</em></span></p>
    <div class="race_class"><div class="ellipse_top"><p><span>DragonEgersis</span></p></div>
    <div class="ellipse_bottom"><!----></div></div></a></div>
</div></div>`;

describe("一覧ページの解析", () => {
  it("フィルタから公式の種族・クラス名を取得する", () => {
    expect(parseTraitNames(LIST_HTML)).toEqual({
      races: ["Dragon", "Egersis", "Divinity"],
      classes: ["Warrior", "Mage"],
    });
  });

  it("名前・コスト・種族/クラス・画像を抽出する", () => {
    const { units, warnings } = parseUnits(LIST_HTML);
    expect(warnings).toEqual([]);
    expect(units[0]).toEqual({
      id: "winter_chiropteran",
      detail_id: "e52b47b0144",
      name_en: "Winter Chiropteran",
      cost: 1,
      races: ["dragon", "egersis"],
      classes: ["mage"],
      image_url: "https://static.example/wc.png",
    });
    expect(units[1]).toMatchObject({ id: "god_of_war", cost: 3, races: ["divinity"], classes: ["warrior"] });
  });

  it("連結表記の2種族とクラスなしを正規化する", () => {
    const egg = parseUnits(LIST_HTML).units[2];
    expect(egg).toMatchObject({ races: ["dragon", "egersis"], classes: [], image_url: null });
  });
});

describe("詳細ページの解析", () => {
  it.each([
    ["数字のみ", "Active when ...\n\n2: A\n\n4: B", [2, 4]],
    ["全角コロン", "Deploying pieces ...\n\n2：A\n\n4：B\n\n6：C", [2, 4, 6]],
    ["名前[数]", "Ancestor[2]: A\n\nAncestor[4]: B\n\nDamage cap note.", [2, 4]],
    ["名前(数)", "Horn(2): A\n\nHorn(4): B", [2, 4]],
  ])("段階表記: %s", (_, desc, counts) => {
    expect(parseTiers(desc).map((t) => t.count)).toEqual(counts);
  });

  it("段階の後の補足段落は直前の段階に連結する", () => {
    expect(parseTiers("Ancestor[2]: A\n\nAncestor[4]: B\n\nDamage cap note.")[1].effect).toBe("B Damage cap note.");
  });

  it("<p> 内に <div> がある不正なHTMLでも種族・クラス両方を取得する", () => {
    const html = `<p class="race_text"><span class="text_race">Race: <span class="race_more">Beast
      <div class="text_child"><strong>Beast</strong> <p>Deploying pieces of the same class activates synergies

2：All allies +15% attack

4：All allies +30% attack</p></div></span></span>
      <span class="text_career">Class: <span class="race_more">Druid
      <div class="text_child"><strong>Druid</strong> <p>Active when you have certain number pieces of this class on board

2: Combine 1-star

4: Combine 2-star</p></div></span></span></p>`;
    const { synergies } = parseDetail(html);
    expect(synergies.map((s) => [s.id, s.tiers.map((t) => t.count), s.implicit])).toEqual([
      ["beast", [2, 4], false],
      ["druid", [2, 4], false],
    ]);
  });

  it("段階表記がないものは1体で常時発動として扱う", () => {
    const html = `<div class="text_child"><strong>Watcher </strong> <p>All allies gain the effect: +1 targets.</p></div>`;
    expect(parseDetail(html).synergies[0]).toMatchObject({
      id: "watcher",
      tiers: [{ count: 1, effect: "All allies gain the effect: +1 targets." }],
      implicit: true,
    });
  });
});

describe("buildSynergies", () => {
  const official = new Map([
    ["glacier", { id: "glacier", name_en: "Glacier", tiers: [{ count: 4, effect: "B" }, { count: 2, effect: "A" }] }],
    ["dwarf", { id: "dwarf", name_en: "Dwarf", tiers: [{ count: 2, effect: "X" }] }],
    ["wizard", { id: "wizard", name_en: "Wizard", tiers: [{ count: 2, effect: "W2" }, { count: 4, effect: "W4" }] }],
  ]);
  const units = [
    { races: ["glacier"], classes: ["wizard"] },
    { races: ["dwarf", "civet"], classes: [] },
  ];

  it("段階スコアは逓増する", () => {
    expect(tierScores([3, 6, 9])).toEqual([15, 42, 81]);
    expect(tierScores([1])).toEqual([10]);
  });

  it("公式の段階を昇順に並べ、種族/クラスを判定する", () => {
    const { synergies } = buildSynergies(units, official);
    const glacier = synergies.find((s) => s.id === "glacier");
    expect(glacier).toMatchObject({
      type: "race",
      name_ja: "グレーシャー",
      thresholds: [2, 4],
      tier_scores: [10, 28],
      effects_en: ["A", "B"],
    });
    expect(synergies.find((s) => s.id === "wizard")?.type).toBe("class");
  });

  it("最大必要数4以上をウィザード対象にする(Wizard自身は除く)", () => {
    const byId = Object.fromEntries(buildSynergies(units, official).synergies.map((s) => [s.id, s]));
    expect(byId.glacier.is_wizard_eligible).toBe(true);
    expect(byId.dwarf.is_wizard_eligible).toBe(false);
    expect(byId.wizard.is_wizard_eligible).toBe(false);
  });

  it("段階を取得できなかったシナジーを missing として返す", () => {
    expect(buildSynergies(units, official).missing).toEqual(["civet"]);
  });
});
