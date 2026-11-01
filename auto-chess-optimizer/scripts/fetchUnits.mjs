#!/usr/bin/env node
/**
 * 公式図鑑 (https://ac.dragonest.com/en/charactor) から全ユニットを取得し
 * src/data/units.json と src/data/synergies.json を生成する。
 *
 *   npm run data:fetch
 *   node scripts/fetchUnits.mjs --html list.html   # 一覧ページは保存済みHTMLを使う(詳細ページは取得する)
 *
 * - 一覧ページ: ユニット名・コスト・種族/クラス・画像、フィルタの全種族/全クラス名
 * - 詳細ページ: シナジーの発動段階(thresholds)と効果文
 * - 日本語名と base_score は scripts/data/unitMeta.json、シナジーの日本語名は scripts/lib/synergies.mjs で補完
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { clampScore, defaultBaseScore, splitTraits, toSnakeId } from "./lib/normalize.mjs";
import { buildSynergies } from "./lib/synergies.mjs";

const BASE_URL = "https://ac.dragonest.com";
const LIST_URL = `${BASE_URL}/en/charactor`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL_PATTERN = /\/charactor\/detail\/([A-Za-z0-9_-]+)/;
const CONCURRENCY = 4;

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const absolutize = (src) => (src ? new URL(src, `${BASE_URL}/`).href : null);

const fetchText = async (url) => {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (auto-chess-optimizer data builder)", "accept-language": "en" },
  }).catch((err) => {
    throw new Error(`${url} に接続できません (${err.cause?.code ?? err.message})`);
  });
  if (!res.ok) throw new Error(`${url} の取得に失敗: HTTP ${res.status}`);
  return res.text();
};

/** 一覧ページの種族・クラスフィルタ(公式の全名称) */
export const parseTraitNames = (html) => {
  const $ = cheerio.load(html);
  const lists = $(".card_nav")
    .toArray()
    .map((nav) =>
      $(nav)
        .find(".one_data")
        .toArray()
        .map((el) => clean($(el).text()))
        .filter((t) => t && !/^All /i.test(t)),
    );
  return { races: lists[0] ?? [], classes: lists[1] ?? [] };
};

export const parseUnits = (html, known = parseTraitNames(html)) => {
  const $ = cheerio.load(html);
  const units = [];
  const warnings = [];
  const seen = new Set();

  $(".card_box").each((_, el) => {
    const $card = $(el);
    const detailId = DETAIL_PATTERN.exec($card.find("a").attr("href") ?? "")?.[1];
    if (!detailId || seen.has(detailId)) return;
    seen.add(detailId);

    const nameEn = clean($card.find(".card_name > span").first().text());
    const cost = Number(clean($card.find(".card_name em").text())) || null;
    const split = (selector, dict) => {
      const texts = $card.find(selector).toArray().map((s) => clean($(s).text())).filter(Boolean);
      const result = texts.map((t) => splitTraits(t, dict));
      return { ids: [...new Set(result.flatMap((r) => r.ids))], unknown: result.flatMap((r) => r.unknown) };
    };
    const races = split(".ellipse_top span", known.races);
    const classes = split(".ellipse_bottom span", known.classes);

    if (!nameEn) warnings.push(`${detailId}: 名前を抽出できません`);
    if (!cost || cost < 1 || cost > 5) warnings.push(`${nameEn || detailId}: コストを判定できません`);
    for (const u of [...races.unknown, ...classes.unknown]) warnings.push(`${nameEn}: 未知の種族/クラス表記 "${u}"`);

    units.push({
      id: toSnakeId(nameEn || detailId),
      detail_id: detailId,
      name_en: nameEn,
      cost,
      races: races.ids,
      classes: classes.ids,
      image_url: absolutize($card.find("img.card_img").attr("src")),
    });
  });

  return { units, warnings };
};

/**
 * 詳細ページから各シナジーの段階と効果文を取り出す。
 * - <p> 内に <div> が入れ子になった不正なHTMLのため、親要素の構造には頼らない
 * - 種族/クラスの別は説明文が不正確なことがある(Beast が "same class" 等)ため一覧ページ側で判定する
 * - 段階表記は "2: ..." / "Ancestor[2]: ..." / "Horn(2): ..." の3通り
 * - 段階表記がないもの(Watcher, Civet 等)は1体から常時発動として [1] 扱いにする
 */
const TIER_PARAGRAPH = /^(?:[A-Za-z][A-Za-z ]*?\s*)?[[(]?(\d+)[\])]?\s*[:：]\s*([\s\S]+)$/;

