import type { SynergyResult } from "@/lib/synergyEngine";
import { DISABLED_LABEL } from "@/lib/labels";

interface Props {
  synergy: SynergyResult;
}

export function SynergyChip({ synergy: s }: Props) {
  const isRace = s.def.kind === "race";
  const next = s.thresholds.find((t) => t > s.count);
  const shownTier = s.active ? s.tierIndex : s.naturalTierIndex;
  const tierCount = shownTier >= 0 ? s.def.tiers[shownTier].count : null;

  const tone = s.disabledReason
    ? "border-rose-500/50 bg-rose-500/10 text-rose-300 line-through decoration-rose-400/70"
    : s.boostedByWizard4
      ? "border-violet-400 bg-violet-500/25 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.45)]"
      : s.active
        ? isRace
          ? "border-teal-400/70 bg-teal-500/20 text-teal-100"
          : "border-orange-400/70 bg-orange-500/20 text-orange-100"
        : "border-white/10 bg-white/5 text-slate-400";

  const title = [
    s.active ? s.def.tiers[s.tierIndex].effect : null,
    s.disabledReason ? `無効: ${DISABLED_LABEL[s.disabledReason]}` : null,
    !s.active && !s.disabledReason && next ? `あと${next - s.count}体で発動` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${tone}`}
    >
      <span className="font-medium">{s.def.nameJa}</span>
      <span className="opacity-80">
        {tierCount !== null ? `(${tierCount})` : `${s.count}/${next ?? s.thresholds[0]}`}
      </span>
      {s.boostedByWizard4 && <span className="text-[10px] font-bold">W4★</span>}
      {s.disabledReason && (
        <span className="text-[10px] no-underline">{DISABLED_LABEL[s.disabledReason]}</span>
      )}
    </span>
  );
}
