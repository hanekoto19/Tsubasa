"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { FormationCard } from "@/components/FormationCard";
import { HandBoard, MAX_SLOTS } from "@/components/HandBoard";
import { UnitPool } from "@/components/UnitPool";
import { UNITS } from "@/data/units";
import type { Unit } from "@/data/types";
import { optimizeFormation, type Strategy, type TargetSize } from "@/lib/optimizer";
import { STRATEGY_LABEL } from "@/lib/labels";
import { evaluateBoard } from "@/lib/synergyEngine";

export default function Home() {
  const [hand, setHand] = useState<Unit[]>([]);
  const [targetSize, setTargetSize] = useState<TargetSize>(8);
  const [strategy, setStrategy] = useState<Strategy>("balance");

  const handEvaluation = useMemo(() => evaluateBoard(hand), [hand]);
  const handCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of hand) counts.set(u.id, (counts.get(u.id) ?? 0) + 1);
    return counts;
  }, [hand]);

  const params = useMemo(() => ({ hand, targetSize, strategy }), [hand, targetSize, strategy]);
  const query = useDeferredValue(params);
  const result = useMemo(
    () => optimizeFormation({ lockedUnits: query.hand, targetSize: query.targetSize, strategy: query.strategy }),
    [query],
  );
  const isStale = query !== params;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <p className="text-xs tracking-widest text-cyan-300">AUTO CHESS · FORMATION SOLVER</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">最終編成逆算シミュレーター</h1>
        <p className="mt-1 text-sm text-slate-400">
          手持ちの駒を固定して、目標枠数での最強編成をビームサーチで逆算します(データはプロトタイプ用サンプル)。
        </p>
      </header>

      <div className="space-y-6">
        <UnitPool
          units={UNITS}
          handCounts={handCounts}
          isFull={hand.length >= MAX_SLOTS}
          onAdd={(u) => setHand((h) => (h.length >= MAX_SLOTS ? h : [...h, u]))}
        />

        <HandBoard
          hand={hand}
          evaluation={handEvaluation}
          targetSize={targetSize}
          strategy={strategy}
          onRemove={(i) => setHand((h) => h.filter((_, j) => j !== i))}
          onClear={() => setHand([])}
          onTargetSize={setTargetSize}
          onStrategy={setStrategy}
        />

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">
              おすすめ最終編成 トップ{result.formations.length}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {targetSize}枠 · {STRATEGY_LABEL[strategy]}
              </span>
            </h2>
            <p className={`text-xs ${isStale ? "text-cyan-300" : "text-slate-500"}`}>
              {isStale ? "計算中…" : `${result.evaluatedStates.toLocaleString()} 盤面を評価`}
            </p>
          </div>
          {hand.length > targetSize && (
            <p className="mb-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              手持ちが目標枠数({targetSize})を超えています。現在の手持ちをそのまま評価しています。
            </p>
          )}
          <div className={`grid gap-4 lg:grid-cols-2 ${isStale ? "opacity-60 transition-opacity" : ""}`}>
            {result.formations.map((f, i) => (
              <FormationCard
                key={f.addedUnits.map((u) => u.id).join("|") || "locked"}
                rank={i + 1}
                formation={f}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
