import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("HTMLが参照する主要ファイルが揃っている", () => {
  const html = read("index.html");
  for (const path of ["style.css", "src/game.js", "manifest.webmanifest", "assets/ui/icon-192.png"]) {
    assert.ok(html.includes(path), `${path} is referenced`);
    assert.ok(statSync(resolve(root, path)).isFile(), `${path} exists`);
  }
});
test("ゲームが要求する固定DOM要素がHTMLに存在する", () => {
  const html = read("index.html");
  const game = read("src/game.js");
  const ids = [...game.matchAll(/querySelector\(\"#([a-z0-9-]+)\"\)/gi)].map((match) => match[1]);
  const dynamic = new Set(["result-return", "resume-run", "retreat-run"]);
  for (const id of ids) {
    if (!dynamic.has(id)) assert.match(html, new RegExp(`id=[\"']${id}[\"']`), `#${id} exists`);
  }
});

test("PWAマニフェストとサービスワーカーのキャッシュ対象が実在する", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.orientation, "portrait");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) assert.ok(statSync(resolve(root, icon.src)).isFile());

  const worker = read("sw.js");
  const shellBlock = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1];
  const paths = [...shellBlock.matchAll(/\"([^\"]+)\"/g)].map((match) => match[1]);
  for (const path of paths) {
    if (path === "./") continue;
    const filePath = path.split("?")[0];
    assert.ok(statSync(resolve(root, filePath)).isFile(), `${path} exists`);
  }
});

test("方向別アトラスは6コマ・透過・同一寸法", () => {
  for (const state of ["idle", "up", "down", "left", "right", "focus"]) {
    const path = resolve(root, `assets/sprites/boar-combat-${state}.png`);
    const info = execFileSync("identify", ["-format", "%wx%h %[channels] %[opaque]", path], { encoding: "utf8" });
    assert.match(info, /^1536x256 srgba false$/);
    assert.ok(statSync(path).size < 600_000);

    const trims = execFileSync("convert", [path, "-crop", "6x1@", "+repage", "-format", "%@\n", "info:"], {
      encoding: "utf8",
    }).trim().split("\n");
    assert.equal(trims.length, 6);
    for (const geometry of trims) {
      const [, width, height, x, y] = geometry.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/).map(Number);
      assert.ok(x > 0 && y > 0, `${state}: sprite has leading padding`);
      assert.ok(x + width < 256 && y + height < 256, `${state}: sprite has trailing padding`);
    }
  }
});

test("ホームは正面アトラス、戦闘は背面専用アトラスを使う", () => {
  const css = read("style.css");
  const game = read("src/game.js");
  assert.match(css, /assets\/sprites\/boar-idle\.png/);
  for (const state of ["idle", "up", "down", "left", "right", "focus"]) {
    assert.match(game, new RegExp(`assets/sprites/boar-combat-${state}\\.png`));
  }
  assert.doesNotMatch(game, /:\s*"assets\/sprites\/boar-idle\.png"/);
});

test("表示枠は端末内で正しい9:16を保つ", () => {
  const css = read("style.css");
  const viewport = css.match(/#viewport\s*\{([\s\S]*?)\}/)[1];
  assert.match(viewport, /width:\s*min\(100%,\s*calc\(100dvh \* 9 \/ 16\)\)/);
  assert.match(viewport, /height:\s*auto/);
  assert.match(viewport, /aspect-ratio:\s*9 \/ 16/);
  assert.doesNotMatch(viewport, /max-width:/);
});

test("自機を拡大し、通常・集中の両方で半透明の実当たり判定を描く", () => {
  const game = read("src/game.js");
  assert.match(game, /const PLAYER_DRAW_SIZE = 184/);
  assert.match(game, /const PLAYER_FOCUS_DRAW_SIZE = 176/);
  assert.match(game, /focused \? 0\.46 : 0\.62/);
  assert.match(game, /ctx\.fillStyle = "#ff334d"/);
  assert.match(game, /const playerHitRadius = this\.getPlayerHitRadius\(\)/);
  assert.match(game, /bullet\.radius \+ playerHitRadius/);
});

test("通常・集中は同じ移動速度で切り替わり、調律UIを備える", () => {
  const html = read("index.html");
  const data = read("src/data.js");
  const game = read("src/game.js");
  for (const id of ["shot-mode-button", "panel-build", "stance-list", "fang-sigil-list", "companion-inscription-list"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(game, /toggleShotMode/);
  assert.match(game, /const focused = this\.player\.focus/);
  assert.doesNotMatch(game, /this\.stats\.speed \* \(focused/);
  assert.match(data, /export const STANCE_TYPES/);
  assert.match(data, /export const FANG_SIGILS/);
  assert.match(data, /export const COMPANION_INSCRIPTIONS/);
});

test("通常装備と独立した随伴器UIが主砲を残して4系統の副砲を加える", () => {
  const html = read("index.html");
  const data = read("src/data.js");
  const game = read("src/game.js");
  for (const id of ["option-bay", "option-count", "equipped-option", "option-list"]) {
    assert.match(html, new RegExp(`id=[\"']${id}[\"']`));
  }
  for (const type of ["fan", "lance", "homing", "twin"]) {
    assert.match(data, new RegExp(`${type}:\\s*\\{`));
    assert.match(game, new RegExp(`type === [\"']${type}[\"']`));
  }
  assert.match(html, /基本の双牙弾は常時発射/);
  assert.match(game, /fireMainShots\(focused\)/);
  assert.match(game, /fireOptionShots\(focused\)/);
  assert.match(game, /const interval = this\.getMainFireInterval\(focused\) \/ overdriveRate/);
  assert.doesNotMatch(game, /this\.stats\.fireInterval \* optionInterval/);
  assert.match(game, /generateOptionDrop/);
  assert.match(game, /addOption/);
});

test("自弾アトラスは4コマ・透過", () => {
  const path = resolve(root, "assets/sprites/player-shot.png");
  const info = execFileSync("identify", ["-format", "%wx%h %[channels] %[opaque]", path], { encoding: "utf8" });
  assert.match(info, /^256x96 srgba false$/);
});
