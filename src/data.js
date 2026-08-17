export const SAVE_KEY = "judan-save-v1";
export const MAX_INVENTORY = 24;
export const MAX_OPTION_INVENTORY = 12;

export const SLOT_META = {
  weapon: { label: "牙砲", icon: "牙" },
  ward: { label: "護帯", icon: "守" },
  charm: { label: "霊具", icon: "霊" },
};

export const RARITIES = {
  rough: { label: "粗製", color: "#9ba5ad", affixes: 1, value: 24, multiplier: 0.85 },
  worked: { label: "加工", color: "#62d2a2", affixes: 2, value: 52, multiplier: 1 },
  secret: { label: "秘造", color: "#58aef0", affixes: 3, value: 110, multiplier: 1.15 },
  relic: { label: "遺物", color: "#b785ff", affixes: 4, value: 230, multiplier: 1.32 },
  cursed: { label: "厄物", color: "#ff735f", affixes: 4, value: 360, multiplier: 1.52 },
};

export const OPTION_TYPES = {
  fan: {
    label: "翠牙扇",
    icon: "扇",
    color: "#5ee1bf",
    shotLabel: "五裂散弾",
    description: "前方を広く薙ぐ五方向弾。低速中は扇が狭まり、正面へ収束する。",
  },
  lance: {
    label: "穿城牙",
    icon: "杭",
    color: "#ff8068",
    shotLabel: "大型貫通杭",
    description: "連射を捨て、敵をまとめて穿つ巨大な一本牙へ変える。",
  },
  homing: {
    label: "追魂灯",
    icon: "追",
    color: "#68bfff",
    shotLabel: "追尾牙弾",
    description: "敵を探して弧を描く追尾弾。動き回る相手への命中を優先する。",
  },
  twin: {
    label: "双衛輪",
    icon: "双",
    color: "#c28bff",
    shotLabel: "左右随伴砲",
    description: "自機の左右へ二基の砲輪を展開し、三列の平行射撃を行う。",
  },
};

const BASES = {
  weapon: ["牙灯", "穿ち牙", "散り牙", "脈動牙"],
  ward: ["厚毛の護帯", "静心の腹巻", "赤結びの護帯", "岩皮の羽織"],
  charm: ["擦火の数珠", "豊穣の鈴", "風渡りの緒", "猪目の護符"],
};

const AFFIXES = {
  weapon: [
    { name: "猛い", stat: "damage", min: 0.08, max: 0.2 },
    { name: "速射の", stat: "fireRate", min: 0.08, max: 0.22 },
    { name: "双牙の", stat: "projectiles", min: 1, max: 1, integer: true },
    { name: "穿孔の", stat: "pierce", min: 1, max: 2, integer: true },
    { name: "収束する", stat: "spread", min: -0.06, max: -0.025 },
    { name: "荒ぶる", stat: "spread", min: 0.025, max: 0.065 },
  ],
  ward: [
    { name: "強靱な", stat: "hp", min: 1, max: 2, integer: true },
    { name: "重ね守りの", stat: "shield", min: 1, max: 2, integer: true },
    { name: "獣力の", stat: "damage", min: 0.05, max: 0.12 },
    { name: "軽やかな", stat: "speed", min: 12, max: 28, integer: true },
    { name: "擦火の", stat: "graze", min: 3, max: 8, integer: true },
  ],
  charm: [
    { name: "招福の", stat: "loot", min: 0.08, max: 0.22 },
    { name: "疾風の", stat: "speed", min: 16, max: 38, integer: true },
    { name: "擦火の", stat: "graze", min: 4, max: 10, integer: true },
    { name: "猛い", stat: "damage", min: 0.04, max: 0.11 },
    { name: "早鐘の", stat: "fireRate", min: 0.05, max: 0.14 },
    { name: "小守りの", stat: "shield", min: 1, max: 1, integer: true },
  ],
};

const UPGRADE_META = {
  power: { label: "牙砲鍛錬", icon: "牙", text: "基礎威力と連射を鍛える。" },
  body: { label: "肉体鍛錬", icon: "体", text: "耐久と初期護りを増やす。" },
  focus: { label: "集中鍛錬", icon: "心", text: "低速時の威力とかすり範囲を伸ばす。" },
};

