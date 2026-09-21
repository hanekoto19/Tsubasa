"use strict";

/**
 * このファイルは新規実装のアプリケーションロジックです。
 * ポケモンデータそのものは js/data.js (ネジキダメージ計算機から複製・無編集) を
 * そのまま参照します。ここではデータの書き換え・フィルタは行わず、
 * 検索・表示・候補プールの絞り込みのためのビュー生成のみを行います。
 *
 * v1要件(HGSS バトルファクトリー個人用ツール)対応:
 *  - Lv50 / Lv100(オープンレベル) 候補プール切り替え
 *  - ポケモン名の複数選択 → 一覧比較
 *  - 技/持ち物の逆引き(パターンA: 単独検索 / パターンB: ポケモン名併用で絞り込み)
 *  - タイプ別の候補一覧(現在の候補プール内)
 *  - 画像は PokéAPI から HGSS当時のドット絵を取得
 *  - trainerdata / trainerList は使用しない
 */

const TYPE_COLORS = {
  ノーマル: "#a8a77a",
  ほのお: "#ee8130",
  みず: "#6390f0",
  でんき: "#f7d02c",
  くさ: "#7ac74c",
  こおり: "#96d9d6",
  かくとう: "#c22e28",
  どく: "#a33ea1",
  じめん: "#e2bf65",
  ひこう: "#a98ff3",
  エスパー: "#f95587",
  むし: "#a6b91a",
  いわ: "#b6a136",
  ゴースト: "#735797",
  ドラゴン: "#6f35fc",
  あく: "#705746",
  はがね: "#b7b7ce",
  フェアリー: "#d685ad",
  なし: "#9aa1a8",
  "？？？": "#9aa1a8",
};

const PAGE_SIZE = 24;

// --- データ参照ヘルパー (data.js の内容はそのまま利用し、書き換えない) ---

function getMoveByNo(no) {
  return weaponsdata.find((m) => m.no === no) || null;
}

function movesOf(p) {
  return [p.weapon1, p.weapon2, p.weapon3, p.weapon4].map((no) => getMoveByNo(no)).filter(Boolean);
}

// --- 実数値計算(種族値・努力値・性格補正・個体値・レベルから算出) ---
// 計算式はユーザー提示のもの。bfpokedata の nA〜nS はそのまま「性格補正コード」
// (9=0.9倍/10=1.0倍/11=1.1倍)として使われていることをデータから確認済み。
// なので別途「性格名→補正表」を作らず、bfpokedataの値をそのまま使う。

function calcRealStat(base, iv, ev, level, natureMod) {
  const core = Math.floor((base * 2 + iv + Math.floor(ev / 4)) * level / 100);
  return Math.floor((core + 5) * natureMod / 10);
}

function calcRealHp(base, iv, ev, level) {
  if (base === 1) return 1; // ヌケニン等、種族値Hが1のポケモンはHP実数値が常に1固定
  const core = Math.floor((base * 2 + iv + Math.floor(ev / 4)) * level / 100);
  return core + level + 10;
}

function computeRealStats(p, level, iv) {
  return {
    H: calcRealHp(p.shH, iv, p.dH, level),
    A: calcRealStat(p.shA, iv, p.dA, level, p.nA),
    B: calcRealStat(p.shB, iv, p.dB, level, p.nB),
    C: calcRealStat(p.shC, iv, p.dC, level, p.nC),
    D: calcRealStat(p.shD, iv, p.dD, level, p.nD),
    S: calcRealStat(p.shS, iv, p.dS, level, p.nS),
  };
}

