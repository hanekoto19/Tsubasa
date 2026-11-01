export type RaceId =
  | "divinity"
  | "demon"
  | "glacier"
  | "caves"
  | "human"
  | "feathered"
  | "marine";

export type ClassId =
  | "wizard"
  | "demonHunter"
  | "warrior"
  | "mage"
  | "warlock"
  | "knight"
  | "assassin";

export type SynergyId = RaceId | ClassId;

export type SynergyKind = "race" | "class";

export type Cost = 1 | 2 | 3 | 4 | 5;

export interface Unit {
  id: string;
  name: string;
  nameJa: string;
  cost: Cost;
  races: RaceId[];
  classes: ClassId[];
}

export interface SynergyTier {
  /** 発動に必要な(同名除外後の)駒の種類数 */
  count: number;
  /** 編成スコアへの寄与 */
  score: number;
  effect: string;
}

export interface SynergyDef {
  id: SynergyId;
  kind: SynergyKind;
  name: string;
  nameJa: string;
  /** count 昇順 */
  tiers: SynergyTier[];
}
