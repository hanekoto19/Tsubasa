import type { ClassId, RaceId, SynergyDef, SynergyId } from "./types";

export const RACE_IDS: RaceId[] = [
  "divinity",
  "demon",
  "glacier",
  "caves",
  "human",
  "feathered",
  "marine",
];

export const CLASS_IDS: ClassId[] = [
  "wizard",
  "demonHunter",
  "warrior",
  "mage",
  "warlock",
  "knight",
  "assassin",
];

export const SYNERGIES: Record<SynergyId, SynergyDef> = {
  divinity: {
    id: "divinity",
    kind: "race",
    name: "Divinity",
    nameJa: "神",
    tiers: [
      { count: 2, score: 20, effect: "味方全体のスキルCDを大幅短縮" },
      { count: 4, score: 45, effect: "味方全体のスキルCDをさらに短縮" },
    ],
  },
  demon: {
    id: "demon",
    kind: "race",
    name: "Demon",
    nameJa: "悪魔",
    tiers: [{ count: 1, score: 15, effect: "悪魔の攻撃に純粋ダメージを追加" }],
  },
  glacier: {
    id: "glacier",
    kind: "race",
    name: "Glacier",
    nameJa: "グレーシャー",
    tiers: [
      { count: 2, score: 10, effect: "攻撃時に確率で敵を凍結" },
      { count: 4, score: 25, effect: "凍結確率が上昇" },
      { count: 6, score: 45, effect: "凍結確率が大幅上昇" },
    ],
  },
  caves: {
    id: "caves",
    kind: "race",
    name: "Caves",
    nameJa: "ケイブ",
    tiers: [
      { count: 2, score: 10, effect: "味方の最大HPが上昇" },
      { count: 4, score: 25, effect: "味方の最大HPがさらに上昇" },
      { count: 6, score: 45, effect: "味方の最大HPが大幅上昇" },
    ],
  },
  human: {
    id: "human",
    kind: "race",
    name: "Human",
    nameJa: "ヒューマン",
    tiers: [
      { count: 2, score: 10, effect: "攻撃時に確率で敵を沈黙" },
      { count: 4, score: 25, effect: "沈黙確率が上昇" },
      { count: 6, score: 45, effect: "沈黙確率が大幅上昇" },
    ],
  },
  feathered: {
    id: "feathered",
    kind: "race",
    name: "Feathered",
    nameJa: "ウイングス",
    tiers: [
      { count: 3, score: 12, effect: "回避率が上昇" },
      { count: 6, score: 30, effect: "回避率がさらに上昇" },
      { count: 9, score: 60, effect: "回避率が大幅上昇" },
    ],
  },
  marine: {
    id: "marine",
    kind: "race",
    name: "Marine",
    nameJa: "マリーン",
    tiers: [
      { count: 2, score: 10, effect: "味方の魔法耐性が上昇" },
      { count: 4, score: 28, effect: "味方の魔法耐性が大幅上昇" },
    ],
  },
  wizard: {
    id: "wizard",
    kind: "class",
    name: "Wizard",
    nameJa: "ウィザード",
    tiers: [
      { count: 2, score: 15, effect: "4体以上必要なシナジーの必要数を-1" },
      {
        count: 4,
        score: 30,
        effect: "他の発動シナジーが1つだけなら、それを最大ティアで発動",
      },
    ],
  },
  demonHunter: {
    id: "demonHunter",
    kind: "class",
    name: "Demon Hunter",
    nameJa: "デモンハンター",
    tiers: [{ count: 2, score: 15, effect: "全ての悪魔シナジーを有効化" }],
  },
  warrior: {
    id: "warrior",
    kind: "class",
    name: "Warrior",
    nameJa: "ウォリアー",
    tiers: [
      { count: 3, score: 15, effect: "ウォリアーのアーマーが上昇" },
      { count: 6, score: 35, effect: "ウォリアーのアーマーがさらに上昇" },
      { count: 9, score: 65, effect: "ウォリアーのアーマーが大幅上昇" },
    ],
  },
  mage: {
    id: "mage",
    kind: "class",
    name: "Mage",
    nameJa: "メイジ",
    tiers: [
      { count: 3, score: 15, effect: "敵の魔法耐性を低下" },
      { count: 6, score: 35, effect: "敵の魔法耐性をさらに低下" },
      { count: 9, score: 65, effect: "敵の魔法耐性を大幅低下" },
    ],
  },
  warlock: {
    id: "warlock",
    kind: "class",
    name: "Warlock",
    nameJa: "ウォーロック",
    tiers: [
      { count: 2, score: 10, effect: "味方にライフスティールを付与" },
      { count: 4, score: 25, effect: "ライフスティールが上昇" },
      { count: 6, score: 45, effect: "ライフスティールが大幅上昇" },
    ],
  },
  knight: {
    id: "knight",
    kind: "class",
    name: "Knight",
    nameJa: "ナイト",
    tiers: [
      { count: 2, score: 12, effect: "確率でダメージ軽減シールドを展開" },
      { count: 4, score: 28, effect: "シールド発動確率が上昇" },
      { count: 6, score: 48, effect: "シールド発動確率が大幅上昇" },
    ],
  },
  assassin: {
    id: "assassin",
    kind: "class",
    name: "Assassin",
    nameJa: "アサシン",
    tiers: [
      { count: 3, score: 15, effect: "確率でクリティカル" },
      { count: 6, score: 35, effect: "クリティカル確率・倍率が上昇" },
      { count: 9, score: 65, effect: "クリティカル確率・倍率が大幅上昇" },
    ],
  },
};

export const SYNERGY_LIST: SynergyDef[] = [...RACE_IDS, ...CLASS_IDS].map(
  (id) => SYNERGIES[id],
);
