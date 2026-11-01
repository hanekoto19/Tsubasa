import type { Formation } from "@/lib/optimizer";
import { ARCHETYPE_LABEL, ARCHETYPE_STYLE } from "@/lib/labels";
import { SynergyChip } from "./SynergyChip";
import { UnitTile } from "./UnitTile";

interface Props {
  rank: number;
  formation: Formation;
}

export function FormationCard({ rank, formation: f }: Props) {
  const { score, flags } = f.evaluation;
  const addedCost = f.addedUnits.reduce((sum, u) => sum + u.cost, 0);
  const shown = f.evaluation.synergies.filter((s) => s.active || s.disabledReason);

  return (
    <article
      className={`rounded-2xl border p-4 ${
        rank === 1 ? "border-amber-300/60 bg-gradient-to-br from-amber-500/10 to-slate-900" : "border-white/10 bg-slate-900/70"
      }`}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`text-2xl font-black ${rank === 1 ? "text-amber-300" : "text-slate-400"}`}>#{rank}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ARCHETYPE_STYLE[f.archetype]}`}>
          {ARCHETYPE_LABEL[f.archetype]}
        </span>
        {flags.wizard4Applied && flags.wizard4Target && (
          <span className="text-xs text-violet-300">Wizard(4)で最大ティア化</span>
        )}
        <span className="ml-auto text-right">
          <span className="text-2xl font-bold tabular-nums">{f.objective}</span>
          <span className="ml-1 text-xs text-slate-400">pt</span>
        </span>
      </header>

      <div className="mb-3 rounded-lg bg-amber-300/10 px-3 py-2">
        <p className="mb-1.5 text-xs text-amber-200">
          買い足す駒 <span className="font-bold">{f.addedUnits.length}体</span>
          <span className="text-amber-200/70">(コスト合計 {addedCost})</span>
        </p>
        {f.addedUnits.length === 0 ? (
          <p className="text-xs text-slate-400">追加なし(手持ちで完成)</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {f.addedUnits.map((u) => (
              <UnitTile key={u.id} unit={u} variant="added" />
            ))}
          </div>
        )}
      </div>

      {f.lockedUnits.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-slate-400">手持ち(固定)</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {f.lockedUnits.map((u, i) => (
              <UnitTile key={`${u.id}-${i}`} unit={u} variant="locked" compact />
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <SynergyChip key={s.def.id} synergy={s} />
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          ["シナジー", score.synergy],
          ["駒戦力", score.unitPower],
          ["方針ボーナス", f.strategyBonus],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-white/5 py-1.5">
            <dt className="text-slate-400">{label}</dt>
            <dd className="text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
