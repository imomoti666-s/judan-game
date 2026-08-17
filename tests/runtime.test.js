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
  }
  addEventListener() {}
  setPointerCapture() {}
  querySelectorAll() { return []; }
  querySelector() { return new FakeElement(); }
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

  const focusDrawCalls = [];
  game.player.focus = true;
  game.player.invincible = 0;
  game.drawPlayer(canvasContext(focusDrawCalls));
  const playerImage = focusDrawCalls.find((entry) => entry.type === "call" && entry.key === "drawImage");
  assert.equal(playerImage.args[7], 176);
  assert.equal(playerImage.args[8], 176);
  assert.ok(focusDrawCalls.some((entry) => entry.type === "set" && entry.key === "globalAlpha" && entry.value === 0.48));
  assert.ok(focusDrawCalls.some((entry) => entry.type === "set" && entry.key === "fillStyle" && entry.value === "#ff334d"));

  const bombs = game.player.bombs;
  game.useBomb();
  assert.equal(game.player.bombs, bombs - 1);

  game.runTime = game.stage.duration + 1;
  game.updateSpawning(0.02);
  assert.ok(game.boss);
  assert.equal(game.enemies.includes(game.boss), true);
});
