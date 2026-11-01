/**
 * シナジー定義のソース。公式図鑑の一覧ページには発動段階が載っていないため手動管理する。
 * verified: true  … 本アプリの仕様として確定済み(ユーザー指定)
 * verified: false … 記憶ベースの暫定値。公式の種族/クラス詳細で要確認
 * 段階数が不明なもの(Civet / Ancestor / Night Demon / Watcher / Horn など)は意図的に未登録とし、
 * 生成時に警告として出す。
 */
export const SYNERGY_DEFS = [
  { id: "divinity", type: "race", name_en: "Divinity", name_ja: "神", thresholds: [2, 4], verified: true },
  { id: "demon", type: "race", name_en: "Demon", name_ja: "悪魔", thresholds: [1], verified: true },
  { id: "glacier", type: "race", name_en: "Glacier", name_ja: "グレーシャー", thresholds: [2, 4, 6], verified: true },
  { id: "cave", type: "race", name_en: "Cave", name_ja: "ケイブ", thresholds: [2, 4, 6], verified: true },
  { id: "human", type: "race", name_en: "Human", name_ja: "ヒューマン", thresholds: [2, 4, 6], verified: true },
  { id: "feathered", type: "race", name_en: "Feathered", name_ja: "ウイングス", thresholds: [3, 6, 9], verified: true },
  { id: "marine", type: "race", name_en: "Marine", name_ja: "マリーン", thresholds: [2, 4], verified: true },
  { id: "egersis", type: "race", name_en: "Egersis", name_ja: "エガーシス", thresholds: [2, 4, 6], verified: false },
  { id: "beast", type: "race", name_en: "Beast", name_ja: "ビースト", thresholds: [2, 4, 6], verified: false },
  { id: "goblin", type: "race", name_en: "Goblin", name_ja: "ゴブリン", thresholds: [3, 6], verified: false },
  { id: "spirits", type: "race", name_en: "Spirits", name_ja: "スピリット", thresholds: [2, 4, 6], verified: false },
  { id: "dragon", type: "race", name_en: "Dragon", name_ja: "ドラゴン", thresholds: [3], verified: false },
  { id: "dwarf", type: "race", name_en: "Dwarf", name_ja: "ドワーフ", thresholds: [1], verified: false },
  { id: "insectoid", type: "race", name_en: "Insectoid", name_ja: "インセクトイド", thresholds: [2, 4, 6], verified: false },

  { id: "wizard", type: "class", name_en: "Wizard", name_ja: "ウィザード", thresholds: [2, 4], verified: true },
  { id: "demon_hunter", type: "class", name_en: "Demon Hunter", name_ja: "デモンハンター", thresholds: [2], verified: true },
  { id: "warrior", type: "class", name_en: "Warrior", name_ja: "ウォリアー", thresholds: [3, 6, 9], verified: true },
  { id: "mage", type: "class", name_en: "Mage", name_ja: "メイジ", thresholds: [3, 6, 9], verified: true },
  { id: "warlock", type: "class", name_en: "Warlock", name_ja: "ウォーロック", thresholds: [2, 4, 6], verified: true },
  { id: "knight", type: "class", name_en: "Knight", name_ja: "ナイト", thresholds: [2, 4, 6], verified: true },
  { id: "assassin", type: "class", name_en: "Assassin", name_ja: "アサシン", thresholds: [3, 6, 9], verified: true },
  { id: "hunter", type: "class", name_en: "Hunter", name_ja: "ハンター", thresholds: [3, 6, 9], verified: false },
  { id: "mech", type: "class", name_en: "Mech", name_ja: "メカ", thresholds: [2, 4, 6], verified: false },
  { id: "druid", type: "class", name_en: "Druid", name_ja: "ドルイド", thresholds: [2, 4], verified: false },
  { id: "shaman", type: "class", name_en: "Shaman", name_ja: "シャーマン", thresholds: [2, 4], verified: false },
  { id: "priest", type: "class", name_en: "Priest", name_ja: "プリースト", thresholds: [1, 2], verified: false },
  { id: "witcher", type: "class", name_en: "Witcher", name_ja: "ウィッチャー", thresholds: [2, 4], verified: false },
];

/** 必要数が大きい段階ほど逓増させる。例: [3, 6, 9] → [15, 42, 81] */
export const tierScores = (thresholds) =>
  thresholds.map((t, i) => Math.max(10, Math.round(5 * t * (1 + 0.4 * i))));

export const toSynergyJson = (def) => ({
  id: def.id,
  type: def.type,
  name_ja: def.name_ja,
  name_en: def.name_en,
  thresholds: def.thresholds,
  tier_scores: tierScores(def.thresholds),
  is_wizard_eligible: def.id !== "wizard" && Math.max(...def.thresholds) >= 4,
  verified: def.verified,
});

/**
 * @param {{ races: string[], classes: string[] }[] | undefined} units 指定時はユニットに登場するシナジーのみ出力
 */
export const buildSynergies = (units) => {
  const defs = new Map(SYNERGY_DEFS.map((d) => [d.id, d]));
  const used = units
    ? [...new Set(units.flatMap((u) => [...u.races, ...u.classes]))]
    : [...defs.keys()];
  const missing = used.filter((id) => !defs.has(id)).sort();
  const order = [...defs.keys()];
  const synergies = used
    .filter((id) => defs.has(id))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((id) => toSynergyJson(defs.get(id)));
  return { synergies, missing };
};