// 自分の個体値の選択肢: js/kota.js の実際の分岐(bfNo範囲 × Lv50/100)をそのまま再現。
// (レンタル解放状況によって選べる個体値が変わる、という原実装の仕様に合わせる)
function getSelfKotaOptions(bfNo, level) {
  if (level === 100) {
    if (bfNo >= 351 && bfNo <= 486) return [0, 16, 20, 24, 31];
    if (bfNo >= 487 && bfNo <= 622) return [4, 16, 20, 24, 31];
    if (bfNo >= 623 && bfNo <= 758) return [8, 16, 20, 24, 31];
    if (bfNo >= 759 && bfNo <= 950) return [12, 16, 20, 24, 31];
  } else if (level === 50) {
    if (bfNo >= 1 && bfNo <= 150) return [0];
    if (bfNo >= 151 && bfNo <= 250) return [4];
    if (bfNo >= 251 && bfNo <= 350) return [8];
    if (bfNo >= 351 && bfNo <= 486) return [12, 31];
    if (bfNo >= 487 && bfNo <= 622) return [16, 31];
    if (bfNo >= 623 && bfNo <= 758) return [20, 31];
    if (bfNo >= 759 && bfNo <= 950) return [24, 31];
  }
  // Lvが50/100以外、またはbfNoが想定外の場合は全選択肢を出す
  return [0, 4, 8, 12, 16, 20, 24, 31];
}

