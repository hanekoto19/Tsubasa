import type { ClassId, Cost, RaceId, Unit } from "./types";

const unit = (
  id: string,
  name: string,
  nameJa: string,
  cost: Cost,
  races: RaceId[],
  classes: ClassId[],
): Unit => ({ id, name, nameJa, cost, races, classes });

/**
 * プロトタイプ用のサンプルデータ。
 * 実際のパッチの駒性能・構成とは一致しないため、本番では公式データに差し替えること。
 */
export const UNITS: Unit[] = [
  unit("lord-of-light", "Lord of Light", "光の主", 5, ["divinity"], ["mage"]),
  unit("thunder-deity", "Thunder Deity", "雷霆神", 5, ["divinity"], ["wizard"]),
  unit("sanctum-guardian", "Sanctum Guardian", "聖域の守護者", 3, ["divinity"], ["knight"]),
  unit("fate-weaver", "Fate Weaver", "運命の織り手", 4, ["divinity"], ["warlock"]),

  unit("abyss-stalker", "Abyss Stalker", "深淵の追跡者", 2, ["demon", "marine"], ["assassin"]),
  unit("hellfire-hexer", "Hellfire Hexer", "獄炎術士", 3, ["demon"], ["warlock"]),
  unit("shadow-hunter", "Shadow Hunter", "影の狩人", 4, ["demon"], ["demonHunter"]),

  unit("witch-slayer", "Witch Slayer", "魔女狩り", 2, ["human"], ["demonHunter"]),
  unit("court-magician", "Court Magician", "宮廷魔術師", 1, ["human"], ["wizard"]),
  unit("royal-knight", "Royal Knight", "王国騎士", 2, ["human"], ["knight"]),
  unit("sword-saint", "Sword Saint", "剣聖", 3, ["human"], ["warrior"]),
  unit("battle-mage", "Battle Mage", "戦闘魔導士", 3, ["human"], ["mage"]),
  unit("night-blade", "Night Blade", "夜刃", 4, ["human", "feathered"], ["assassin"]),

  unit("frost-archmage", "Frost Archmage", "氷晶の大魔導", 4, ["glacier"], ["wizard"]),
  unit("glacier-knight", "Glacier Knight", "氷河の騎士", 1, ["glacier"], ["knight"]),
  unit("frostblade", "Frostblade", "霜刃", 2, ["glacier"], ["warrior"]),
  unit("snowshade", "Snowshade", "雪影", 3, ["glacier"], ["assassin"]),
  unit("polar-hexer", "Polar Hexer", "極地の呪術師", 2, ["glacier"], ["warlock"]),
  unit("avalanche-titan", "Avalanche Titan", "雪崩の巨人", 5, ["glacier"], ["warrior"]),

  unit("stone-brute", "Stone Brute", "岩窟の荒くれ", 1, ["caves"], ["warrior"]),
  unit("cave-lurker", "Cave Lurker", "洞窟の潜伏者", 1, ["caves"], ["assassin"]),
  unit("crystal-mage", "Crystal Mage", "水晶のメイジ", 2, ["caves"], ["mage"]),
  unit("rock-knight", "Rock Knight", "岩鎧の騎士", 3, ["caves"], ["knight"]),
  unit("cavern-hexer", "Cavern Hexer", "洞窟の呪術師", 3, ["caves"], ["warlock"]),

  unit("wind-scout", "Wind Scout", "風の斥候", 1, ["feathered"], ["assassin"]),
  unit("sky-mage", "Sky Mage", "天空のメイジ", 1, ["feathered"], ["mage"]),
  unit("storm-wing", "Storm Wing", "嵐翼", 2, ["feathered", "marine"], ["assassin"]),
  unit("plume-knight", "Plume Knight", "羽根の騎士", 2, ["feathered", "marine"], ["knight"]),
  unit("sun-hawk", "Sun Hawk", "陽鷹", 3, ["feathered"], ["mage"]),
  unit("gale-warrior", "Gale Warrior", "疾風の戦士", 4, ["feathered"], ["warrior"]),

  unit("tide-oracle", "Tide Oracle", "潮の託宣者", 3, ["marine"], ["wizard"]),
];

export const UNIT_MAP: ReadonlyMap<string, Unit> = new Map(
  UNITS.map((u) => [u.id, u]),
);

export const getUnit = (id: string): Unit => {
  const found = UNIT_MAP.get(id);
  if (!found) throw new Error(`Unknown unit id: ${id}`);
  return found;
};
