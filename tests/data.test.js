import test from "node:test";
import assert from "node:assert/strict";
import {
  OPTION_TYPES,
  addItem,
  addOption,
  applyRunRewards,
  buyUpgrade,
  createDefaultSave,
  dismantleItem,
  dismantleOption,
  equipItem,
  equipOption,
  generateLoot,
  generateOptionDrop,
  getDerivedStats,
  getEquippedOption,
  normalizeSave,
  rollRarity,
  statDescriptions,
  unequipOption,
  upgradeCost,
} from "../src/data.js";

test("初期装備から戦闘可能な能力値を作る", () => {
  const save = createDefaultSave();
  const stats = getDerivedStats(save);
  assert.equal(save.inventory.length, 3);
  assert.equal(stats.projectiles, 2);
  assert.ok(stats.damage > 0);
  assert.ok(stats.hp >= 3);
  assert.ok(stats.shield >= 2);
});
test("戦利品は指定スロットと説明可能な能力を持つ", () => {
  const values = [0.92, 0.1, 0.34, 0.77, 0.52, 0.2, 0.68, 0.4, 0.8];
  let index = 0;
  const rng = () => values[index++ % values.length];
  const item = generateLoot({ stage: 3, slot: "weapon", lootBonus: 0.4, rng });
  assert.equal(item.slot, "weapon");
  assert.ok(item.name.length > 4);
  assert.ok(Object.keys(item.stats).length >= 1);
  assert.ok(statDescriptions(item).length >= 1);
});

test("装備変更と分解は装備中・初期品を保護する", () => {
  const save = createDefaultSave();
  const item = generateLoot({ stage: 1, slot: "weapon", rng: () => 0.25 });
  assert.equal(addItem(save, item), true);
  assert.equal(equipItem(save, item.id), true);
  assert.equal(dismantleItem(save, item.id).ok, false);
  equipItem(save, "starter-weapon");
  const result = dismantleItem(save, item.id);
  assert.equal(result.ok, true);
  assert.ok(save.coins > 0);
});

test("出撃報酬でレベルと踏破状況が進む", () => {
  const save = createDefaultSave();
  const levels = applyRunRewards(save, { coins: 500, xp: 1000, cleared: true, stage: 2 });
  assert.ok(levels >= 1);
  assert.equal(save.bestStage, 2);
  assert.equal(save.clears, 1);
  assert.equal(save.coins, 500);
});

test("鍛錬購入は価格を払い能力へ反映される", () => {
  const save = createDefaultSave();
  save.coins = upgradeCost(0);
  const before = getDerivedStats(save).damage;
  assert.equal(buyUpgrade(save, "power").ok, true);
  assert.ok(getDerivedStats(save).damage > before);
});

test("壊れたセーブ値を安全な範囲へ正規化する", () => {
  const save = normalizeSave({ level: -9, coins: -100, inventory: "bad", settings: { sensitivity: 1.2 } });
  assert.equal(save.level, 1);
  assert.equal(save.coins, 0);
  assert.equal(save.inventory.length, 3);
  assert.deepEqual(save.optionInventory, []);
  assert.equal(save.equippedOption, null);
  assert.equal(save.settings.sensitivity, 1.2);
});

test("運気と深度は上位レアリティの抽選余地を持つ", () => {
  const low = rollRarity(1, 0, () => 0.01);
  const high = rollRarity(3, 2, () => 0.99);
  assert.equal(low, "rough");
  assert.equal(high, "cursed");
});

test("随伴器は4種の弾道を持ち、通常装備とは別枠で装着・分解できる", () => {
  const save = createDefaultSave();
  assert.equal(save.equippedOption, null);
  for (const optionType of Object.keys(OPTION_TYPES)) {
    const option = generateOptionDrop({ stage: 2, optionType, rng: () => 0.42 });
    assert.equal(option.kind, "option");
    assert.equal(option.optionType, optionType);
    assert.ok(option.power > 0);
    assert.equal(addOption(save, option), true);
  }
  const selected = save.optionInventory[0];
  assert.equal(equipOption(save, selected.id), true);
  assert.equal(getEquippedOption(save).id, selected.id);
  assert.equal(dismantleOption(save, selected.id).ok, false);
  unequipOption(save);
  assert.equal(dismantleOption(save, selected.id).ok, true);
  assert.equal(save.optionInventory.length, 3);
});
