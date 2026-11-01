import type { Unit } from "@/data/types";
import type { Strategy, TargetSize } from "@/lib/optimizer";
import { STRATEGY_LABEL } from "@/lib/labels";
import type { BoardEvaluation } from "@/lib/synergyEngine";
import { SynergyChip } from "./SynergyChip";
import { UnitTile } from "./UnitTile";

export const MAX_SLOTS = 10;

interface Props {
  hand: Unit[];
  evaluation: BoardEvaluation;
  targetSize: TargetSize;
  strategy: Strategy;
  onRemove: (index: number) => void;
  onClear: () => void;
  onTargetSize: (size: TargetSize) => void;
  onStrategy: (strategy: Strategy) => void;
}

const STRATEGIES: Strategy[] = ["balance", "divinity", "wizard4"];

export function HandBoard({
  hand,
  evaluation,
  targetSize,
  strategy,
  onRemove,
  onClear,
  onTargetSize,
  onStrategy,
}: Props) {
  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          現在の手持ち <span className="text-sm font-normal text-slate-400">{hand.length} / {MAX_SLOTS}</span>
        </h2>
        {hand.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-rose-300 hover:underline">
            全てクリア
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const unit = hand[i];
          const outOfTarget = i >= targetSize;
          if (!unit) {
            return (
              <div
                key={i}
                className={`flex h-12 items-center justify-center rounded-lg border border-dashed text-xs ${
                  outOfTarget ? "border-white/5 text-slate-700" : "border-white/20 text-slate-500"
                }`}
              >
                {i + 1}
              </div>
            );
          }
          return (
            <div key={i} className="group relative">
              <UnitTile unit={unit} compact />
              <button
                type="button"
                aria-label={`${unit.nameJa}を外す`}
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-xs leading-5 font-bold text-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
        {evaluation.synergies.length === 0 ? (
          <span className="text-xs text-slate-500">ユニットを追加すると現在のシナジーが表示されます</span>
        ) : (
          evaluation.synergies.map((s) => <SynergyChip key={s.def.id} synergy={s} />)
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex justify-between text-sm">
            <span>目標枠数(レベル)</span>
            <span className="font-bold text-cyan-300">{targetSize} 枠</span>
          </span>
          <input
            type="range"
            min={8}
            max={10}
            step={1}
            value={targetSize}
            onChange={(e) => onTargetSize(Number(e.target.value) as TargetSize)}
            className="w-full accent-cyan-400"
          />
          <span className="flex justify-between text-[10px] text-slate-500">
            <span>8</span>
            <span>9</span>
            <span>10</span>
          </span>
        </label>

        <div>
          <span className="mb-1 block text-sm">重視する方針</span>
          <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-white/5 p-0.5">
            {STRATEGIES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={strategy === s}
                onClick={() => onStrategy(s)}
                className={`rounded-md px-1 py-1.5 text-xs transition ${
                  strategy === s ? "bg-cyan-400 font-bold text-slate-900" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {STRATEGY_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