export function createStarterItems() {
  return [
    {
      id: "starter-weapon",
      slot: "weapon",
      rarity: "rough",
      name: "粗製・素朴な牙灯",
      stats: { damage: 0.04 },
      value: 0,
      starter: true,
    },
    {
      id: "starter-ward",
      slot: "ward",
      rarity: "rough",
      name: "粗製・厚毛の護帯",
      stats: { shield: 1 },
      value: 0,
      starter: true,
    },
    {
      id: "starter-charm",
      slot: "charm",
      rarity: "rough",
      name: "粗製・擦火の数珠",
      stats: { graze: 2 },
      value: 0,
      starter: true,
    },
  ];
}

export function createDefaultSave() {
  const inventory = createStarterItems();
  return {
    version: 2,
    level: 1,
    xp: 0,
    coins: 0,
    clears: 0,
    bestStage: 0,
    upgrades: { power: 0, body: 0, focus: 0 },
    inventory,
    optionInventory: [],
    equippedOption: null,
    equipped: {
      weapon: "starter-weapon",
      ward: "starter-ward",
      charm: "starter-charm",
    },
    settings: { volume: 0.55, sensitivity: 1, shake: true },
  };
}

export function normalizeSave(raw) {
  const base = createDefaultSave();
  if (!raw || typeof raw !== "object") return base;
  const inventory = Array.isArray(raw.inventory)
    ? raw.inventory.filter((item) => item && item.id && SLOT_META[item.slot] && RARITIES[item.rarity])
    : base.inventory;
  const optionInventory = Array.isArray(raw.optionInventory)
    ? raw.optionInventory.filter((item) => (
        item
        && item.id
        && item.kind === "option"
        && OPTION_TYPES[item.optionType]
        && RARITIES[item.rarity]
        && Number.isFinite(Number(item.power))
      ))
    : base.optionInventory;

  const merged = {
    ...base,
    ...raw,
    level: Math.max(1, Number(raw.level) || 1),
    xp: Math.max(0, Number(raw.xp) || 0),
    coins: Math.max(0, Math.floor(Number(raw.coins) || 0)),
    clears: Math.max(0, Math.floor(Number(raw.clears) || 0)),
    bestStage: Math.max(0, Math.min(3, Math.floor(Number(raw.bestStage) || 0))),
    upgrades: {
      power: normalizeUpgrade(raw.upgrades?.power),
      body: normalizeUpgrade(raw.upgrades?.body),
      focus: normalizeUpgrade(raw.upgrades?.focus),
    },
    settings: {
      volume: clampNumber(raw.settings?.volume, 0, 1, base.settings.volume),
      sensitivity: clampNumber(raw.settings?.sensitivity, 0.65, 1.5, base.settings.sensitivity),
      shake: raw.settings?.shake === undefined ? base.settings.shake : Boolean(raw.settings.shake),
    },
    inventory,
    optionInventory,
    equippedOption: raw.equippedOption || null,
    equipped: { ...base.equipped, ...(raw.equipped || {}) },
  };

  for (const slot of Object.keys(SLOT_META)) {
    if (!merged.inventory.some((item) => item.id === merged.equipped[slot] && item.slot === slot)) {
      merged.equipped[slot] = merged.inventory.find((item) => item.slot === slot)?.id || null;
    }
  }
  if (!merged.optionInventory.some((item) => item.id === merged.equippedOption)) merged.equippedOption = null;
  return merged;
}

function normalizeUpgrade(value) {
  return Math.max(0, Math.min(50, Math.floor(Number(value) || 0)));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    return raw ? normalizeSave(JSON.parse(raw)) : createDefaultSave();
  } catch {
    return createDefaultSave();
  }
}

export function persistSave(save, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(normalizeSave(save)));
    return true;
  } catch {
    return false;
  }
}

export function xpToNext(level) {
  return 110 + level * 70;
}

export function applyRunRewards(save, rewards) {
  save.coins += Math.max(0, Math.floor(rewards.coins || 0));
  save.xp += Math.max(0, Math.floor(rewards.xp || 0));
  if (rewards.cleared) {
    save.clears += 1;
    save.bestStage = Math.max(save.bestStage, rewards.stage || 1);
  }

  let levels = 0;
  while (save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level);
    save.level += 1;
    levels += 1;
  }
  return levels;
}

