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
    assert.ok(statSync(resolve(root, path)).isFile(), `${path} exists`);
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

test("自弾アトラスは4コマ・透過", () => {
  const path = resolve(root, "assets/sprites/player-shot.png");
  const info = execFileSync("identify", ["-format", "%wx%h %[channels] %[opaque]", path], { encoding: "utf8" });
  assert.match(info, /^256x96 srgba false$/);
});
