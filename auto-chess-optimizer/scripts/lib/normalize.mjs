/**
 * 公式図鑑の種族・クラス表記を正規化するユーティリティ。
 * "DragonEgersis" のような連結表記・"Human Beast" のようなスペース区切り・
 * "Night Demon" のような複数語の種族名を、既知名の最長一致で分割する。
 */

export const KNOWN_RACES = [
  "Divinity",
  "Demon",
  "Night Demon",
  "Glacier",
  "Cave",
  "Caves",
  "Human",
  "Feathered",
  "Marine",
  "Egersis",
  "Beast",
  "Goblin",
  "Spirits",
  "Dragon",
  "Dwarf",
  "Kira",
  "Insectoid",
  "Civet",
  "Ancestor",
  "Watcher",
  "Horn",
  "Pandaman",
  "Greater",
];

export const KNOWN_CLASSES = [
  "Warrior",
  "Mage",
  "Hunter",
  "Demon Hunter",
  "Assassin",
  "Knight",
  "Warlock",
  "Mech",
  "Druid",
  "Shaman",
  "Priest",
  "Witcher",
  "Wizard",
];

/** 表記ゆれを同一IDにまとめる */
const ALIASES = { caves: "cave" };

const compact = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const toSnakeId = (name) => {
  const id = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ALIASES[id] ?? id;
};

const splitCamelAndSpaces = (s) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s,/&・|]+/)
    .filter(Boolean);

/**
 * @param {string} raw 例: "DragonEgersis", "Human Beast", "NightDemon", "None"
 * @param {string[]} known 既知の表記一覧
 * @returns {{ ids: string[], unknown: string[] }}
 */
export const splitTraits = (raw, known) => {
  const text = (raw ?? "").trim();
  if (!text || /^(none|-|—)$/i.test(text)) return { ids: [], unknown: [] };

  const dict = [...known]
    .map((name) => ({ key: compact(name), id: toSnakeId(name) }))
    .sort((a, b) => b.key.length - a.key.length);

  const ids = [];
  const unknown = [];
  for (const token of text.split(/[,/&・|]+/).map((t) => t.trim()).filter(Boolean)) {
    let rest = compact(token);
    let pending = "";
    while (rest) {
      const hit = dict.find((d) => rest.startsWith(d.key));
      if (hit) {
        if (pending) unknown.push(pending);
        pending = "";
        ids.push(hit.id);
        rest = rest.slice(hit.key.length);
      } else {
        pending += rest[0];
        rest = rest.slice(1);
      }
    }
    if (pending) {
      const words = splitCamelAndSpaces(token).filter((w) => compact(w).length && pending.includes(compact(w)));
      unknown.push(...(words.length ? words : [pending]));
    }
  }
  for (const u of unknown) ids.push(toSnakeId(u));
  return { ids: [...new Set(ids)], unknown };
};

const DEFAULT_BASE_SCORE = { 1: 2.0, 2: 3.5, 3: 5.0, 4: 7.0, 5: 9.0 };

/** 単体性能の手動補正がない場合の初期値(コスト依存, 1.0〜10.0に丸める) */
export const defaultBaseScore = (cost) => DEFAULT_BASE_SCORE[cost] ?? 1.0;

export const clampScore = (v) => Math.min(10, Math.max(1, Math.round(v * 10) / 10));