export function upgradeCost(currentLevel) {
  return Math.floor(80 * 1.38 ** currentLevel);
}

export function buyUpgrade(save, key) {
  if (!UPGRADE_META[key]) return { ok: false, reason: "unknown" };
  const current = Math.max(0, Math.floor(save.upgrades[key] || 0));
  const cost = upgradeCost(current);
  if (save.coins < cost) return { ok: false, reason: "coins", cost };
  save.coins -= cost;
  save.upgrades[key] = current + 1;
  return { ok: true, cost };
}

export function getUpgradeMeta() {
  return UPGRADE_META;
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function range(def, rng) {
  const value = def.min + (def.max - def.min) * rng();
  return def.integer ? Math.round(value) : Math.round(value * 1000) / 1000;
}

export function rollRarity(stage = 1, lootBonus = 0, rng = Math.random) {
  const luck = Math.max(0, lootBonus) * 100;
  const entries = [
    ["rough", Math.max(10, 48 - stage * 6 - luck * 0.3)],
    ["worked", Math.max(20, 34 - luck * 0.08)],
    ["secret", 12 + stage * 4 + luck * 0.2],
    ["relic", 3 + stage * 2 + luck * 0.12],
    ["cursed", 1 + stage * 0.9 + luck * 0.06],
  ];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return "rough";
}

export function generateLoot({ stage = 1, slot, lootBonus = 0, rng = Math.random } = {}) {
  const selectedSlot = slot || pick(Object.keys(SLOT_META), rng);
  const rarity = rollRarity(stage, lootBonus, rng);
  const rarityData = RARITIES[rarity];
  const stats = {};
  const chosen = [];
  const pool = [...AFFIXES[selectedSlot]];

  for (let i = 0; i < rarityData.affixes && pool.length; i += 1) {
    const index = Math.floor(rng() * pool.length) % pool.length;
    const def = pool.splice(index, 1)[0];
    const value = range(def, rng) * rarityData.multiplier;
    stats[def.stat] = Math.round(((stats[def.stat] || 0) + value) * 1000) / 1000;
    chosen.push(def.name);
  }

  if (rarity === "cursed") {
    if (selectedSlot === "weapon") {
      stats.projectiles = (stats.projectiles || 0) + 1;
      stats.speed = (stats.speed || 0) - 28;
    } else if (selectedSlot === "ward") {
      stats.hp = (stats.hp || 0) + 2;
      stats.fireRate = (stats.fireRate || 0) - 0.12;
    } else {
      stats.loot = (stats.loot || 0) + 0.24;
      stats.shield = (stats.shield || 0) - 1;
    }
    chosen.unshift("代償を孕む");
  }

  const baseName = pick(BASES[selectedSlot], rng);
  const affixName = chosen.slice(0, 2).join("・");
  return {
    id: randomId(),
    slot: selectedSlot,
    rarity,
    name: `${rarityData.label}・${affixName}${baseName}`,
    stats,
    value: Math.round(rarityData.value * (1 + stage * 0.14)),
  };
}

export function generateOptionDrop({ stage = 1, optionType, lootBonus = 0, rng = Math.random } = {}) {
  const selectedType = optionType || pick(Object.keys(OPTION_TYPES), rng);
  const meta = OPTION_TYPES[selectedType];
  if (!meta) return null;
  const rarity = rollRarity(stage, lootBonus, rng);
  const rarityData = RARITIES[rarity];
  const variance = 0.96 + rng() * 0.08;
  const power = Math.round((0.88 + stage * 0.045 + Math.max(0, lootBonus) * 0.16) * rarityData.multiplier * variance * 1000) / 1000;
  return {
    id: randomId(),
    kind: "option",
    optionType: selectedType,
    rarity,
    name: `${rarityData.label}・${meta.label}`,
    power,
    value: Math.round(rarityData.value * 1.55 * (1 + stage * 0.18)),
  };
}

export function addItem(save, item) {
  if (save.inventory.length >= MAX_INVENTORY) return false;
  save.inventory.push(item);
  return true;
}

export function equipItem(save, itemId) {
  const item = save.inventory.find((entry) => entry.id === itemId);
  if (!item) return false;
  save.equipped[item.slot] = item.id;
  return true;
}

export function dismantleItem(save, itemId) {
  const index = save.inventory.findIndex((entry) => entry.id === itemId);
  if (index < 0) return { ok: false, value: 0 };
  const item = save.inventory[index];
  if (item.starter || save.equipped[item.slot] === item.id) return { ok: false, value: 0 };
  save.inventory.splice(index, 1);
  save.coins += item.value;
  return { ok: true, value: item.value };
}

export function getEquippedItems(save) {
  return Object.fromEntries(
    Object.keys(SLOT_META).map((slot) => [
      slot,
      save.inventory.find((item) => item.id === save.equipped[slot]) || null,
    ]),
  );
}

export function addOption(save, item) {
  if (!item || item.kind !== "option" || !OPTION_TYPES[item.optionType]) return false;
  if (save.optionInventory.length >= MAX_OPTION_INVENTORY) return false;
  save.optionInventory.push(item);
  return true;
}

export function equipOption(save, itemId) {
  const item = save.optionInventory.find((entry) => entry.id === itemId);
  if (!item) return false;
  save.equippedOption = item.id;
  return true;
}

export function unequipOption(save) {
  save.equippedOption = null;
}

export function dismantleOption(save, itemId) {
  const index = save.optionInventory.findIndex((entry) => entry.id === itemId);
  if (index < 0 || save.equippedOption === itemId) return { ok: false, value: 0 };
  const [item] = save.optionInventory.splice(index, 1);
  save.coins += item.value;
  return { ok: true, value: item.value };
}

export function getEquippedOption(save) {
  return save.optionInventory.find((item) => item.id === save.equippedOption) || null;
}

export function optionDescription(item) {
  const meta = OPTION_TYPES[item?.optionType];
  if (!meta) return "不明な随伴器";
  return `${meta.shotLabel}・出力 ${Math.round(Number(item.power || 1) * 100)}%　${meta.description}`;
}

export function getDerivedStats(save) {
  const equipped = Object.values(getEquippedItems(save)).filter(Boolean);
  const bonus = equipped.reduce((sum, item) => {
    for (const [key, value] of Object.entries(item.stats || {})) sum[key] = (sum[key] || 0) + value;
    return sum;
  }, {});

  const power = Number(save.upgrades.power || 0);
  const body = Number(save.upgrades.body || 0);
  const focus = Number(save.upgrades.focus || 0);
  const levelBonus = Math.max(0, save.level - 1);
  const fireBonus = (bonus.fireRate || 0) + power * 0.025;

  return {
    damage: Math.round(18 * (1 + levelBonus * 0.055 + power * 0.085) * (1 + (bonus.damage || 0)) * 10) / 10,
    fireInterval: Math.max(0.072, 0.17 / Math.max(0.45, 1 + fireBonus)),
    projectiles: Math.max(1, 2 + Math.round(bonus.projectiles || 0)),
    spread: Math.max(0.035, 0.13 + (bonus.spread || 0)),
    pierce: Math.max(0, Math.round(bonus.pierce || 0)),
    hp: Math.max(1, 3 + Math.floor(body / 2) + Math.round(bonus.hp || 0)),
    shield: Math.max(0, 2 + body + Math.round(bonus.shield || 0)),
    speed: Math.max(145, 265 + (bonus.speed || 0)),
    grazeRadius: Math.max(18, 27 + focus * 1.6 + (bonus.graze || 0)),
    focusDamage: 1.15 + focus * 0.035,
    lootBonus: Math.max(0, bonus.loot || 0),
  };
}

export function statDescriptions(item) {
  const labels = {
    damage: ["威力", (value) => `${signed(value * 100)}%`],
    fireRate: ["連射", (value) => `${signed(value * 100)}%`],
    projectiles: ["弾数", (value) => signed(value)],
    spread: ["拡散", (value) => `${signed(value * 100)}%`],
    pierce: ["貫通", (value) => signed(value)],
    hp: ["耐久", (value) => signed(value)],
    shield: ["護り", (value) => signed(value)],
    speed: ["速度", (value) => signed(value)],
    graze: ["かすり", (value) => signed(value)],
    loot: ["運気", (value) => `${signed(value * 100)}%`],
  };
  return Object.entries(item.stats || {}).map(([key, value]) => {
    const [label, format] = labels[key] || [key, String];
    return `${label}${format(value)}`;
  });
}

function signed(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}
