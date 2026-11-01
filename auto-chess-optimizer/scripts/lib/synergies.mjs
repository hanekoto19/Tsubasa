/**
 * シナジーの日本語名。発動段階と効果文は公式図鑑の詳細ページから取得する。
 * verified: true はユーザー指定の名称、false は暫定訳(日本版の正式名称で要確認)。
 */
export const SYNERGY_NAMES_JA = {
  divinity: { name_ja: "神", verified: true },
  demon: { name_ja: "悪魔", verified: true },
  glacier: { name_ja: "グレーシャー", verified: true },
  cave: { name_ja: "ケイブ", verified: true },
  human: { name_ja: "ヒューマン", verified: true },
  feathered: { name_ja: "ウイングス", verified: true },
  marine: { name_ja: "マリーン", verified: true },
  egersis: { name_ja: "エガーシス", verified: false },
  beast: { name_ja: "ビースト", verified: false },
  goblin: { name_ja: "ゴブリン", verified: false },
  spirits: { name_ja: "スピリット", verified: false },
  dragon: { name_ja: "ドラゴン", verified: false },
  dwarf: { name_ja: "ドワーフ", verified: false },
  kira: { name_ja: "キラ", verified: false },
  insectoid: { name_ja: "インセクトイド", verified: false },
  civet: { name_ja: "シベット", verified: false },
  ancestor: { name_ja: "アンセスター", verified: false },
  night_demon: { name_ja: "ナイトデーモン", verified: false },
  watcher: { name_ja: "ウォッチャー", verified: false },
  horn: { name_ja: "ホーン", verified: false },
  pandaman: { name_ja: "パンダマン", verified: false },
  greater: { name_ja: "グレーター", verified: false },

  wizard: { name_ja: "ウィザード", verified: true },
  demon_hunter: { name_ja: "デモンハンター", verified: true },
  warrior: { name_ja: "ウォリアー", verified: true },
  mage: { name_ja: "メイジ", verified: true },
  warlock: { name_ja: "ウォーロック", verified: true },
  knight: { name_ja: "ナイト", verified: true },
  assassin: { name_ja: "アサシン", verified: true },
  hunter: { name_ja: "ハンター", verified: false },
  mech: { name_ja: "メカ", verified: false },
  druid: { name_ja: "ドルイド", verified: false },
  shaman: { name_ja: "シャーマン", verified: false },
  priest: { name_ja: "プリースト", verified: false },
  witcher: { name_ja: "ウィッチャー", verified: false },
};

/** 必要数が大きい段階ほど逓増させる。例: [3, 6, 9] → [15, 42, 81] */
export const tierScores = (thresholds) =>
  thresholds.map((t, i) => Math.max(10, Math.round(5 * t * (1 + 0.4 * i))));

/**
 * @param {{ races: string[], classes: string[] }[]} units
 * @param {Map<string, { id: string, name_en: string, tiers: { count: number, effect: string }[] }>} official 詳細ページから取得した定義
 */
export const buildSynergies = (units, official) => {
  const raceIds = new Set(units.flatMap((u) => u.races));
  const used = [...new Set(units.flatMap((u) => [...u.races, ...u.classes]))];
  const missing = used.filter((id) => !official.get(id)?.tiers.length).sort();

  const synergies = used
    .filter((id) => official.get(id)?.tiers.length)
    .map((id) => {
      const def = official.get(id);
      const tiers = [...def.tiers].sort((a, b) => a.count - b.count);
      const thresholds = tiers.map((t) => t.count);
      const ja = SYNERGY_NAMES_JA[id];
      return {
        id,
        type: raceIds.has(id) ? "race" : "class",
        name_ja: ja?.name_ja ?? null,
        name_en: def.name_en,
        name_ja_verified: Boolean(ja?.verified),
        thresholds,
        tier_scores: tierScores(thresholds),
        is_wizard_eligible: id !== "wizard" && Math.max(...thresholds) >= 4,
        effects_en: tiers.map((t) => t.effect),
      };
    })
    .sort((a, b) => (a.type === b.type ? a.name_en.localeCompare(b.name_en) : a.type === "race" ? -1 : 1));

  return { synergies, missing };
};
