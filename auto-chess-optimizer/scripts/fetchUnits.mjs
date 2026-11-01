#!/usr/bin/env node
/**
 * 公式図鑑 (https://ac.dragonest.com/en/charactor) から全ユニットを取得し
 * src/data/units.json と src/data/synergies.json を生成する。
 *
 *   node scripts/fetchUnits.mjs                 # サイトから取得
 *   node scripts/fetchUnits.mjs --html page.html # 保存済みHTMLから解析
 *   node scripts/fetchUnits.mjs --dump raw.html  # 取得したHTMLを保存(セレクタ調整用)
 *
 * 日本語名と base_score は scripts/data/unitMeta.json で補完する。
 * 未登録のユニットは name_ja: null / コスト依存の base_score で出力し、警告を表示する。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import {
  KNOWN_CLASSES,
  KNOWN_RACES,
  clampScore,
  defaultBaseScore,
  parseCost,
  splitTraits,
  toSnakeId,
} from "./lib/normalize.mjs";
import { buildSynergies } from "./lib/synergies.mjs";

const SOURCE_URL = "https://ac.dragonest.com/en/charactor";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL_PATTERN = /\/charactor\/detail\/([A-Za-z0-9_-]+)/;

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const loadHtml = async () => {
  const file = argValue("--html");
  if (file) return readFile(resolve(file), "utf8");
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "Mozilla/5.0 (auto-chess-optimizer data builder)", "accept-language": "en" },
  }).catch((err) => {
    throw new Error(`${SOURCE_URL} に接続できません (${err.cause?.code ?? err.message})。ブラウザで保存したHTMLを --html で渡すこともできます。`);
  });
  if (!res.ok) throw new Error(`${SOURCE_URL} の取得に失敗: HTTP ${res.status}`);
  return res.text();
};

const textOf = ($el) => $el.text().replace(/\s+/g, " ").trim();
const firstText = ($root, selectors) => {
  for (const sel of selectors) {
    const t = textOf($root.find(sel).first());
    if (t) return t;
  }
  return "";
};

/** 祖先の data-cost / class名 / 直前の見出しからコストを判定する */
const detectCost = ($, el) => {
  for (let node = $(el); node.length && node[0].type === "tag"; node = node.parent()) {
    const fromAttr = parseCost(`cost ${node.attr("data-cost") ?? ""}`) ?? parseCost(node.attr("class") ?? "");
    if (fromAttr) return fromAttr;
    for (let prev = node.prev(); prev.length; prev = prev.prev()) {
      const cost = parseCost(textOf(prev));
      if (cost && textOf(prev).length < 40) return cost;
      if (prev.find(`a[href*="/charactor/detail/"]`).length) break;
    }
  }
  return null;
};

const absolutize = (src) => (src ? new URL(src, SOURCE_URL).href : null);

export const parseUnits = (html) => {
  const $ = cheerio.load(html);
  const units = new Map();
  const warnings = [];

  $(`a[href*="/charactor/detail/"]`).each((_, el) => {
    const $a = $(el);
    const detailId = DETAIL_PATTERN.exec($a.attr("href") ?? "")?.[1];
    if (!detailId || units.has(detailId)) return;

    const $img = $a.find("img").first();
    const lines = $a
      .find("*")
      .toArray()
      .filter((n) => $(n).children().length === 0)
      .map((n) => textOf($(n)))
      .filter(Boolean);

    const nameEn =
      firstText($a, ['[class*="name" i]', "h3", "h4", "strong"]) || $img.attr("alt")?.trim() || lines[0] || "";
    const raceText = firstText($a, ['[class*="race" i]', '[class*="species" i]']) || lines[1] || "";
    const classText = firstText($a, ['[class*="class" i]:not([class*="race" i])', '[class*="job" i]', '[class*="profession" i]']) || lines[2] || "";

    const races = splitTraits(raceText, KNOWN_RACES);
    const classes = splitTraits(classText, KNOWN_CLASSES);
    const cost = detectCost($, el);

    if (!nameEn) warnings.push(`${detailId}: 名前を抽出できません`);
    if (!cost) warnings.push(`${nameEn || detailId}: コストを判定できません`);
    for (const u of [...races.unknown, ...classes.unknown]) warnings.push(`${nameEn}: 未知の種族/クラス表記 "${u}"`);

    units.set(detailId, {
      id: toSnakeId(nameEn || detailId),
      detail_id: detailId,
      name_en: nameEn,
      cost,
      races: races.ids,
      classes: classes.ids,
      image_url: absolutize($img.attr("data-src") ?? $img.attr("src")),
    });
  });

  return { units: [...units.values()], warnings };
};

const main = async () => {
  const html = await loadHtml();
  const dumpPath = argValue("--dump");
  if (dumpPath) await writeFile(resolve(dumpPath), html);

  const { units, warnings } = parseUnits(html);
  if (units.length === 0) {
    throw new Error("ユニットを1体も抽出できませんでした。--dump でHTMLを保存しセレクタを確認してください。");
  }

  const meta = JSON.parse(await readFile(resolve(ROOT, "scripts/data/unitMeta.json"), "utf8"));
  const missingJa = [];
  const enriched = units
    .map((u) => {
      const m = meta[u.id] ?? {};
      if (!m.name_ja) missingJa.push(u.name_en);
      return {
        ...u,
        name_ja: m.name_ja ?? null,
        base_score: clampScore(m.base_score ?? defaultBaseScore(u.cost)),
      };
    })
    .sort((a, b) => (a.cost ?? 9) - (b.cost ?? 9) || a.name_en.localeCompare(b.name_en));

  const { synergies, missing } = buildSynergies(enriched);

  await mkdir(resolve(ROOT, "src/data"), { recursive: true });
  await writeFile(resolve(ROOT, "src/data/units.json"), `${JSON.stringify(enriched, null, 2)}\n`);
  await writeFile(resolve(ROOT, "src/data/synergies.json"), `${JSON.stringify(synergies, null, 2)}\n`);

  console.log(`units.json: ${enriched.length}体 / synergies.json: ${synergies.length}種`);
  const byCost = Object.groupBy(enriched, (u) => u.cost ?? "不明");
  console.log("コスト別:", Object.fromEntries(Object.entries(byCost).map(([k, v]) => [k, v.length])));
  for (const w of warnings) console.warn(`[warn] ${w}`);
  if (missingJa.length) console.warn(`[warn] 日本語名が未登録 (${missingJa.length}体): ${missingJa.join(", ")}`);
  if (missing.length) console.warn(`[warn] シナジー定義が未登録: ${missing.join(", ")}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