// 相手の個体値の選択肢: trainerdata[].kota (バトルファクトリーを何周目かで固定される)。
// 「ネジキ」等の施設リーダー特有のrank(9・10)は個体値が銀/金で割れるため対象外にする。
function getOpponentKotaOptions() {
  const map = new Map();
  trainerdata.forEach((t) => {
    if (t.rank >= 1 && t.rank <= 8 && !map.has(t.rank)) map.set(t.rank, t.kota);
  });
  // [周回数(lap), 個体値(kota)] のペアを周回数の昇順で返す
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function typeBadge(typeName) {
  if (!typeName || typeName === "なし") return "";
  const color = TYPE_COLORS[typeName] || "#9aa1a8";
  return `<span class="type-badge" style="background:${color}">${escapeHtml(typeName)}</span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// 全角数字・英字などをIME入力時に打ち込んでも半角と同一視して検索できるようにする
function normalizeForSearch(str) {
  return String(str).normalize("NFKC").toLowerCase();
}

function textIncludes(target, query) {
  return normalizeForSearch(target).includes(normalizeForSearch(query));
}

// --- Lv50 / Lv100(オープンレベル) 候補プール ---
// array["50"] / array["100"] (data.js) はそのままの内容を使い、候補となる
// pokeNo の集合として利用する。bfpokedata 自体を書き換えたりフィルタして
// 保存し直すことはしない(表示のたびに動的に絞り込むだけ)。

function buildCandidateSet(arrKey) {
  return new Set(
    array[arrKey]
      .filter((entry) => entry.cd !== "" && entry.cd !== undefined)
      .map((entry) => String(entry.cd))
  );
}

const CANDIDATE_SETS = {
  50: buildCandidateSet("50"),
  100: buildCandidateSet("100"),
};

const appState = { levelMode: "50" };

function isInCandidatePool(pokeNo) {
  return CANDIDATE_SETS[appState.levelMode].has(String(pokeNo));
}

function getCandidateBfData() {
  return bfpokedata.filter((p) => isInCandidatePool(p.pokeNo));
}

// --- PokéAPI から画像を取得(HGSS当時のドット絵を優先, 遅延読み込み + キャッシュ) ---

const spriteCache = new Map();

async function fetchSpriteUrl(pokeNo) {
  const key = String(pokeNo);
  if (spriteCache.has(key)) return spriteCache.get(key);
  if (!pokeNo || Number(pokeNo) <= 0) {
    spriteCache.set(key, null);
    return null;
  }
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
    if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
    const json = await res.json();
    const sprites = json.sprites || {};
    const hgss =
      sprites.versions &&
      sprites.versions["generation-iv"] &&
      sprites.versions["generation-iv"]["heartgold-soulsilver"];
    const url =
      (hgss && hgss.front_default) ||
      (sprites.other && sprites.other["official-artwork"] && sprites.other["official-artwork"].front_default) ||
      sprites.front_default ||
      null;
    spriteCache.set(key, url);
    return url;
  } catch (err) {
    spriteCache.set(key, null);
    return null;
  }
}

const spriteObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spriteObserver.unobserve(entry.target);
      loadSpriteInto(entry.target);
    });
  },
  { rootMargin: "150px" }
);

async function loadSpriteInto(wrapEl) {
  const pokeNo = wrapEl.dataset.pokeno;
  const name = wrapEl.dataset.name || "";
  const url = await fetchSpriteUrl(pokeNo);
  wrapEl.classList.remove("is-loading");
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = name;
    img.loading = "lazy";
    img.style.imageRendering = "pixelated";
    wrapEl.appendChild(img);
  } else {
    wrapEl.textContent = "?";
  }
}

function makeSpriteWrapEl(pokeNo, name) {
  const wrap = document.createElement("div");
  wrap.className = "poke-card__img-wrap is-loading";
  wrap.dataset.pokeno = pokeNo;
  wrap.dataset.name = name;
  spriteObserver.observe(wrap);
  return wrap;
}

// --- 複数選択して一覧比較(レンタル選出シーン向け) ---

const compareSelection = new Map(); // key: bfNo -> bfpokedata entry

function isSelectedForCompare(p) {
  return compareSelection.has(p.bfNo);
}

function toggleCompare(p, checked) {
  if (checked) {
    compareSelection.set(p.bfNo, p);
  } else {
    compareSelection.delete(p.bfNo);
  }
  renderCompareBar();
  renderCompareSection();
  document.querySelectorAll(`[data-bfno="${p.bfNo}"]`).forEach((card) => {
    card.classList.toggle("is-selected-for-compare", checked);
    const cb = card.querySelector(".poke-card__compare-check input");
    if (cb) cb.checked = checked;
  });
}

function renderCompareBar() {
  const bar = document.getElementById("compare-bar");
  const countEl = document.getElementById("compare-bar-count");
  if (compareSelection.size === 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  countEl.textContent = `${compareSelection.size}件を選択中`;
}

const COMPARE_ROWS = [
  { label: "全国図鑑No.", render: (p) => `No.${String(p.pokeNo).padStart(3, "0")}` },
  { label: "タイプ", render: (p) => typeBadge(p.t1) + typeBadge(p.t2) },
  {
    label: "特性",
    render: (p) => escapeHtml([p.tokusei1, p.tokusei2].filter((a) => a && a !== "なし").join(" / ") || "-"),
  },
  { label: "持ち物", render: (p) => escapeHtml(p.itemName || "なし") },
  { label: "性格", render: (p) => escapeHtml(p.nNAME || "-") },
  {
    label: "技(ホバーで効果表示)",
    render: (p) =>
      movesOf(p)
        .map((m) => `<span class="move-chip" title="${escapeHtml(m.effect || "-")}">${escapeHtml(m.name)}</span>`)
        .join(" "),
  },
  { label: "種族値 H", render: (p) => p.shH },
  { label: "種族値 A", render: (p) => p.shA },
  { label: "種族値 B", render: (p) => p.shB },
  { label: "種族値 C", render: (p) => p.shC },
  { label: "種族値 D", render: (p) => p.shD },
  { label: "種族値 S", render: (p) => p.shS },
  { label: "重さ(kg)", render: (p) => p.weight },
];

function renderCompareSection() {
  const container = document.getElementById("compare-section");
  if (compareSelection.size === 0) {
    container.innerHTML = "";
    return;
  }
  const items = Array.from(compareSelection.values());

  const headerCells = items
    .map(
      (p) => `
      <th>
        <div class="compare-col-header" data-pokeno-thumb="${p.pokeNo}" data-name-thumb="${escapeHtml(p.NAME)}">
          <span class="poke-card__img-wrap is-loading" data-pokeno="${p.pokeNo}" data-name="${escapeHtml(p.NAME)}"></span>
          <span>${escapeHtml(p.NAME)}</span>
          <button class="compare-col-remove" data-remove-bfno="${p.bfNo}" title="比較から外す">✕</button>
        </div>
      </th>`
    )
    .join("");

  const bodyRows = COMPARE_ROWS.map(
    (row) => `
      <tr>
        <th class="compare-table__row-label">${escapeHtml(row.label)}</th>
        ${items.map((p) => `<td>${row.render(p)}</td>`).join("")}
      </tr>`
  ).join("");

  container.innerHTML = `
    <div class="compare-section">
      <h2 class="section-title">比較表(${items.length}件)</h2>
      <table class="compare-table">
        <thead><tr><th class="compare-table__row-label"></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  container.querySelectorAll(".poke-card__img-wrap").forEach((el) => spriteObserver.observe(el));
  container.querySelectorAll("[data-remove-bfno]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bfNo = Number(btn.dataset.removeBfno);
      const p = compareSelection.get(bfNo);
      if (p) toggleCompare(p, false);
    });
  });
}

