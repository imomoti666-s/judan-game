import test from "node:test";
import assert from "node:assert/strict";

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
    return this.values.has(value);
  }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.innerHTML = "";
    this.textContent = "";
    this.attributes = new Map();
  }
  addEventListener() {}
  setPointerCapture() {}
  querySelectorAll() { return []; }
  querySelector() { return new FakeElement(); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  click() {}
}

function canvasContext(calls = []) {
  const gradient = { addColorStop() {} };
  const target = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 0 }),
  };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      if (typeof key === "symbol") return object[key];
      return (...args) => calls.push({ type: "call", key, args });
    },
    set(object, key, value) {
      object[key] = value;
      calls.push({ type: "set", key, value });
      return true;
    },
  });
}

test("ブラウザ初期化後に出撃し、自動射撃とボス生成まで進む", async () => {
  const elements = new Map();
  const canvas = new FakeElement();
  canvas.width = 450;
  canvas.height = 800;
  canvas.getContext = () => canvasContext();
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, width: 450, height: 800 });
  elements.set("#game", canvas);

  globalThis.window = globalThis;
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return new FakeElement(); },
  };
  globalThis.localStorage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
  };
  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  globalThis.requestAnimationFrame = () => 0;
  globalThis.Image = class {
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
  };
  globalThis.window.addEventListener = () => {};
  globalThis.window.confirm = () => true;

  await import(`../src/game.js?runtime-test=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const game = globalThis.window.__judanGame;
  assert.ok(game);
  assert.equal(game.assetsReady, true);

  game.startRun(1);
  assert.equal(game.state, "playing");
  game.updateGame(0.02);
  assert.ok(game.playerShots.length > 0);

  const normalDrawCalls = [];
  game.player.focus = false;
  game.player.invincible = 0;
  game.drawPlayer(canvasContext(normalDrawCalls));
  const normalPlayerImage = normalDrawCalls.find((entry) => entry.type === "call" && entry.key === "drawImage");
  assert.equal(normalPlayerImage.args[7], 184);
  assert.equal(normalPlayerImage.args[8], 184);
  assert.ok(normalDrawCalls.some((entry) => entry.type === "set" && entry.key === "globalAlpha" && entry.value === 0.62));
  assert.ok(normalDrawCalls.some((entry) => entry.type === "set" && entry.key === "fillStyle" && entry.value === "#ff334d"));

  const focusDrawCalls = [];
  game.player.focus = true;
  game.player.invincible = 0;
  game.drawPlayer(canvasContext(focusDrawCalls));
  const playerImage = focusDrawCalls.find((entry) => entry.type === "call" && entry.key === "drawImage");
  assert.equal(playerImage.args[7], 176);
  assert.equal(playerImage.args[8], 176);
  assert.ok(focusDrawCalls.some((entry) => entry.type === "set" && entry.key === "globalAlpha" && entry.value === 0.46));
  assert.ok(focusDrawCalls.some((entry) => entry.type === "set" && entry.key === "fillStyle" && entry.value === "#ff334d"));

  game.build.stance = "araga";
  game.setShotMode(false);
  const normalMovement = game.getMovementMultiplier(0, -1);
  game.toggleShotMode();
  assert.equal(game.player.focus, true);
  assert.equal(game.getMovementMultiplier(0, -1), normalMovement);
  assert.equal(elements.get("#shot-mode-button").getAttribute("aria-pressed"), "true");
  assert.match(elements.get("#shot-mode-button").innerHTML, /集中/);
  game.setShotMode(false);
  game.build.stance = "seigaku";

  game.player.focus = false;
  game.option = { optionType: "homing", power: 1 };
  game.playerShots = [];
  game.player.fireTimer = 0;
  game.player.optionFireTimer = 999;
  game.updatePlayer(0.01);
  assert.ok(game.playerShots.length > 0);
  assert.ok(game.playerShots.every((shot) => shot.type === "base"));

  game.playerShots = [];
  game.player.fireTimer = 999;
  game.player.optionFireTimer = 0;
  game.updatePlayer(0.01);
  assert.ok(game.playerShots.length > 0);
  assert.ok(game.playerShots.every((shot) => shot.type === "homing"));

  const expectedSubShotCounts = { fan: 5, lance: 1, homing: 2, twin: 2 };
  const subDps = {};
  game.playerShots = [];
  game.fireMainShots(false);
  const mainDps = game.playerShots.reduce((sum, shot) => sum + shot.damage, 0) / game.getMainFireInterval(false);
  for (const [optionType, subCount] of Object.entries(expectedSubShotCounts)) {
    game.option = { optionType, power: 1 };
    game.playerShots = [];
    game.fireMainShots(false);
    game.fireOptionShots(false);
    const mainShots = game.playerShots.filter((shot) => shot.type === "base");
    const subShots = game.playerShots.filter((shot) => shot.type === optionType);
    assert.equal(mainShots.length, game.stats.projectiles, `${optionType}: main`);
    assert.equal(subShots.length, subCount, `${optionType}: sub`);
    subDps[optionType] = subShots.reduce((sum, shot) => sum + shot.damage, 0) / game.getOptionFireInterval(optionType);
    assert.ok(subDps[optionType] < mainDps * 0.35, `${optionType}: remains a sub-shot`);
  }
  assert.ok(subDps.homing < subDps.fan);
  assert.ok(subDps.homing < subDps.lance);
  assert.ok(subDps.homing < subDps.twin);
  assert.ok(game.playerShots.every((shot) => shot.x !== undefined));

  game.option = null;
  game.build = { stance: "araga", fangSigils: [], companionInscriptions: [] };
  game.playerShots = [];
  game.fireMainShots(false);
  const plainShot = game.playerShots[0];
  game.build.fangSigils = ["heavy"];
  game.playerShots = [];
  game.fireMainShots(false);
  assert.ok(game.playerShots[0].damage > plainShot.damage);
  assert.ok(Math.abs(game.playerShots[0].vy) < Math.abs(plainShot.vy));
  game.build.fangSigils = ["scatter"];
  game.playerShots = [];
  game.fireMainShots(false);
  assert.equal(game.playerShots.length, game.stats.projectiles + 2);

  game.option = { optionType: "homing", power: 1 };
  game.build.companionInscriptions = ["blaze", "eraser"];
  game.playerShots = [];
  game.fireOptionShots(false);
  assert.ok(game.playerShots.every((shot) => shot.burnDamage > 0 && shot.eraseBullets));

  const afflictedEnemy = {
    id: "afflicted",
    type: "orb",
    x: 120,
    y: 120,
    baseX: 120,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    radius: 12,
    reward: 1,
    color: "#fff",
    age: 0,
    shootTimer: 99,
    dead: false,
  };
  game.enemies = [afflictedEnemy];
  game.enemyBullets = [];
  game.playerShots = [{
    x: 120,
    y: 120,
    radius: 6,
    damage: 10,
    hitsLeft: 0,
    hitIds: new Set(),
    burnDamage: 4,
    burnDuration: 1.8,
    slowFactor: 0.68,
    slowDuration: 1.45,
  }];
  game.resolveCollisions();
  assert.equal(afflictedEnemy.hp, 90);
  assert.equal(afflictedEnemy.burnDamage, 4);
  assert.equal(afflictedEnemy.slowFactor, 0.68);

  const shieldBeforeErase = game.player.shield;
  game.enemies = [];
  game.player.invincible = 0;
  game.playerShots = [{
    x: game.player.x,
    y: game.player.y + 10,
    radius: 8,
    damage: 1,
    hitsLeft: 0,
    hitIds: new Set(),
    eraseBullets: true,
  }];
  game.enemyBullets = [{
    x: game.player.x,
    y: game.player.y + 10,
    radius: 6,
    grazed: false,
    remove: false,
  }];
  game.resolveCollisions();
  assert.equal(game.enemyBullets.length, 0);
  assert.equal(game.player.shield, shieldBeforeErase);

  game.build = { stance: "seigaku", fangSigils: [], companionInscriptions: [] };
  game.player.motionTimer = 0;
  const hpBeforeGuard = game.player.hp;
  game.damagePlayer();
  assert.equal(game.player.hp, hpBeforeGuard);
  assert.equal(game.player.stanceGuardCooldown, 7);

  const bombs = game.player.bombs;
  game.useBomb();
  assert.equal(game.player.bombs, bombs - 1);

  game.runTime = game.stage.duration + 1;
  game.updateSpawning(0.02);
  assert.ok(game.boss);
  assert.equal(game.enemies.includes(game.boss), true);

  game.finishRun(true);
  assert.match(elements.get("#modal-card").innerHTML, /随伴器/);
  assert.match(elements.get("#modal-card").innerHTML, /data-loot-index/);
});