/** 段落ごとに段階を読み取り、段階に続く補足段落は直前の段階の効果文に連結する */
export const parseTiers = (desc) => {
  const tiers = [];
  for (const para of desc.split(/\n\s*\n/).map(clean).filter(Boolean)) {
    const m = TIER_PARAGRAPH.exec(para);
    if (m) tiers.push({ count: Number(m[1]), effect: clean(m[2]) });
    else if (tiers.length) tiers[tiers.length - 1].effect += ` ${para}`;
  }
  return tiers;
};

export const parseDetail = (html) => {
  const $ = cheerio.load(html);
  const synergies = [];
  const seen = new Set();
  $(".text_child").each((_, el) => {
    const $el = $(el);
    const nameEn = clean($el.find("strong").first().text());
    const desc = $el.find("p").first().text();
    const id = toSnakeId(nameEn);
    if (!nameEn || seen.has(id)) return;
    seen.add(id);
    const tiers = parseTiers(desc);
    const implicit = tiers.length === 0 && clean(desc).length > 0;
    synergies.push({
      id,
      name_en: nameEn,
      tiers: implicit ? [{ count: 1, effect: clean(desc) }] : tiers,
      implicit,
    });
  });
  return { synergies };
};

const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
};

const main = async () => {
  const htmlPath = process.argv.includes("--html") ? process.argv[process.argv.indexOf("--html") + 1] : null;
  const listHtml = htmlPath ? await readFile(resolve(htmlPath), "utf8") : await fetchText(LIST_URL);

  const known = parseTraitNames(listHtml);
  const { units, warnings } = parseUnits(listHtml, known);
  if (units.length === 0) throw new Error("ユニットを1体も抽出できませんでした。ページ構造が変わった可能性があります。");

  const officialSynergies = new Map();
  await mapLimit(units, CONCURRENCY, async (u) => {
    const { synergies } = parseDetail(await fetchText(`${BASE_URL}/en/charactor/detail/${u.detail_id}`));
    for (const s of synergies) {
      const prev = officialSynergies.get(s.id);
      if (!prev || (prev.implicit && !s.implicit) || s.tiers.length > prev.tiers.length) officialSynergies.set(s.id, s);
    }
  });

  const meta = JSON.parse(await readFile(resolve(ROOT, "scripts/data/unitMeta.json"), "utf8"));
  const missingJa = [];
  const enriched = units
    .map((u) => {
      const m = meta[u.id] ?? {};
      if (!m.name_ja) missingJa.push(u.name_en);
      return {
        id: u.id,
        detail_id: u.detail_id,
        name_en: u.name_en,
        name_ja: m.name_ja ?? null,
        name_ja_verified: Boolean(m.verified),
        cost: u.cost,
        races: u.races,
        classes: u.classes,
        image_url: u.image_url,
        base_score: clampScore(m.base_score ?? defaultBaseScore(u.cost)),
      };
    })
    .sort((a, b) => (a.cost ?? 9) - (b.cost ?? 9) || a.name_en.localeCompare(b.name_en));

  const { synergies, missing } = buildSynergies(enriched, officialSynergies);
  const usedTraits = new Set(enriched.flatMap((u) => [...u.races, ...u.classes]));
  const unusedTraits = [...known.races, ...known.classes].map(toSnakeId).filter((id) => !usedTraits.has(id));
  const implicit = [...officialSynergies.values()].filter((s) => s.implicit).map((s) => s.id);

  await writeFile(resolve(ROOT, "src/data/units.json"), `${JSON.stringify(enriched, null, 2)}\n`);
  await writeFile(resolve(ROOT, "src/data/synergies.json"), `${JSON.stringify(synergies, null, 2)}\n`);

  const byCost = Object.groupBy(enriched, (u) => u.cost ?? "不明");
  console.log(`units.json: ${enriched.length}体 / synergies.json: ${synergies.length}種`);
  console.log("コスト別:", Object.fromEntries(Object.entries(byCost).map(([k, v]) => [k, v.length])));
  for (const w of warnings) console.warn(`[warn] ${w}`);
  if (missingJa.length) console.warn(`[warn] 日本語名が未登録 (${missingJa.length}体): ${missingJa.join(", ")}`);
  if (missing.length) console.warn(`[warn] 発動段階を取得できなかったシナジー: ${missing.join(", ")}`);
  if (implicit.length) console.warn(`[info] 段階表記がなく1体で常時発動として扱ったシナジー: ${implicit.join(", ")}`);
  if (unusedTraits.length) console.warn(`[info] 公式フィルタにあるが該当ユニットがいない種族/クラス: ${unusedTraits.join(", ")}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
