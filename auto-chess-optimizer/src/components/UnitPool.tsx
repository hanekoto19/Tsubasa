"use client";

import { useMemo, useState } from "react";
import { SYNERGY_LIST } from "@/data/synergies";
import type { Cost, SynergyId, Unit } from "@/data/types";
import { COST_TEXT } from "@/lib/labels";
import { UnitTile } from "./UnitTile";

interface Props {
  units: readonly Unit[];
  handCounts: ReadonlyMap<string, number>;
  isFull: boolean;
  onAdd: (unit: Unit) => void;
}

const COSTS: Cost[] = [1, 2, 3, 4, 5];

const chip = (active: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs transition ${
    active ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
  }`;

export function UnitPool({ units, handCounts, isFull, onAdd }: Props) {
  const [costs, setCosts] = useState<Set<Cost>>(new Set());
  const [traits, setTraits] = useState<Set<SynergyId>>(new Set());

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const filtered = useMemo(
    () =>
      units
        .filter((u) => costs.size === 0 || costs.has(u.cost))
        .filter((u) => traits.size === 0 || [...u.races, ...u.classes].some((t) => traits.has(t)))
        .sort((a, b) => a.cost - b.cost || a.nameJa.localeCompare(b.nameJa, "ja")),
    [units, costs, traits],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">ユニット一覧</h2>
        <p className="text-xs text-slate-400">タップで手持ち(固定枠)に追加 ・ {filtered.length}体</p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-10 text-xs text-slate-400">コスト</span>
        {COSTS.map((c) => (
          <button key={c} type="button" className={chip(costs.has(c))} onClick={() => setCosts(toggle(costs, c))}>
            <span className={COST_TEXT[c]}>●</span> {c}
          </button>
        ))}
      </div>
      {(["race", "class"] as const).map((kind) => (
        <div key={kind} className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 text-xs text-slate-400">{kind === "race" ? "種族" : "クラス"}</span>
          {SYNERGY_LIST.filter((s) => s.kind === kind).map((s) => (
            <button key={s.id} type="button" className={chip(traits.has(s.id))} onClick={() => setTraits(toggle(traits, s.id))}>
              {s.nameJa}
            </button>
          ))}
        </div>
      ))}
      {(costs.size > 0 || traits.size > 0) && (
        <button
          type="button"
          className="mb-2 text-xs text-cyan-300 underline-offset-2 hover:underline"
          onClick={() => {
            setCosts(new Set());
            setTraits(new Set());
          }}
        >
          フィルタを解除
        </button>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {filtered.map((u) => (
          <UnitTile key={u.id} unit={u} count={handCounts.get(u.id)} disabled={isFull} onClick={() => onAdd(u)} />
        ))}
      </div>
    </section>
  );
}
