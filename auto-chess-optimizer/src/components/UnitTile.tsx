import { SYNERGIES } from "@/data/synergies";
import type { Unit } from "@/data/types";
import { COST_STYLE, COST_TEXT } from "@/lib/labels";

interface Props {
  unit: Unit;
  variant?: "pool" | "locked" | "added";
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

const VARIANT_STYLE = {
  pool: "",
  locked: "opacity-70",
  added: "ring-2 ring-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.5)]",
};

export function UnitTile({ unit, variant = "pool", count, onClick, disabled, compact }: Props) {
  const traits = [...unit.races, ...unit.classes].map((id) => SYNERGIES[id]);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      title={`${unit.nameJa} (${unit.name}) / コスト${unit.cost} / ${traits.map((t) => t.nameJa).join("・")}`}
      className={`relative flex min-w-0 flex-col rounded-lg border-l-4 px-2 py-1.5 text-left transition ${COST_STYLE[unit.cost]} ${VARIANT_STYLE[variant]} ${
        onClick ? "hover:brightness-125 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40" : ""
      }`}
    >
      {variant === "added" && (
        <span className="absolute -top-2 -right-1 rounded bg-amber-300 px-1 text-[10px] font-bold text-slate-900">
          BUY
        </span>
      )}
      {count !== undefined && count > 0 && (
        <span className="absolute -top-2 -right-1 rounded-full bg-cyan-400 px-1.5 text-[10px] font-bold text-slate-900">
          ×{count}
        </span>
      )}
      <span className="flex items-baseline gap-1">
        <span className={`text-[11px] font-bold ${COST_TEXT[unit.cost]}`}>{unit.cost}</span>
        <span className={`truncate font-semibold ${compact ? "text-xs" : "text-sm"}`}>{unit.nameJa}</span>
      </span>
      {!compact && (
        <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] leading-tight">
          {traits.map((t) => (
            <span key={t.id} className={t.kind === "race" ? "text-teal-300" : "text-orange-300"}>
              {t.nameJa}
            </span>
          ))}
        </span>
      )}
    </Tag>
  );
}
