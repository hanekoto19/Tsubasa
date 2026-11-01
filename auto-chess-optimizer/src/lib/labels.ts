import type { Cost } from "@/data/types";
import type { Route, Strategy } from "./optimizer";
import type { DisabledReason } from "./synergyEngine";

export const COST_STYLE: Record<Cost, string> = {
  1: "border-slate-400 bg-slate-500/15",
  2: "border-emerald-400 bg-emerald-500/15",
  3: "border-sky-400 bg-sky-500/15",
  4: "border-fuchsia-400 bg-fuchsia-500/15",
  5: "border-amber-400 bg-amber-500/15",
};

export const COST_TEXT: Record<Cost, string> = {
  1: "text-slate-300",
  2: "text-emerald-300",
  3: "text-sky-300",
  4: "text-fuchsia-300",
  5: "text-amber-300",
};

export const STRATEGY_LABEL: Record<Strategy, string> = {
  balance: "バランス",
  divinity: "神編成優先",
  wizard4: "ウィザード4優先",
};

export const ARCHETYPE_LABEL: Record<Route, string> = {
  balance: "シナジー最大化",
  divinity: "神編成",
  wizard4: "ウィザード4",
};

export const ARCHETYPE_STYLE: Record<Route, string> = {
  balance: "bg-slate-600/40 text-slate-200",
  divinity: "bg-yellow-500/20 text-yellow-200",
  wizard4: "bg-violet-500/25 text-violet-200",
};

export const DISABLED_LABEL: Record<DisabledReason, string> = {
  "demon-conflict": "悪魔が2種以上",
  "divinity-exclusive": "他種族が発動中",
};