function initCompareBar() {
  document.getElementById("compare-bar-scroll").addEventListener("click", () => {
    document.getElementById("compare-section").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("compare-bar-clear").addEventListener("click", () => {
    Array.from(compareSelection.keys()).forEach((bfNo) => {
      const p = compareSelection.get(bfNo);
      if (p) toggleCompare(p, false);
    });
  });
}

function renderStatCalculator(p) {
  const defaultLevel = Number(appState.levelMode) || 50;
  const selfOptions = getSelfKotaOptions(p.bfNo, defaultLevel);
  const opponentOptions = getOpponentKotaOptions();

  const details = document.createElement("details");
  details.className = "stat-calc";

  const summary = document.createElement("summary");
  summary.textContent = "実数値を計算する";
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "stat-calc__body";
  body.innerHTML = `
    <div class="stat-calc__row">
      <label>Lv: <input type="number" class="stat-calc__lv" min="1" max="100" value="${defaultLevel}" /></label>
      <label>個体値:
        <select class="stat-calc__iv">
          <optgroup label="自分(レンタル解放状況)">
            ${selfOptions.map((iv) => `<option value="${iv}">${iv}</option>`).join("")}
          </optgroup>
          <optgroup label="相手(バトルファクトリー周回数)">
            ${opponentOptions
              .map(([lap, kota]) => `<option value="${kota}">${lap}周目(個体値${kota})</option>`)
              .join("")}
          </optgroup>
        </select>
      </label>
    </div>
    <div class="stat-calc__labels">H&nbsp;-&nbsp;A&nbsp;-&nbsp;B&nbsp;-&nbsp;C&nbsp;-&nbsp;D&nbsp;-&nbsp;S</div>
    <div class="stat-calc__result-line"></div>
  `;
  details.appendChild(body);

  const lvInput = body.querySelector(".stat-calc__lv");
  const ivSelect = body.querySelector(".stat-calc__iv");
  const resultLine = body.querySelector(".stat-calc__result-line");

  function refreshSelfOptions() {
    const level = Number(lvInput.value);
    const opts = getSelfKotaOptions(p.bfNo, level);
    const optgroup = ivSelect.querySelector("optgroup");
    optgroup.innerHTML = opts.map((iv) => `<option value="${iv}">${iv}</option>`).join("");
  }

  function recompute() {
    const level = Math.min(100, Math.max(1, Number(lvInput.value) || 1));
    const iv = Number(ivSelect.value) || 0;
    const stats = computeRealStats(p, level, iv);
    // my_status.js と同じ「H-A-B-C-D-S」ハイフン区切りの実数値表示形式
    resultLine.textContent = ["H", "A", "B", "C", "D", "S"].map((key) => stats[key]).join("-");
  }

  lvInput.addEventListener("input", () => {
    refreshSelfOptions();
    recompute();
  });
  ivSelect.addEventListener("change", recompute);

  recompute();

  return details;
}

// --- カード表示の共通生成(ポケモン検索/技逆引き/持ち物逆引き/タイプ別一覧で共用) ---

function renderPokemonCard(p, options) {
  const opts = options || {};
  const card = document.createElement("article");
  card.className = "card poke-card";
  card.dataset.bfno = p.bfNo;
  if (isSelectedForCompare(p)) card.classList.add("is-selected-for-compare");

  const top = document.createElement("div");
  top.className = "poke-card__top";
  top.appendChild(makeSpriteWrapEl(p.pokeNo, p.NAME));

  const nameWrap = document.createElement("div");
  const nameEl = document.createElement("p");
  nameEl.className = "poke-card__name";
  nameEl.textContent = p.NAME;
  const noEl = document.createElement("p");
  noEl.className = "poke-card__no";
  noEl.textContent = `全国図鑑No.${String(p.pokeNo).padStart(3, "0")}`;
  nameWrap.appendChild(nameEl);
  nameWrap.appendChild(noEl);
  top.appendChild(nameWrap);
  card.appendChild(top);

  const badges = document.createElement("div");
  badges.className = "type-badges";
  badges.innerHTML = typeBadge(p.t1) + typeBadge(p.t2);
  card.appendChild(badges);

  const abilities = [p.tokusei1, p.tokusei2].filter((a) => a && a !== "なし");
  const meta = document.createElement("p");
  meta.className = "poke-card__meta";
  meta.textContent = `特性: ${abilities.length ? abilities.join(" / ") : "-"}`;
  card.appendChild(meta);

  const item = document.createElement("p");
  item.className = "poke-card__meta";
  item.textContent = `持ち物: ${p.itemName || "なし"} / 性格: ${p.nNAME || "-"}`;
  card.appendChild(item);

  const moves = movesOf(p);
  const highlightNos = opts.highlightMoveNos || null;
  const movesWrap = document.createElement("div");
  movesWrap.className = "poke-card__moves";
  movesWrap.innerHTML = moves
    .map((m) => {
      const hit = highlightNos && highlightNos.has(m.no);
      return `
        <div class="move-row">
          <span class="move-chip${hit ? " move-chip--hit" : ""}">${escapeHtml(m.name)}</span>
          <span class="move-row__effect">${escapeHtml(m.effect || "-")}</span>
        </div>`;
    })
    .join("");
  card.appendChild(movesWrap);

  // 種族値の生の数値は表示しない(my_status.js と同様、実数値のみを表示する)
  card.appendChild(renderStatCalculator(p));

  const compareLabel = document.createElement("label");
  compareLabel.className = "poke-card__compare-check";
  const compareInput = document.createElement("input");
  compareInput.type = "checkbox";
  compareInput.checked = isSelectedForCompare(p);
  compareInput.addEventListener("change", (e) => toggleCompare(p, e.target.checked));
  compareLabel.appendChild(compareInput);
  compareLabel.appendChild(document.createTextNode("比較に追加"));
  card.appendChild(compareLabel);

  return card;
}

// --- ポケモン検索(名前・タイプ・Lvモード候補プール) ---

const pokemonState = { query: "", type: "", page: 0 };

function getFilteredPokemon() {
  const q = pokemonState.query.trim();
  const type = pokemonState.type;
  return getCandidateBfData()
    .filter((p) => {
      if (type && p.t1 !== type && p.t2 !== type) return false;
      if (!q) return true;
      return textIncludes(p.NAME, q) || String(p.pokeNo) === normalizeForSearch(q);
    })
    .sort((a, b) => a.pokeNo - b.pokeNo || a.bfNo - b.bfNo);
}

function renderPokemonResults() {
  const listEl = document.getElementById("pokemon-results");
  const countEl = document.getElementById("pokemon-result-count");
  const loadMoreBtn = document.getElementById("pokemon-load-more");
  const all = getFilteredPokemon();

  if (pokemonState.page === 0) listEl.innerHTML = "";

  countEl.textContent = `${all.length}件中 ${Math.min(
    all.length,
    (pokemonState.page + 1) * PAGE_SIZE
  )}件を表示(Lv${appState.levelMode}の候補プール内)`;

  if (all.length === 0) {
    listEl.innerHTML = '<p class="empty-state">該当するポケモンが見つかりませんでした。</p>';
    loadMoreBtn.hidden = true;
    return;
  }

  const start = pokemonState.page * PAGE_SIZE;
  const pageItems = all.slice(start, start + PAGE_SIZE);
  pageItems.forEach((p) => listEl.appendChild(renderPokemonCard(p)));

  loadMoreBtn.hidden = start + PAGE_SIZE >= all.length;
}

function initPokemonPanel() {
  const typeSelect = document.getElementById("pokemon-type-filter");
  getUsableTypeNames().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  document.getElementById("pokemon-search-input").addEventListener("input", (e) => {
    pokemonState.query = e.target.value;
    pokemonState.page = 0;
    renderPokemonResults();
  });
  typeSelect.addEventListener("change", (e) => {
    pokemonState.type = e.target.value;
    pokemonState.page = 0;
    renderPokemonResults();
  });
  document.getElementById("pokemon-load-more").addEventListener("click", () => {
    pokemonState.page += 1;
    renderPokemonResults();
  });

  renderPokemonResults();
}

// --- 技から探す: 逆引き(パターンA: 技名のみ / パターンB: 技名+ポケモン名) ---

const moveLookupState = { moveQuery: "", pokeQuery: "" };

function getMoveLookupResults() {
  const moveQ = moveLookupState.moveQuery.trim();
  if (!moveQ) return { hasQuery: false, items: [], matchedMoveNos: new Set() };

  const matchedMoveNos = new Set(
    weaponsdata.filter((m) => textIncludes(m.name, moveQ)).map((m) => m.no)
  );

  const pokeQ = moveLookupState.pokeQuery.trim();
  const items = getCandidateBfData()
    .filter((p) => {
      const hasMove = [p.weapon1, p.weapon2, p.weapon3, p.weapon4].some((no) => matchedMoveNos.has(no));
      if (!hasMove) return false;
      if (pokeQ && !textIncludes(p.NAME, pokeQ)) return false;
      return true;
    })
    .sort((a, b) => a.pokeNo - b.pokeNo || a.bfNo - b.bfNo);

  return { hasQuery: true, items, matchedMoveNos };
}

function renderMoveLookupResults() {
  const listEl = document.getElementById("move-lookup-results");
  const countEl = document.getElementById("move-lookup-result-count");
  const { hasQuery, items, matchedMoveNos } = getMoveLookupResults();

  if (!hasQuery) {
    countEl.textContent = "";
    listEl.innerHTML = '<p class="empty-state">まず技名を入力してください(例: 10まんボルト)。</p>';
    return;
  }

  const pokeQ = moveLookupState.pokeQuery.trim();
  countEl.textContent = pokeQ
    ? `「${moveLookupState.moveQuery}」を持つ「${pokeQ}」のセット: ${items.length}件(Lv${appState.levelMode})`
    : `「${moveLookupState.moveQuery}」を持つ可能性のあるセット: ${items.length}件(Lv${appState.levelMode})`;

  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML = '<p class="empty-state">該当するセットが見つかりませんでした。</p>';
    return;
  }
  items.forEach((p) => listEl.appendChild(renderPokemonCard(p, { highlightMoveNos: matchedMoveNos })));
}

function initMoveLookupPanel() {
  document.getElementById("move-lookup-move-input").addEventListener("input", (e) => {
    moveLookupState.moveQuery = e.target.value;
    renderMoveLookupResults();
  });
  document.getElementById("move-lookup-poke-input").addEventListener("input", (e) => {
    moveLookupState.pokeQuery = e.target.value;
    renderMoveLookupResults();
  });
  renderMoveLookupResults();
}

// --- 技図鑑(技マスタ一覧、単純検索) ---

const moveDictState = { query: "", type: "", cls: "" };

function getFilteredMoveDict() {
  const q = moveDictState.query.trim();
  return weaponsdata.filter((m) => {
    if (moveDictState.type && m.wtype !== moveDictState.type) return false;
    if (moveDictState.cls && m.moveClass !== moveDictState.cls) return false;
    if (!q) return true;
    return textIncludes(m.name, q);
  });
}

function renderMoveDictResults() {
  const tbody = document.getElementById("move-results");
  const countEl = document.getElementById("move-result-count");
  const items = getFilteredMoveDict();
  countEl.textContent = `${items.length}件`;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">該当する技が見つかりませんでした。</td></tr>';
    return;
  }

  tbody.innerHTML = items
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${typeBadge(m.wtype)}</td>
        <td>${escapeHtml(m.moveClass)}</td>
        <td>${m.power > 0 ? m.power : "-"}</td>
        <td>${m.accuracy > 0 ? m.accuracy : "-"}</td>
        <td>${m.pp}</td>
        <td>${escapeHtml(m.effect || "-")}</td>
      </tr>`
    )
    .join("");
}

function initMoveDictPanel() {
  const typeSelect = document.getElementById("move-type-filter");
  getUsableTypeNames().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  const classSelect = document.getElementById("move-class-filter");
  const classes = Array.from(new Set(weaponsdata.map((m) => m.moveClass))).sort();
  classes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classSelect.appendChild(opt);
  });

  document.getElementById("move-search-input").addEventListener("input", (e) => {
    moveDictState.query = e.target.value;
    renderMoveDictResults();
  });
  typeSelect.addEventListener("change", (e) => {
    moveDictState.type = e.target.value;
    renderMoveDictResults();
  });
  classSelect.addEventListener("change", (e) => {
    moveDictState.cls = e.target.value;
    renderMoveDictResults();
  });

  renderMoveDictResults();
}

function initMoveSubtabs() {
  const buttons = document.querySelectorAll("#panel-move .subtabs__btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.subtab;
      buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
      document.getElementById("subpanel-move-lookup").hidden = target !== "move-lookup";
      document.getElementById("subpanel-move-dict").hidden = target !== "move-dict";
    });
  });
}

// --- 持ち物から探す: 逆引き(パターンA: 持ち物名のみ / パターンB: 持ち物名+ポケモン名) ---

const itemLookupState = { itemQuery: "", pokeQuery: "" };

function buildItemIndexFrom(list) {
  const map = new Map();
  list.forEach((p) => {
    const key = p.itemName || "なし";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return map;
}

function renderItemResults() {
  const listEl = document.getElementById("item-results");
  const countEl = document.getElementById("item-result-count");
  const itemQ = itemLookupState.itemQuery.trim();
  const pokeQ = itemLookupState.pokeQuery.trim();

  const base = getCandidateBfData().filter((p) => !pokeQ || textIncludes(p.NAME, pokeQ));
  const index = buildItemIndexFrom(base);

  const entries = Array.from(index.entries())
    .filter(([name]) => !itemQ || textIncludes(name, itemQ))
    .sort((a, b) => b[1].length - a[1].length);

  countEl.textContent = `${entries.length}種類の持ち物(Lv${appState.levelMode}の候補プール内${
    pokeQ ? `, ポケモン名で絞り込み中` : ""
  })`;

  if (entries.length === 0) {
    listEl.innerHTML = '<p class="empty-state">該当する持ち物が見つかりませんでした。</p>';
    return;
  }

  listEl.innerHTML = entries
    .map(([name, holders]) => {
      const shown = holders.slice(0, 20);
      const rest = holders.length - shown.length;
      const chips = shown
        .map((h) => `<span class="move-chip">${escapeHtml(h.NAME)}</span>`)
        .join("");
      return `
        <article class="card">
          <p class="item-card__name">${escapeHtml(name)}</p>
          <p class="item-card__count">${holders.length}件のセットで使用</p>
          <div class="item-card__holders">${chips}${
        rest > 0 ? `<span class="move-chip">…他${rest}件</span>` : ""
      }</div>
        </article>`;
    })
    .join("");
}

function initItemPanel() {
  document.getElementById("item-search-input").addEventListener("input", (e) => {
    itemLookupState.itemQuery = e.target.value;
    renderItemResults();
  });
  document.getElementById("item-poke-input").addEventListener("input", (e) => {
    itemLookupState.pokeQuery = e.target.value;
    renderItemResults();
  });
  renderItemResults();
}

// --- タイプ検索(候補プール内の一覧+被弾倍率) ---

function getUsableTypeNames() {
  return tName.filter((t) => t && t !== "？？？");
}

function getEffectivenessAgainst(defenderType) {
  return getUsableTypeNames().map((attackerType) => {
    const row = typeChart.find((r) => r.type === attackerType);
    const mult = row && row[defenderType] !== undefined ? row[defenderType] : 1;
    return { attackerType, mult };
  });
}

function multClass(mult) {
  if (mult === 0) return "mult-0";
  if (mult === 0.25) return "mult-0-25";
  if (mult === 0.5) return "mult-0-5";
  if (mult === 2) return "mult-2";
  if (mult === 4) return "mult-4";
  return "mult-1";
}

let currentTypeSelection = "";

function renderTypeDetail(typeName) {
  currentTypeSelection = typeName;
  const detailEl = document.getElementById("type-detail");
  if (!typeName) {
    detailEl.innerHTML = "";
    return;
  }

  const eff = getEffectivenessAgainst(typeName).sort((a, b) => b.mult - a.mult);
  const effHtml = eff
    .map(
      (e) => `
      <div class="type-eff-card">
        <span>${typeBadge(e.attackerType)}</span>
        <span class="type-eff-card__mult ${multClass(e.mult)}">×${e.mult}</span>
      </div>`
    )
    .join("");

  const pokemonOfType = getCandidateBfData()
    .filter((p) => p.t1 === typeName || p.t2 === typeName)
    .sort((a, b) => a.pokeNo - b.pokeNo || a.bfNo - b.bfNo);

  detailEl.innerHTML = `
    <h2 class="section-title">「${escapeHtml(typeName)}」タイプの被弾倍率(各タイプの技を受けた場合)</h2>
    <div class="type-effectiveness">${effHtml}</div>
    <h2 class="section-title">「${escapeHtml(typeName)}」タイプの候補ポケモン(${pokemonOfType.length}件, Lv${appState.levelMode})</h2>
    <div class="card-grid" id="type-pokemon-results"></div>
  `;

  const listEl = document.getElementById("type-pokemon-results");
  pokemonOfType.forEach((p) => listEl.appendChild(renderPokemonCard(p)));
}

function initTypePanel() {
  const select = document.getElementById("type-select");
  getUsableTypeNames().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
  select.addEventListener("change", (e) => renderTypeDetail(e.target.value));
}

// --- Lv50 / Lv100 候補プール切り替え(全パネルに影響) ---

function updateLevelToggleHint() {
  const hint = document.getElementById("level-toggle-hint");
  hint.textContent = `Lv50: ${CANDIDATE_SETS[50].size}種 / Lv100: ${CANDIDATE_SETS[100].size}種(グループ4・8のみ)`;
}

function initLevelToggle() {
  updateLevelToggleHint();
  const buttons = document.querySelectorAll(".level-toggle__btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = btn.dataset.level;
      if (level === appState.levelMode) return;
      appState.levelMode = level;
      buttons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      });

      // 候補プールが変わるため、各パネルの表示をすべて再計算する
      pokemonState.page = 0;
      renderPokemonResults();
      renderMoveLookupResults();
      renderItemResults();
      if (currentTypeSelection) renderTypeDetail(currentTypeSelection);
    });
  });
}

// --- タブ切り替え ---

function initTabs() {
  const buttons = document.querySelectorAll(".tabs > .tabs__btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      buttons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      document.querySelectorAll(".panel").forEach((panel) => {
        const isTarget = panel.id === `panel-${target}`;
        panel.hidden = !isTarget;
        panel.classList.toggle("is-active", isTarget);
      });
    });
  });
}

// --- 初期化 ---

document.addEventListener("DOMContentLoaded", () => {
  initLevelToggle();
  initTabs();
  initCompareBar();
  initPokemonPanel();
  initMoveSubtabs();
  initMoveLookupPanel();
  initMoveDictPanel();
  initItemPanel();
  initTypePanel();
});
