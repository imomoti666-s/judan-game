import {
  COMPANION_INSCRIPTIONS,
  FANG_SIGILS,
  MAX_INVENTORY,
  MAX_COMPANION_INSCRIPTIONS,
  MAX_FANG_SIGILS,
  MAX_OPTION_INVENTORY,
  OPTION_TYPES,
  RARITIES,
  SLOT_META,
  STANCE_TYPES,
  addItem,
  addOption,
  applyRunRewards,
  buyUpgrade,
  dismantleItem,
  dismantleOption,
  equipItem,
  equipOption,
  generateLoot,
  generateOptionDrop,
  getBuildConfig,
  getDerivedStats,
  getEquippedItems,
  getEquippedOption,
  getUpgradeMeta,
  loadSave,
  normalizeSave,
  optionDescription,
  persistSave,
  statDescriptions,
  setStance,
  toggleCompanionInscription,
  toggleFangSigil,
  unequipOption,
  upgradeCost,
  xpToNext,
} from "./data.js?v=0.3.0";

const WIDTH = 450;
const HEIGHT = 800;
const PLAY_BOTTOM = 724;
const PLAYER_DRAW_SIZE = 184;
const PLAYER_FOCUS_DRAW_SIZE = 176;
const PLAYER_HIT_RADIUS = 5;
const PLAYER_HIT_Y_OFFSET = 10;
const TAU = Math.PI * 2;
const OPTION_FIRE_INTERVAL = {
  fan: 0.62,
  lance: 1.1,
  homing: 0.76,
  twin: 0.34,
};

const STAGES = [
  {
    id: 1,
    name: "翠野・浅層",
    sub: "緩やかな円弾と小編隊。牙弾の扱いを覚える層。",
    duration: 42,
    bossHp: 1650,
    reward: 1,
    colors: ["#102a31", "#10131f"],
  },
  {
    id: 2,
    name: "紅霞・中層",
    sub: "狙い弾と交差弾が増える。加工以上の品が出やすい。",
    duration: 50,
    bossHp: 2850,
    reward: 1.5,
    colors: ["#351f32", "#111421"],
  },
  {
    id: 3,
    name: "深藍・獣核",
    sub: "高速弾と反転弾幕。遺物・厄物を狙う深部。",
    duration: 58,
    bossHp: 4300,
    reward: 2.2,
    colors: ["#182047", "#0b101d"],
  },
];

const SPRITE_PATHS = {
  idle: "assets/sprites/boar-combat-idle.png",
  up: "assets/sprites/boar-combat-up.png",
  down: "assets/sprites/boar-combat-down.png",
  left: "assets/sprites/boar-combat-left.png",
  right: "assets/sprites/boar-combat-right.png",
  focus: "assets/sprites/boar-combat-focus.png",
  shot: "assets/sprites/player-shot.png",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distanceSq = (a, b, x, y) => (a - x) ** 2 + (b - y) ** 2;

class JudanGame {
  constructor() {
    this.canvas = document.querySelector("#game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.save = loadSave();
    this.build = getBuildConfig(this.save);
    this.state = "menu";
    this.paused = false;
    this.assetsReady = false;
    this.images = {};
    this.keys = new Set();
    this.pointer = null;
    this.time = 0;
    this.lastTime = performance.now();
    this.shake = 0;
    this.toastTimer = 0;
    this.audio = null;
    this.shotSoundTick = 0;
    this.stars = Array.from({ length: 70 }, (_, index) => ({
      x: (index * 83.17) % WIDTH,
      y: (index * 139.31) % HEIGHT,
      size: 0.6 + (index % 4) * 0.35,
      speed: 10 + (index % 5) * 7,
      alpha: 0.18 + (index % 7) * 0.055,
    }));

    this.cacheDom();
    this.bindUi();
    this.bindControls();
    this.renderMenu();
    this.loadAssets();
    requestAnimationFrame((now) => this.loop(now));

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js?v=0.3.0").then((registration) => registration.update()).catch(() => {});
      });
    }
  }

  cacheDom() {
    this.dom = {
      hud: document.querySelector("#hud"),
      hudStage: document.querySelector("#hud-stage"),
      hudScore: document.querySelector("#hud-score"),
      hpFill: document.querySelector("#hp-fill"),
      hpText: document.querySelector("#hp-text"),
      spiritFill: document.querySelector("#spirit-fill"),
      bossWrap: document.querySelector("#boss-wrap"),
      bossName: document.querySelector("#boss-name"),
      bossFill: document.querySelector("#boss-fill"),
      touchControls: document.querySelector("#touch-controls"),
      shotModeButton: document.querySelector("#shot-mode-button"),
      bombButton: document.querySelector("#bomb-button"),
      bombCount: document.querySelector("#bomb-count"),
      pauseButton: document.querySelector("#pause-button"),
      menu: document.querySelector("#menu-layer"),
      modal: document.querySelector("#modal-layer"),
      modalCard: document.querySelector("#modal-card"),
      toast: document.querySelector("#toast"),
      levelLabel: document.querySelector("#level-label"),
      coinLabel: document.querySelector("#coin-label"),
      statStrip: document.querySelector("#stat-strip"),
      stageList: document.querySelector("#stage-list"),
      trainingCoins: document.querySelector("#training-coins"),
      upgradeList: document.querySelector("#upgrade-list"),
      inventoryCount: document.querySelector("#inventory-count"),
      equippedList: document.querySelector("#equipped-list"),
      inventoryList: document.querySelector("#inventory-list"),
      optionBay: document.querySelector("#option-bay"),
      optionCount: document.querySelector("#option-count"),
      equippedOption: document.querySelector("#equipped-option"),
      optionList: document.querySelector("#option-list"),
      buildPanel: document.querySelector("#panel-build"),
      buildSummary: document.querySelector("#build-summary"),
      stanceList: document.querySelector("#stance-list"),
      fangSigilCount: document.querySelector("#fang-sigil-count"),
      fangSigilList: document.querySelector("#fang-sigil-list"),
      companionInscriptionCount: document.querySelector("#companion-inscription-count"),
      companionInscriptionList: document.querySelector("#companion-inscription-list"),
      volume: document.querySelector("#volume-setting"),
      sensitivity: document.querySelector("#sensitivity-setting"),
      shake: document.querySelector("#shake-setting"),
      exportSave: document.querySelector("#export-save"),
      importSave: document.querySelector("#import-save"),
    };
  }

  async loadAssets() {
    const entries = await Promise.all(
      Object.entries(SPRITE_PATHS).map(async ([key, path]) => [key, await this.loadImage(path)]),
    );
    this.images = Object.fromEntries(entries);
    this.assetsReady = true;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  bindUi() {
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
        document.querySelectorAll("[data-panel]").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.tab);
        });
      });
    });

    this.dom.stageList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-stage]");
      if (button && !button.disabled) this.startRun(Number(button.dataset.stage));
    });

    this.dom.upgradeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-upgrade]");
      if (!button) return;
      const result = buyUpgrade(this.save, button.dataset.upgrade);
      if (!result.ok) {
        this.showToast(`欠片が足りぬ。必要 ${result.cost}`);
        this.tone(130, 0.09, "square", 0.08);
        return;
      }
      persistSave(this.save);
      this.tone(480, 0.08, "sine", 0.12);
      this.tone(720, 0.12, "sine", 0.08, 0.05);
      this.renderMenu();
    });

    this.dom.inventoryList.addEventListener("click", (event) => {
      const equip = event.target.closest("[data-equip]");
      const dismantle = event.target.closest("[data-dismantle]");
      if (equip) {
        if (equipItem(this.save, equip.dataset.equip)) {
          persistSave(this.save);
          this.showToast("装備を切り替えた");
          this.renderMenu();
        }
      }
      if (dismantle) {
        const item = this.save.inventory.find((entry) => entry.id === dismantle.dataset.dismantle);
        if (!item) return;
        const rarity = RARITIES[item.rarity];
        const needsConfirm = ["secret", "relic", "cursed"].includes(item.rarity);
        if (needsConfirm && !window.confirm(`${rarity.label}「${item.name}」を分解するか？`)) return;
        const result = dismantleItem(this.save, item.id);
        if (result.ok) {
          persistSave(this.save);
          this.showToast(`分解して欠片 ${result.value} を得た`);
          this.renderMenu();
        }
      }
    });

    this.dom.optionBay.addEventListener("click", (event) => {
      const equip = event.target.closest("[data-equip-option]");
      const unequip = event.target.closest("[data-unequip-option]");
      const dismantle = event.target.closest("[data-dismantle-option]");
      if (equip && equipOption(this.save, equip.dataset.equipOption)) {
        persistSave(this.save);
        this.showToast("随伴器を接続した――副砲が加わるぞ");
        this.renderMenu();
        return;
      }
      if (unequip) {
        unequipOption(this.save);
        persistSave(this.save);
        this.showToast("随伴器を解除した");
        this.renderMenu();
        return;
      }
      if (!dismantle) return;
      const item = this.save.optionInventory.find((entry) => entry.id === dismantle.dataset.dismantleOption);
      if (!item) return;
      const rarity = RARITIES[item.rarity];
      const needsConfirm = ["secret", "relic", "cursed"].includes(item.rarity);
      if (needsConfirm && !window.confirm(`${rarity.label}「${item.name}」を分解するか？`)) return;
      const result = dismantleOption(this.save, item.id);
      if (result.ok) {
        persistSave(this.save);
        this.showToast(`随伴器を分解し、欠片 ${result.value} を得た`);
        this.renderMenu();
      }
    });

    this.dom.buildPanel.addEventListener("click", (event) => {
      const stance = event.target.closest("[data-stance]");
      const fang = event.target.closest("[data-fang-sigil]");
      const inscription = event.target.closest("[data-companion-inscription]");
      if (stance && setStance(this.save, stance.dataset.stance)) {
        persistSave(this.save);
        this.showToast(`${STANCE_TYPES[stance.dataset.stance].label}へ切り替えた`);
        this.renderMenu();
        return;
      }
      if (fang) {
        const result = toggleFangSigil(this.save, fang.dataset.fangSigil);
        if (!result.ok) {
          this.showToast(result.reason === "full" ? "牙紋は二つまでだ" : "その牙紋は扱えぬ");
          return;
        }
        persistSave(this.save);
        this.showToast(`${FANG_SIGILS[fang.dataset.fangSigil].label}を${result.equipped ? "刻んだ" : "外した"}`);
        this.renderMenu();
        return;
      }
      if (inscription) {
        const result = toggleCompanionInscription(this.save, inscription.dataset.companionInscription);
        if (!result.ok) {
          this.showToast(result.reason === "full" ? "付随刻印は二つまでだ" : "その刻印は扱えぬ");
          return;
        }
        persistSave(this.save);
        this.showToast(`${COMPANION_INSCRIPTIONS[inscription.dataset.companionInscription].label}を${result.equipped ? "刻んだ" : "外した"}`);
        this.renderMenu();
      }
    });

    this.dom.volume.addEventListener("input", () => {
      this.save.settings.volume = Number(this.dom.volume.value);
      persistSave(this.save);
    });
    this.dom.sensitivity.addEventListener("input", () => {
      this.save.settings.sensitivity = Number(this.dom.sensitivity.value);
      persistSave(this.save);
    });
    this.dom.shake.addEventListener("change", () => {
      this.save.settings.shake = this.dom.shake.checked;
      persistSave(this.save);
    });

    this.dom.exportSave.addEventListener("click", () => this.exportSave());
    this.dom.importSave.addEventListener("click", () => this.importSave());
  }

  bindControls() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.state !== "playing" || this.paused) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointer || event.pointerId !== this.pointer.id || this.state !== "playing" || this.paused) return;
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      const sensitivity = Number(this.save.settings.sensitivity || 1);
      let dx = (event.clientX - this.pointer.x) * scaleX * sensitivity;
      let dy = (event.clientY - this.pointer.y) * scaleY * sensitivity;
      const movementMultiplier = this.getMovementMultiplier(dx, dy);
      dx *= movementMultiplier;
      dy *= movementMultiplier;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.player.x = clamp(this.player.x + dx, 28, WIDTH - 28);
      this.player.y = clamp(this.player.y + dy, 112, PLAY_BOTTOM - 16);
      this.player.motionX = dx;
      this.player.motionY = dy;
      this.player.motionTimer = 0.15;
    });

    const releasePointer = (event) => {
      if (this.pointer?.id === event.pointerId) this.pointer = null;
    };
    this.canvas.addEventListener("pointerup", releasePointer);
    this.canvas.addEventListener("pointercancel", releasePointer);

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "shift", " "].includes(key)) {
        event.preventDefault();
      }
      this.keys.add(key);
      if (key === "shift" && !event.repeat && this.state === "playing") this.toggleShotMode(true);
      if (key === " " && this.state === "playing") this.useBomb();
      if (key === "escape" && this.state === "playing") this.togglePause();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));

    this.dom.shotModeButton.addEventListener("click", () => this.toggleShotMode(true));
    this.dom.bombButton.addEventListener("click", () => this.useBomb());
    this.dom.pauseButton.addEventListener("click", () => this.togglePause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing" && !this.paused) this.togglePause();
    });
  }

  toggleShotMode(announce = false) {
    if (!this.player || this.state !== "playing" || this.paused) return;
    this.setShotMode(!this.player.focus, announce);
  }

  setShotMode(focused, announce = false) {
    if (!this.player) return;
    this.player.focus = Boolean(focused);
    this.dom.shotModeButton.classList.toggle("is-focused", this.player.focus);
    this.dom.shotModeButton.setAttribute("aria-pressed", String(this.player.focus));
    this.dom.shotModeButton.innerHTML = this.player.focus
      ? "<span>集中</span><small>FOCUS</small>"
      : "<span>通常</span><small>NORMAL</small>";
    if (announce) this.showToast(this.player.focus ? "集中射撃――一点を穿て" : "通常射撃――広く薙げ");
  }

  renderMenu() {
    const stats = getDerivedStats(this.save);
    const equipped = getEquippedItems(this.save);
    const equippedOption = getEquippedOption(this.save);
    const build = getBuildConfig(this.save);
    this.dom.levelLabel.textContent = `鍛錬 ${this.save.level} ・ ${this.save.xp}/${xpToNext(this.save.level)}`;
    this.dom.coinLabel.textContent = `欠片 ${this.save.coins}`;
    this.dom.trainingCoins.textContent = `欠片 ${this.save.coins}`;
    this.dom.inventoryCount.textContent = `${this.save.inventory.length} / ${MAX_INVENTORY}`;
    this.dom.optionCount.textContent = `${this.save.optionInventory.length} / ${MAX_OPTION_INVENTORY}`;
    this.dom.volume.value = this.save.settings.volume;
    this.dom.sensitivity.value = this.save.settings.sensitivity;
    this.dom.shake.checked = Boolean(this.save.settings.shake);

    this.dom.statStrip.innerHTML = [
      [stats.damage, "牙威力"],
      [stats.projectiles, "弾数"],
      [stats.hp + stats.shield, "総耐久"],
      [Math.round(stats.speed), "機動"],
    ].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

    this.dom.stageList.innerHTML = STAGES.map((stage) => {
      const unlocked = stage.id === 1 || this.save.bestStage >= stage.id - 1;
      return `<article class="stage-card">
        <div><p class="eyebrow">危険度 ${stage.id}</p><h3>${stage.name}</h3><p>${stage.sub}</p></div>
        <button class="primary-button" data-stage="${stage.id}" ${unlocked ? "" : "disabled"}>${unlocked ? "出撃" : "封鎖"}</button>
      </article>`;
    }).join("");

    const upgradeMeta = getUpgradeMeta();
    this.dom.upgradeList.innerHTML = Object.entries(upgradeMeta).map(([key, meta]) => {
      const level = this.save.upgrades[key] || 0;
      const cost = upgradeCost(level);
      return `<article class="upgrade-card">
        <div class="upgrade-icon">${meta.icon}</div>
        <div><h3>${meta.label}・伍 ${level}</h3><p>${meta.text}</p></div>
        <button class="tiny-button" data-upgrade="${key}">${cost}</button>
      </article>`;
    }).join("");

    const stanceMeta = STANCE_TYPES[build.stance];
    const fangNames = build.fangSigils.map((id) => FANG_SIGILS[id].label).join("・") || "未刻印";
    const inscriptionNames = build.companionInscriptions.map((id) => COMPANION_INSCRIPTIONS[id].label).join("・") || "未刻印";
    this.dom.buildSummary.innerHTML = [
      ["構え", stanceMeta.label],
      ["牙紋", fangNames],
      ["付随刻印", inscriptionNames],
    ].map(([label, value]) => `<div class="build-summary-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    this.dom.fangSigilCount.textContent = `${build.fangSigils.length} / ${MAX_FANG_SIGILS}`;
    this.dom.companionInscriptionCount.textContent = `${build.companionInscriptions.length} / ${MAX_COMPANION_INSCRIPTIONS}`;
    this.dom.stanceList.innerHTML = Object.entries(STANCE_TYPES)
      .map(([id, meta]) => this.buildCardHtml(meta, "stance", id, build.stance === id, meta.color))
      .join("");
    this.dom.fangSigilList.innerHTML = Object.entries(FANG_SIGILS)
      .map(([id, meta]) => this.buildCardHtml(meta, "fang-sigil", id, build.fangSigils.includes(id), "#ffc266"))
      .join("");
    this.dom.companionInscriptionList.innerHTML = Object.entries(COMPANION_INSCRIPTIONS)
      .map(([id, meta]) => this.buildCardHtml(meta, "companion-inscription", id, build.companionInscriptions.includes(id), "#b993ff"))
      .join("");

    this.dom.equippedOption.innerHTML = equippedOption
      ? this.optionCardHtml(equippedOption, true)
      : `<article class="option-card is-empty"><div class="option-icon">基</div><div><h4>随伴器なし</h4><p>基本の双牙弾だけを使用する。ステージ踏破で随伴器が候補へ現れる。</p></div></article>`;
    const sortedOptions = [...this.save.optionInventory]
      .filter((item) => item.id !== equippedOption?.id)
      .sort((a, b) => RARITIES[b.rarity].value - RARITIES[a.rarity].value);
    this.dom.optionList.innerHTML = sortedOptions.length
      ? sortedOptions.map((item) => this.optionCardHtml(item)).join("")
      : `<p class="tip">未接続の随伴器はない。異形核を破壊して持ち帰れ。</p>`;

    this.dom.equippedList.innerHTML = Object.entries(SLOT_META).map(([slot, meta]) => {
      const item = equipped[slot];
      const rarity = item ? RARITIES[item.rarity] : null;
      return `<div class="slot-card" style="--rarity:${rarity?.color || "#667"}"><span>${meta.label}</span><strong>${item ? escapeHtml(item.name) : "未装備"}</strong></div>`;
    }).join("");

    const sorted = [...this.save.inventory].sort((a, b) => {
      const slotOrder = Object.keys(SLOT_META).indexOf(a.slot) - Object.keys(SLOT_META).indexOf(b.slot);
      if (slotOrder) return slotOrder;
      return RARITIES[b.rarity].value - RARITIES[a.rarity].value;
    });
    this.dom.inventoryList.innerHTML = sorted.map((item) => this.gearCardHtml(item, equipped[item.slot]?.id === item.id)).join("");
  }

  buildCardHtml(meta, attribute, id, isEquipped, color) {
    return `<button class="build-card ${isEquipped ? "is-equipped" : ""}" type="button" data-${attribute}="${id}" aria-pressed="${isEquipped}" style="--module-color:${color}">
      <span class="build-card-icon">${meta.icon}</span>
      <span><h4>${escapeHtml(meta.label)}</h4><p>${escapeHtml(meta.description)}</p></span>
    </button>`;
  }

  gearCardHtml(item, isEquipped = false, choice = false) {
    const rarity = RARITIES[item.rarity];
    const slot = SLOT_META[item.slot];
    const stats = statDescriptions(item).join(" ・ ") || "変化なし";
    const actions = choice
      ? ""
      : `<div class="gear-actions">
          <button class="tiny-button" data-equip="${escapeHtml(item.id)}" ${isEquipped ? "disabled" : ""}>${isEquipped ? "装備中" : "装備"}</button>
          ${item.starter || isEquipped ? "" : `<button class="tiny-button danger" data-dismantle="${escapeHtml(item.id)}">分解</button>`}
        </div>`;
    return `<article class="gear-card ${isEquipped ? "is-equipped" : ""}" style="--rarity:${rarity.color}">
      <i class="rarity-line"></i>
      <div><p class="eyebrow">${rarity.label}・${slot.label}</p><h3>${escapeHtml(item.name)}</h3><p>${stats}${item.rarity === "cursed" ? " ・ 代償あり" : ""}</p></div>
      ${actions}
    </article>`;
  }

  optionCardHtml(item, isEquipped = false, choice = false) {
    const rarity = RARITIES[item.rarity];
    const meta = OPTION_TYPES[item.optionType];
    const actions = choice
      ? ""
      : `<div class="gear-actions">
          ${isEquipped
            ? `<button class="tiny-button" data-unequip-option>解除</button>`
            : `<button class="tiny-button" data-equip-option="${escapeHtml(item.id)}">接続</button>
              <button class="tiny-button danger" data-dismantle-option="${escapeHtml(item.id)}">分解</button>`}
        </div>`;
    return `<article class="option-card ${isEquipped ? "is-equipped" : ""}" style="--option-color:${meta.color}">
      <div class="option-icon">${meta.icon}</div>
      <div><p class="eyebrow">${rarity.label}・随伴器</p><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(optionDescription(item))}</p></div>
      ${actions}
    </article>`;
  }

  startRun(stageId) {
    if (!this.assetsReady) {
      this.showToast("素材を読み込んでおる。少し待て");
      return;
    }
    const stage = STAGES.find((entry) => entry.id === stageId);
    if (!stage) return;
    this.resumeAudio();
    this.stage = stage;
    this.stats = getDerivedStats(this.save);
    this.option = getEquippedOption(this.save);
    this.build = getBuildConfig(this.save);
    this.state = "playing";
    this.paused = false;
    this.menuToGame(true);
    this.player = {
      x: WIDTH / 2,
      y: 660,
      hp: this.stats.hp,
      maxHp: this.stats.hp,
      shield: this.stats.shield,
      maxShield: this.stats.shield,
      bombs: 2,
      focus: false,
      invincible: 1.2,
      fireTimer: 0,
      optionFireTimer: 0,
      mainVolleyCount: 0,
      misfireCharged: false,
      stanceGuardCooldown: 0,
      spirit: 0,
      overdrive: 0,
      motionX: 0,
      motionY: 0,
      motionTimer: 0,
    };
    this.setShotMode(false);
    this.enemies = [];
    this.enemyBullets = [];
    this.playerShots = [];
    this.pickups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.runTime = 0;
    this.spawnTimer = 0.4;
    this.wave = 0;
    this.runScore = 0;
    this.runCoins = 0;
    this.runXp = 0;
    this.kills = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.bossIntro = 0;
    this.clearTimer = 0;
    this.dom.hudStage.textContent = stage.name;
    this.dom.bossWrap.classList.add("is-hidden");
    this.updateHud();
    const optionLabel = this.option ? `　随伴・${OPTION_TYPES[this.option.optionType].label}` : "";
    this.showFloatingBanner(`危険度 ${stage.id}　${stage.name}　${STANCE_TYPES[this.build.stance].label}${optionLabel}`);
    this.tone(260, 0.12, "triangle", 0.12);
    this.tone(390, 0.16, "triangle", 0.09, 0.08);
  }

  menuToGame(active) {
    this.dom.menu.classList.toggle("is-hidden", active);
    this.dom.hud.classList.toggle("is-hidden", !active);
    this.dom.touchControls.classList.toggle("is-hidden", !active);
    this.dom.modal.classList.add("is-hidden");
  }

  loop(now) {
    const dt = Math.min(0.033, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.time += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.dom.toast.classList.remove("is-visible");
    }

    if (this.state === "playing" && !this.paused) this.updateGame(dt);
    this.draw();
    requestAnimationFrame((next) => this.loop(next));
  }

  updateGame(dt) {
    this.runTime += dt;
    this.player.invincible = Math.max(0, this.player.invincible - dt);
    this.player.overdrive = Math.max(0, this.player.overdrive - dt);
    this.player.motionTimer = Math.max(0, this.player.motionTimer - dt);
    this.shake = Math.max(0, this.shake - dt * 12);
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      this.updateParticles(dt);
      if (this.clearTimer <= 0) this.finishRun(true);
      return;
    }

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updatePlayerShots(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.resolveCollisions();
    this.updateHud();
  }

  updatePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    const focused = this.player.focus;
    this.player.stanceGuardCooldown = Math.max(0, this.player.stanceGuardCooldown - dt);
    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const speed = this.stats.speed * this.getMovementMultiplier(dx, dy);
      this.player.x = clamp(this.player.x + dx * speed * dt, 28, WIDTH - 28);
      this.player.y = clamp(this.player.y + dy * speed * dt, 112, PLAY_BOTTOM - 16);
      this.player.motionX = dx * 12;
      this.player.motionY = dy * 12;
      this.player.motionTimer = 0.12;
    }

    this.player.fireTimer -= dt;
    const overdriveRate = this.player.overdrive > 0 ? 1.72 : 1;
    const interval = this.getMainFireInterval(focused) / overdriveRate;
    while (this.player.fireTimer <= 0) {
      this.fireMainShots(focused);
      this.player.fireTimer += interval;
    }

    if (!this.option) return;
    this.player.optionFireTimer -= dt;
    const optionInterval = this.getOptionFireInterval(this.option.optionType, focused) / overdriveRate;
    while (this.player.optionFireTimer <= 0) {
      this.fireOptionShots(focused);
      this.player.optionFireTimer += optionInterval;
    }
  }

  hasFangSigil(id) {
    return Boolean(this.build?.fangSigils?.includes(id));
  }

  hasCompanionInscription(id) {
    return Boolean(this.build?.companionInscriptions?.includes(id));
  }

  isPlayerMoving() {
    return Boolean(this.player?.motionTimer > 0.025 && (Math.abs(this.player.motionX) + Math.abs(this.player.motionY) > 0.05));
  }

  isAdvancing() {
    return this.isPlayerMoving() && this.player.motionY < -0.05;
  }

  isRetreating() {
    return this.isPlayerMoving() && this.player.motionY > 0.05;
  }

  getMovementMultiplier(_dx = this.player?.motionX || 0, dy = this.player?.motionY || 0) {
    let multiplier = 1;
    if (this.build?.stance === "seigaku") multiplier *= 0.9;
    if (this.build?.stance === "chototsu") {
      if (dy < -0.05) multiplier *= 1.12;
      else if (dy > 0.05) multiplier *= 0.9;
    }
    return multiplier;
  }

  getStanceDamageMultiplier(focused, source = "main") {
    let multiplier = 1;
    if (this.build?.stance === "seigaku" && !this.isPlayerMoving()) multiplier *= source === "main" ? 1.22 : 1.1;
    if (this.build?.stance === "araga" && focused) multiplier *= 0.9;
    if (this.build?.stance === "suribi" && !focused) multiplier *= 0.9;
    if (this.build?.stance === "chototsu") {
      if (this.isAdvancing()) multiplier *= 1.18;
      else if (this.isRetreating()) multiplier *= 0.88;
    }
    return multiplier;
  }

  getPlayerHitRadius() {
    let radius = PLAYER_HIT_RADIUS;
    if (this.build?.stance === "araga") radius += 2;
    if (this.build?.stance === "chototsu" && this.isAdvancing()) radius -= 1;
    return Math.max(3, radius);
  }

  getGrazeRadius() {
    return this.stats.grazeRadius + (this.player.focus ? 5 : 0) + (this.build?.stance === "suribi" && this.player.focus ? 12 : 0);
  }

  getMainFireInterval(focused = this.player?.focus) {
    let interval = this.stats.fireInterval * (focused ? 1.12 : 1);
    if (this.hasFangSigil("swift")) interval *= 0.72;
    if (this.build?.stance === "araga" && !focused) interval *= 0.78;
    if (this.build?.stance === "chototsu" && this.isAdvancing()) interval *= 0.86;
    return Math.max(0.045, interval);
  }

  getOptionFireInterval(optionType = this.option?.optionType, focused = this.player?.focus) {
    let interval = OPTION_FIRE_INTERVAL[optionType] || 0.8;
    if (this.hasCompanionInscription("vanguard")) interval *= 0.86;
    if (this.hasCompanionInscription("focusSync")) interval *= focused ? 0.7 : 1.18;
    if (this.hasCompanionInscription("normalSync")) interval *= focused ? 1.2 : 0.72;
    if (this.build?.stance === "chototsu" && this.isAdvancing()) interval *= 0.9;
    return Math.max(0.08, interval);
  }

  fireMainShots(focused) {
    this.player.mainVolleyCount += 1;
    let chargedMultiplier = 1;
    if (this.hasFangSigil("misfire")) {
      if (this.player.misfireCharged) {
        chargedMultiplier = 2.2;
        this.player.misfireCharged = false;
      } else if (Math.random() < 0.22) {
        this.player.misfireCharged = true;
        this.spawnParticles(this.player.x, this.player.y - 38, "#ff8068", 4, 24);
        this.tone(115, 0.035, "square", 0.022);
        return;
      }
    }

    let count = this.stats.projectiles + (this.player.overdrive > 0 ? 1 : 0);
    let damage = this.stats.damage * (focused ? this.stats.focusDamage : 1);
    let spread = focused ? this.stats.spread * 0.28 : this.stats.spread;
    let speed = 670;
    let radius = 8;
    let hitsLeft = this.stats.pierce + (focused ? 1 : 0);
    let spiritGain = 0;

    damage *= this.getStanceDamageMultiplier(focused, "main") * chargedMultiplier;
    if (this.hasFangSigil("heavy")) {
      damage *= 1.35;
      speed *= 0.72;
      radius += 2;
    }
    if (this.hasFangSigil("swift")) damage *= 0.78;
    if (this.hasFangSigil("bloodfang")) {
      const current = this.player.hp + this.player.shield;
      const maximum = this.player.maxHp + this.player.maxShield;
      damage *= 1 + (1 - current / Math.max(1, maximum)) * 0.55;
    }
    if (this.hasFangSigil("convergence") && focused) {
      damage *= 1.12;
      spread *= 0.42;
    }
    if (this.hasFangSigil("scatter") && !focused) {
      count += 2;
      damage *= 0.76;
    }
    if (this.hasFangSigil("severance")) {
      damage *= 0.88;
      hitsLeft += 2;
    }
    if (this.hasFangSigil("recoil")) {
      damage *= 1.12;
      speed *= 1.25;
    }
    if (this.hasFangSigil("furnace")) {
      damage *= 0.92;
      spiritGain = 0.55;
    }

    const addVolley = (damageScale = 1, yOffset = 0, type = "base") => {
      for (let i = 0; i < count; i += 1) {
        const offset = i - (count - 1) / 2;
        let angle = offset * spread;
        if (this.hasFangSigil("crossing")) angle *= -1;
        this.addPlayerShot({
          x: this.player.x + offset * 7,
          y: this.player.y - 44 + yOffset,
          angle,
          speed,
          damage: damage * damageScale,
          radius: type === "echo" ? Math.max(4, radius - 2) : radius,
          hitsLeft: type === "echo" ? Math.max(0, hitsLeft - 1) : hitsLeft,
          type,
          source: "main",
          spiritGain: type === "echo" ? spiritGain * 0.35 : spiritGain,
        });
      }
    };

    addVolley();
    if (this.hasFangSigil("afterfang")) addVolley(0.32, 26, "echo");
    if (this.hasFangSigil("doublebeat") && this.player.mainVolleyCount % 3 === 0) addVolley(0.55, 17, "echo");
    if (this.hasFangSigil("recoil")) this.player.y = clamp(this.player.y + 2.2, 112, PLAY_BOTTOM - 16);
    this.shotSoundTick += 1;
    if (this.shotSoundTick % 5 === 0) this.tone(420, 0.025, "triangle", 0.018);
  }

  getOptionNodePositions(focused = this.player?.focus) {
    if (!this.option) return [];
    const type = this.option.optionType;
    const scale = this.hasCompanionInscription("convergence")
      ? 0.68
      : this.hasCompanionInscription("expansion") ? 1.28 : 1;
    const yShift = this.hasCompanionInscription("vanguard") ? -18 : 0;
    if (this.hasCompanionInscription("orbit")) {
      const radius = (focused ? 38 : 52) * scale;
      const angle = this.time * (focused ? 1.9 : 2.8);
      const count = type === "lance" ? 1 : 2;
      return Array.from({ length: count }, (_, index) => {
        const nodeAngle = angle + (TAU * index) / count;
        return [Math.cos(nodeAngle) * radius, Math.sin(nodeAngle) * radius * 0.42 + yShift];
      });
    }
    if (type === "homing") {
      const radius = (focused ? 36 : 51) * scale;
      const angle = this.time * (focused ? 1.6 : 2.7);
      return [
        [Math.cos(angle) * radius, Math.sin(angle) * 18 - 6 + yShift],
        [Math.cos(angle + Math.PI) * radius, Math.sin(angle + Math.PI) * 18 - 6 + yShift],
      ];
    }
    if (type === "lance") return [[0, -58 + yShift]];
    const distance = (focused ? 35 : 51) * scale;
    return [[-distance, -4 + yShift], [distance, -4 + yShift]];
  }

  getOptionDamageMultiplier(focused = this.player?.focus) {
    let multiplier = this.getStanceDamageMultiplier(focused, "option");
    if (this.hasCompanionInscription("convergence")) multiplier *= 1.1;
    if (this.hasCompanionInscription("expansion")) multiplier *= 0.88;
    if (this.hasCompanionInscription("vanguard")) multiplier *= 0.92;
    if (this.hasCompanionInscription("chill")) multiplier *= 0.92;
    if (this.hasCompanionInscription("burst")) multiplier *= 0.9;
    if (this.hasCompanionInscription("ricochet")) multiplier *= 0.88;
    if (this.hasCompanionInscription("eraser")) multiplier *= 0.82;
    if (this.hasCompanionInscription("furnace")) multiplier *= 0.9;
    return multiplier;
  }

  getOptionShotTraits(damage) {
    const traits = { source: "option" };
    if (this.hasCompanionInscription("blaze")) {
      traits.burnDamage = damage * 0.24;
      traits.burnDuration = 1.8;
    }
    if (this.hasCompanionInscription("chill")) {
      traits.slowFactor = 0.68;
      traits.slowDuration = 1.45;
    }
    if (this.hasCompanionInscription("burst")) {
      traits.splashDamage = damage * 0.36;
      traits.splashRadius = 54;
    }
    if (this.hasCompanionInscription("eraser")) traits.eraseBullets = true;
    if (this.hasCompanionInscription("furnace")) traits.spiritGain = 0.8;
    return traits;
  }

  fireOptionShots(focused) {
    if (!this.option) return;
    const baseDamage = this.stats.damage
      * (focused ? this.stats.focusDamage : 1)
      * this.getOptionDamageMultiplier(focused);
    const optionPower = Number(this.option.power || 1);
    const type = this.option.optionType;
    const nodes = this.getOptionNodePositions(focused);
    const spreadMultiplier = this.hasCompanionInscription("convergence")
      ? 0.55
      : this.hasCompanionInscription("expansion") ? 1.55 : 1;
    const bonusPierce = this.hasCompanionInscription("ricochet") ? 2 : 0;

    if (type === "fan") {
      const count = 5 + (this.hasCompanionInscription("expansion") ? 2 : 0);
      const spread = (focused ? 0.045 : 0.13) * spreadMultiplier;
      for (let i = 0; i < count; i += 1) {
        const damage = baseDamage * optionPower * 0.26;
        const node = nodes[i % Math.max(1, nodes.length)] || [0, -32];
        this.addPlayerShot({
          x: this.player.x + node[0] + (i - (count - 1) / 2) * 2,
          y: this.player.y + node[1],
          angle: (i - (count - 1) / 2) * spread,
          speed: focused ? 690 : 610,
          damage,
          radius: 6,
          hitsLeft: Math.max(0, this.stats.pierce - 1) + bonusPierce,
          type: "fan",
          ...this.getOptionShotTraits(damage),
        });
      }
    } else if (type === "lance") {
      const damage = baseDamage * optionPower * 3.25;
      const node = nodes[0] || [0, -58];
      this.addPlayerShot({
        x: this.player.x + node[0],
        y: this.player.y + node[1],
        angle: 0,
        speed: 730,
        damage,
        radius: 15,
        hitsLeft: this.stats.pierce + 7 + bonusPierce,
        type: "lance",
        ...this.getOptionShotTraits(damage),
      });
    } else if (type === "homing") {
      const count = 2;
      const spread = (focused ? 0.055 : 0.12) * spreadMultiplier;
      for (let i = 0; i < count; i += 1) {
        const damage = baseDamage * optionPower * 0.42;
        const node = nodes[i] || [i ? 32 : -32, -24];
        this.addPlayerShot({
          x: this.player.x + node[0],
          y: this.player.y + node[1],
          angle: (i - (count - 1) / 2) * spread,
          speed: 515,
          damage,
          radius: 7,
          hitsLeft: Math.max(0, this.stats.pierce - 1) + bonusPierce,
          type: "homing",
          turnRate: (focused ? 6.4 : 5) + (this.hasCompanionInscription("orbit") ? 1.8 : 0),
          ...this.getOptionShotTraits(damage),
        });
      }
    } else if (type === "twin") {
      for (const [index, node] of nodes.entries()) {
        const damage = baseDamage * optionPower * 0.34;
        this.addPlayerShot({
          x: this.player.x + node[0],
          y: this.player.y + node[1],
          angle: focused ? -node[0] * 0.0006 : (index ? 0.012 : -0.012) * (spreadMultiplier - 1),
          speed: 650,
          damage,
          radius: 7,
          hitsLeft: Math.max(0, this.stats.pierce - 1) + bonusPierce,
          type: "twin",
          ...this.getOptionShotTraits(damage),
        });
      }
    }
  }

  addPlayerShot({ x, y, angle, speed, damage, radius, hitsLeft, type, turnRate = 0, ...traits }) {
    this.playerShots.push({
      x,
      y,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      damage,
      radius,
      hitsLeft,
      type,
      turnRate,
      age: 0,
      hitIds: new Set(),
      ...traits,
    });
  }

  updateSpawning(dt) {
    if (!this.bossSpawned && this.runTime < this.stage.duration) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnWave();
        this.spawnTimer = Math.max(0.75, 1.55 - this.stage.id * 0.13);
      }
    } else if (!this.bossSpawned) {
      this.spawnBoss();
    }
  }

  spawnWave() {
    const pattern = this.wave % 5;
    const difficulty = this.stage.id;
    if (pattern === 0) {
      const count = 4 + difficulty;
      for (let i = 0; i < count; i += 1) {
        this.enemies.push(this.makeEnemy("orb", 55 + (WIDTH - 110) * (i / Math.max(1, count - 1)), -35 - i * 14));
      }
    } else if (pattern === 1) {
      this.enemies.push(this.makeEnemy("dart", 70, -30));
      this.enemies.push(this.makeEnemy("dart", WIDTH - 70, -60));
      if (difficulty >= 3) this.enemies.push(this.makeEnemy("dart", WIDTH / 2, -95));
    } else if (pattern === 2) {
      this.enemies.push(this.makeEnemy("turret", 105, -45));
      this.enemies.push(this.makeEnemy("turret", WIDTH - 105, -45));
    } else if (pattern === 3) {
      this.enemies.push(this.makeEnemy("spinner", WIDTH / 2, -50));
      if (difficulty >= 2) this.enemies.push(this.makeEnemy("orb", 75, -90));
      if (difficulty >= 2) this.enemies.push(this.makeEnemy("orb", WIDTH - 75, -90));
    } else {
      const side = this.wave % 2 ? -20 : WIDTH + 20;
      for (let i = 0; i < 4 + difficulty; i += 1) {
        const enemy = this.makeEnemy("orb", side, 90 + i * 48);
        enemy.vx = side < 0 ? 80 : -80;
        enemy.vy = 34;
        this.enemies.push(enemy);
      }
    }
    this.wave += 1;
  }

  makeEnemy(type, x, y) {
    const scale = 1 + (this.stage.id - 1) * 0.42;
    const defs = {
      orb: { hp: 62, radius: 16, speed: 62, reward: 8, color: "#55d6c2" },
      dart: { hp: 110, radius: 19, speed: 78, reward: 13, color: "#ffb85c" },
      turret: { hp: 195, radius: 23, speed: 46, reward: 19, color: "#d279e6" },
      spinner: { hp: 280, radius: 27, speed: 40, reward: 27, color: "#ef6575" },
    };
    const def = defs[type];
    return {
      id: `${type}-${this.wave}-${Math.random()}`,
      type,
      x,
      y,
      baseX: x,
      vx: 0,
      vy: def.speed,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      radius: def.radius,
      reward: Math.round(def.reward * this.stage.reward),
      color: def.color,
      age: 0,
      shootTimer: 0.5 + Math.random() * 0.8,
      angle: Math.random() * TAU,
      dead: false,
    };
  }

  spawnBoss() {
    this.bossSpawned = true;
    this.bossIntro = 2.2;
    const hp = this.stage.bossHp;
    this.boss = {
      id: "boss",
      type: "boss",
      x: WIDTH / 2,
      y: -70,
      hp,
      maxHp: hp,
      radius: 48,
      reward: Math.round(130 * this.stage.reward),
      color: this.stage.id === 3 ? "#7d85ff" : "#ff6372",
      age: 0,
      shootTimer: 0.6,
      angle: 0,
      dead: false,
    };
    this.enemies.push(this.boss);
    this.dom.bossName.textContent = this.stage.id === 3 ? "深層・獣核" : "凝集する異形核";
    this.dom.bossWrap.classList.remove("is-hidden");
    this.showFloatingBanner("WARNING　異形核 接近");
    this.tone(120, 0.35, "sawtooth", 0.11);
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.burnTimer = Math.max(0, (enemy.burnTimer || 0) - dt);
      if (enemy.burnTimer > 0 && enemy.burnDamage > 0) {
        enemy.hp -= enemy.burnDamage * dt;
        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
          continue;
        }
      }
      enemy.slowTimer = Math.max(0, (enemy.slowTimer || 0) - dt);
      const enemyDt = dt * (enemy.slowTimer > 0 ? enemy.slowFactor || 0.68 : 1);
      enemy.age += enemyDt;
      enemy.shootTimer -= enemyDt;
      if (enemy.type === "boss") {
        this.updateBoss(enemy, enemyDt);
        continue;
      }

      if (enemy.type === "orb") {
        enemy.x += enemy.vx * enemyDt;
        enemy.y += enemy.vy * enemyDt;
        enemy.x += Math.sin(enemy.age * 3 + enemy.baseX) * 18 * enemyDt;
        if (enemy.shootTimer <= 0 && enemy.y > 45) {
          this.shootAimed(enemy, 1 + (this.stage.id >= 3 ? 1 : 0), 0.12, 118 + this.stage.id * 13, enemy.color);
          enemy.shootTimer = 1.7 - this.stage.id * 0.12;
        }
      } else if (enemy.type === "dart") {
        enemy.y += enemy.vy * enemyDt;
        enemy.x += Math.sin(enemy.age * 4.2 + enemy.baseX) * 105 * enemyDt;
        if (enemy.shootTimer <= 0 && enemy.y > 60) {
          this.shootAimed(enemy, 3 + this.stage.id, 0.15, 150 + this.stage.id * 12, enemy.color);
          enemy.shootTimer = 2.15;
        }
      } else if (enemy.type === "turret") {
        enemy.y = Math.min(165, enemy.y + enemy.vy * enemyDt);
        enemy.x += Math.sin(enemy.age * 1.7 + enemy.baseX) * 22 * enemyDt;
        if (enemy.shootTimer <= 0 && enemy.y > 80) {
          this.shootRadial(enemy, 7 + this.stage.id * 2, 92 + this.stage.id * 10, enemy.angle, enemy.color);
          enemy.angle += 0.23;
          enemy.shootTimer = 1.45;
        }
      } else if (enemy.type === "spinner") {
        enemy.y = Math.min(125, enemy.y + enemy.vy * enemyDt);
        enemy.x = WIDTH / 2 + Math.sin(enemy.age * 1.25) * 105;
        if (enemy.shootTimer <= 0 && enemy.y > 70) {
          for (const offset of [-0.5, 0.5]) {
            const angle = enemy.angle + offset;
            this.addEnemyBullet(enemy.x, enemy.y, Math.cos(angle) * 128, Math.sin(angle) * 128, 6, enemy.color, "diamond");
          }
          enemy.angle += 0.26 + this.stage.id * 0.025;
          enemy.shootTimer = 0.16;
        }
      }
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead && enemy.y < HEIGHT + 100 && enemy.x > -120 && enemy.x < WIDTH + 120);
  }

  updateBoss(boss, dt) {
    if (this.bossIntro > 0) {
      this.bossIntro -= dt;
      boss.y = lerp(boss.y, 126, 1 - Math.exp(-dt * 2.8));
      return;
    }
    const hpRatio = boss.hp / boss.maxHp;
    boss.x = WIDTH / 2 + Math.sin(boss.age * (hpRatio < 0.35 ? 1.7 : 1.15)) * 118;
    boss.y = 122 + Math.sin(boss.age * 1.8) * 20;
    if (boss.shootTimer > 0) return;

    if (hpRatio > 0.66) {
      this.shootRadial(boss, 12 + this.stage.id * 2, 105 + this.stage.id * 12, boss.angle, "#ff6978");
      boss.angle += 0.16;
      boss.shootTimer = 0.82 - this.stage.id * 0.05;
    } else if (hpRatio > 0.33) {
      this.shootAimed(boss, 5 + this.stage.id * 2, 0.11, 156 + this.stage.id * 9, "#ffc15c");
      this.shootRadial(boss, 8, 82, -boss.angle, "#b67cff");
      boss.angle += 0.28;
      boss.shootTimer = 0.66;
    } else {
      const arms = 3 + this.stage.id;
      for (let i = 0; i < arms; i += 1) {
        const angle = boss.angle + (TAU * i) / arms;
        this.addEnemyBullet(boss.x, boss.y, Math.cos(angle) * 178, Math.sin(angle) * 178, 6, i % 2 ? "#ff6582" : "#67dfd1", "diamond");
      }
      boss.angle += 0.21;
      boss.shootTimer = Math.max(0.13, 0.22 - this.stage.id * 0.02);
    }
  }

  shootAimed(enemy, count, spread, speed, color) {
    const hitY = this.player.y + PLAYER_HIT_Y_OFFSET;
    const base = Math.atan2(hitY - enemy.y, this.player.x - enemy.x);
    for (let i = 0; i < count; i += 1) {
      const angle = base + (i - (count - 1) / 2) * spread;
      this.addEnemyBullet(enemy.x, enemy.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, color, "circle");
    }
  }

  shootRadial(enemy, count, speed, offset, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (TAU * i) / count;
      this.addEnemyBullet(enemy.x, enemy.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, color, i % 2 ? "circle" : "diamond");
    }
  }

  addEnemyBullet(x, y, vx, vy, radius, color, shape) {
    if (this.enemyBullets.length > 700) return;
    this.enemyBullets.push({ x, y, vx, vy, radius, color, shape, grazed: false, age: 0 });
  }

  updatePlayerShots(dt) {
    for (const shot of this.playerShots) {
      shot.age += dt;
      if (shot.turnRate > 0 && this.enemies.length) {
        let target = null;
        let nearest = Infinity;
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          const distance = distanceSq(shot.x, shot.y, enemy.x, enemy.y);
          if (distance < nearest) {
            nearest = distance;
            target = enemy;
          }
        }
        if (target) {
          const speed = Math.hypot(shot.vx, shot.vy);
          const current = Math.atan2(shot.vy, shot.vx);
          const desired = Math.atan2(target.y - shot.y, target.x - shot.x);
          const difference = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const angle = current + clamp(difference, -shot.turnRate * dt, shot.turnRate * dt);
          shot.vx = Math.cos(angle) * speed;
          shot.vy = Math.sin(angle) * speed;
        }
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }
    this.playerShots = this.playerShots.filter((shot) => (
      shot.y > -160
      && shot.y < HEIGHT + 120
      && shot.x > -160
      && shot.x < WIDTH + 160
      && shot.hitsLeft >= -1
    ));
  }

  updateEnemyBullets(dt) {
    for (const bullet of this.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.age += dt;
    }
    this.enemyBullets = this.enemyBullets.filter((bullet) => bullet.x > -45 && bullet.x < WIDTH + 45 && bullet.y > -55 && bullet.y < HEIGHT + 55);
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.age += dt;
      pickup.y += pickup.vy * dt;
      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 170 || this.player.y < 250) {
        const pull = 780 * dt / Math.max(25, distance);
        pickup.x += dx * pull;
        pickup.y += dy * pull;
      }
      if (distance < 24) {
        pickup.collected = true;
        this.runCoins += pickup.value;
        this.runScore += pickup.value * 30;
        this.tone(620 + Math.min(260, this.runCoins), 0.025, "sine", 0.025);
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.collected && pickup.y < HEIGHT + 30);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.08, dt);
      particle.vy *= Math.pow(0.08, dt);
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const text of this.floatingTexts) {
      text.life -= dt;
      text.y -= 32 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((text) => text.life > 0);
  }

  resolveCollisions() {
    for (const shot of this.playerShots) {
      if (shot.eraseBullets && (shot.erasedCount || 0) < 2) {
        for (const bullet of this.enemyBullets) {
          if (bullet.remove) continue;
          const eraseRadius = shot.radius + bullet.radius + 13;
          if (distanceSq(shot.x, shot.y, bullet.x, bullet.y) > eraseRadius * eraseRadius) continue;
          bullet.remove = true;
          shot.erasedCount = (shot.erasedCount || 0) + 1;
          this.spawnParticles(bullet.x, bullet.y, "#d8c2ff", 3, 34);
          if (shot.erasedCount >= 2) break;
        }
      }
      for (const enemy of this.enemies) {
        if (shot.hitsLeft < -1) break;
        if (enemy.dead || shot.hitIds.has(enemy.id)) continue;
        const radius = shot.radius + enemy.radius;
        if (distanceSq(shot.x, shot.y, enemy.x, enemy.y) > radius * radius) continue;
        shot.hitIds.add(enemy.id);
        enemy.hp -= shot.damage;
        if (shot.burnDamage) {
          enemy.burnDamage = Math.max(enemy.burnDamage || 0, shot.burnDamage);
          enemy.burnTimer = Math.max(enemy.burnTimer || 0, shot.burnDuration || 1.8);
        }
        if (shot.slowFactor) {
          enemy.slowFactor = Math.min(enemy.slowFactor || 1, shot.slowFactor);
          enemy.slowTimer = Math.max(enemy.slowTimer || 0, shot.slowDuration || 1.45);
        }
        if (shot.splashDamage && shot.splashRadius) {
          for (const nearby of this.enemies) {
            if (nearby === enemy || nearby.dead) continue;
            const splashRadius = shot.splashRadius + nearby.radius;
            if (distanceSq(enemy.x, enemy.y, nearby.x, nearby.y) > splashRadius * splashRadius) continue;
            nearby.hp -= shot.splashDamage;
            this.spawnParticles(nearby.x, nearby.y, "#ffb86c", 2, 38);
            if (nearby.hp <= 0) this.killEnemy(nearby);
          }
        }
        if (shot.spiritGain) this.gainSpirit(shot.spiritGain);
        this.spawnParticles(shot.x, shot.y, enemy.color, 2, 45);
        if (shot.hitsLeft <= 0) shot.hitsLeft = -2;
        else shot.hitsLeft -= 1;
        if (enemy.hp <= 0) this.killEnemy(enemy);
      }
    }

    const hitX = this.player.x;
    const hitY = this.player.y + PLAYER_HIT_Y_OFFSET;
    const grazeRadius = this.getGrazeRadius();
    const playerHitRadius = this.getPlayerHitRadius();
    for (const bullet of this.enemyBullets) {
      if (bullet.remove) continue;
      const distSq = distanceSq(hitX, hitY, bullet.x, bullet.y);
      const hitRadius = bullet.radius + playerHitRadius;
      if (distSq <= hitRadius * hitRadius && this.player.invincible <= 0) {
        bullet.remove = true;
        this.damagePlayer();
      } else if (!bullet.grazed && distSq <= (bullet.radius + grazeRadius) ** 2) {
        bullet.grazed = true;
        this.gainSpirit(this.player.focus ? 4.2 : 2.2);
        this.runScore += 35 * this.stage.id;
        this.runXp += 1;
        this.spawnParticles(hitX, hitY, "#74f0db", 2, 22);
      }
    }
    this.enemyBullets = this.enemyBullets.filter((bullet) => !bullet.remove);
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    this.kills += 1;
    this.runXp += enemy.type === "boss" ? 90 * this.stage.id : 3 + this.stage.id;
    this.runScore += enemy.type === "boss" ? 25000 * this.stage.id : 180 * enemy.reward;
    this.spawnParticles(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 48 : 9, enemy.type === "boss" ? 220 : 100);
    this.tone(enemy.type === "boss" ? 90 : 160 + Math.random() * 80, enemy.type === "boss" ? 0.5 : 0.05, "sawtooth", enemy.type === "boss" ? 0.13 : 0.025);
    if (enemy.type === "boss") {
      this.enemyBullets.length = 0;
      this.shake = 18;
      this.clearTimer = 1.5;
      this.dom.bossWrap.classList.add("is-hidden");
      return;
    }
    if (Math.random() < 0.52) {
      this.pickups.push({ x: enemy.x, y: enemy.y, vy: 52, age: 0, value: Math.max(1, Math.round(enemy.reward / 5)) });
    }
  }

  gainSpirit(amount) {
    if (!this.player || !Number.isFinite(amount) || amount <= 0) return;
    const stanceMultiplier = this.build?.stance === "suribi" ? 1.65 : 1;
    this.player.spirit += amount * stanceMultiplier;
    if (this.player.spirit < 100) return;
    this.player.spirit %= 100;
    this.player.overdrive = Math.max(this.player.overdrive, 6.5);
    this.showToast("炉心開放――牙弾奔流");
    this.tone(520, 0.14, "sine", 0.1);
    this.tone(920, 0.22, "triangle", 0.08, 0.05);
  }

  damagePlayer() {
    if (this.build?.stance === "seigaku" && !this.isPlayerMoving() && this.player.stanceGuardCooldown <= 0) {
      this.player.stanceGuardCooldown = 7;
      this.player.invincible = 0.72;
      this.shake = 3;
      this.spawnParticles(this.player.x, this.player.y + PLAYER_HIT_Y_OFFSET, "#8ff1d7", 12, 95);
      this.showToast("静岳――被弾を受け流した");
      this.tone(310, 0.11, "triangle", 0.08);
      return;
    }
    if (this.player.shield > 0) this.player.shield -= 1;
    else this.player.hp -= 1;
    this.player.invincible = 1.15;
    this.player.spirit *= 0.35;
    this.shake = 8;
    this.spawnParticles(this.player.x, this.player.y + PLAYER_HIT_Y_OFFSET, "#ff6b70", 16, 145);
    this.tone(86, 0.18, "square", 0.12);
    if (navigator.vibrate) navigator.vibrate(35);
    if (this.player.hp <= 0) this.finishRun(false);
  }

  useBomb() {
    if (this.state !== "playing" || this.paused || !this.player || this.player.bombs <= 0) return;
    this.player.bombs -= 1;
    this.player.invincible = 2.1;
    this.enemyBullets.length = 0;
    const damage = this.stats.damage * 22;
    for (const enemy of this.enemies) {
      enemy.hp -= damage;
      if (enemy.hp <= 0) this.killEnemy(enemy);
    }
    for (let i = 0; i < 80; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 80 + Math.random() * 300;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.7,
        maxLife: 1.1,
        size: 2 + Math.random() * 5,
        color: i % 3 ? "#ffd16c" : "#57e1d0",
      });
    }
    this.shake = 16;
    this.tone(72, 0.45, "sawtooth", 0.14);
    this.tone(620, 0.35, "sine", 0.08);
    if (navigator.vibrate) navigator.vibrate([30, 20, 45]);
    this.updateHud();
  }

  spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = speed * (0.25 + Math.random() * 0.75);
      const life = 0.22 + Math.random() * 0.42;
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, maxLife: life, size: 1.5 + Math.random() * 3.5, color });
    }
  }

  updateHud() {
    if (!this.player) return;
    const total = this.player.maxHp + this.player.maxShield;
    const current = this.player.hp + this.player.shield;
    this.dom.hudScore.textContent = Math.floor(this.runScore).toLocaleString("ja-JP");
    this.dom.hpFill.style.width = `${clamp((current / Math.max(1, total)) * 100, 0, 100)}%`;
    this.dom.hpText.textContent = `耐 ${this.player.hp}　護 ${this.player.shield}`;
    this.dom.spiritFill.style.width = `${clamp(this.player.spirit, 0, 100)}%`;
    this.dom.bombCount.textContent = `霊圧 ×${this.player.bombs}`;
    this.dom.bombButton.disabled = this.player.bombs <= 0;
    if (this.boss && !this.boss.dead) {
      this.dom.bossFill.style.width = `${clamp((this.boss.hp / this.boss.maxHp) * 100, 0, 100)}%`;
    }
  }

  draw() {
    const ctx = this.ctx;
    const stage = this.stage || STAGES[0];
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, stage.colors[0]);
    gradient.addColorStop(1, stage.colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawBackground(ctx, stage);

    if (this.state !== "playing" && this.state !== "result") return;
    ctx.save();
    if (this.shake > 0 && this.save.settings.shake) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawPickups(ctx);
    this.drawPlayerShots(ctx);
    this.drawEnemies(ctx);
    this.drawEnemyBullets(ctx);
    this.drawParticles(ctx);
    this.drawPlayerOption(ctx);
    this.drawPlayer(ctx);
    this.drawFloatingTexts(ctx);
    ctx.restore();
    this.drawVignette(ctx);
  }

  drawBackground(ctx, stage) {
    for (const star of this.stars) {
      const y = (star.y + this.time * star.speed * (0.7 + stage.id * 0.18)) % HEIGHT;
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.size > 1.3 ? "#7ce4d4" : "#dce8e2";
      ctx.fillRect(star.x, y, star.size, star.size * 2.4);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(104, 214, 196, 0.055)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const y = ((i * 124 + this.time * 24) % (HEIGHT + 140)) - 70;
      ctx.beginPath();
      ctx.ellipse(WIDTH / 2, y, 185, 42, 0, 0, TAU);
      ctx.stroke();
    }
  }

  drawPlayer(ctx) {
    if (!this.player || !this.assetsReady) return;
    const focused = this.player.focus;
    let state = "idle";
    if (focused) state = "focus";
    else if (this.player.motionTimer > 0) {
      if (Math.abs(this.player.motionX) > Math.abs(this.player.motionY)) state = this.player.motionX < 0 ? "left" : "right";
      else state = this.player.motionY < 0 ? "up" : "down";
    }
    const frame = Math.floor(this.time * (focused ? 7 : 9)) % 6;
    const image = this.images[state];
    const size = focused ? PLAYER_FOCUS_DRAW_SIZE : PLAYER_DRAW_SIZE;
    const invincibilityFlicker = this.player.invincible > 0 && Math.floor(this.time * 18) % 2;
    const alpha = (focused ? 0.46 : 0.62) * (invincibilityFlicker ? 0.42 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.player.overdrive > 0 ? "#ffd66d" : "#45d7c2";
    ctx.shadowBlur = this.player.overdrive > 0 ? 24 : 10;
    ctx.drawImage(image, frame * 256, 0, 256, 256, this.player.x - size / 2, this.player.y - size * 0.6, size, size);
    ctx.restore();

    const hitY = this.player.y + PLAYER_HIT_Y_OFFSET;
    const hitRadius = this.getPlayerHitRadius();
    const pulse = (Math.sin(this.time * 9) + 1) / 2;
    ctx.save();
    ctx.shadowColor = "#ff334d";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ff334d";
    ctx.beginPath();
    ctx.arc(this.player.x, hitY, hitRadius + pulse * 0.7, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 5;
    ctx.strokeStyle = "#fff5f2";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = (focused ? 0.72 : 0.5) - pulse * 0.18;
    ctx.strokeStyle = "#ff7a83";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(this.player.x, hitY, 10 + pulse * 3, 0, TAU);
    ctx.stroke();
    if (focused) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#ff6673";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.player.x, hitY, this.getGrazeRadius(), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    if (this.player.overdrive > 0) {
      const hitY = this.player.y + PLAYER_HIT_Y_OFFSET;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = "#ffd66d";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffd66d";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.player.x, hitY, 16 + Math.sin(this.time * 8) * 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayerOption(ctx) {
    if (!this.player || !this.option) return;
    const meta = OPTION_TYPES[this.option.optionType];
    if (!meta) return;
    const positions = this.getOptionNodePositions(this.player.focus);

    ctx.save();
    ctx.strokeStyle = meta.color;
    ctx.fillStyle = meta.color;
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 13;
    ctx.lineWidth = 1.3;
    for (const [offsetX, offsetY] of positions) {
      const x = this.player.x + offsetX;
      const y = this.player.y + offsetY;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y - 5);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.time * 2.4 + offsetX * 0.01);
      ctx.beginPath();
      if (this.option.optionType === "fan") {
        this.polygon(ctx, 4, 10, Math.PI / 4);
      } else if (this.option.optionType === "lance") {
        this.polygon(ctx, 3, 13, -Math.PI / 2);
      } else if (this.option.optionType === "twin") {
        this.polygon(ctx, 6, 11, Math.PI / 6);
      } else {
        ctx.arc(0, 0, 9, 0, TAU);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.88)";
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  drawPlayerShots(ctx) {
    if (!this.assetsReady) return;
    const image = this.images.shot;
    const frame = Math.floor(this.time * 14) % 4;
    for (const shot of this.playerShots) {
      const visual = {
        base: { width: 28, height: 42, color: "#ffb13e" },
        echo: { width: 20, height: 32, color: "#ffd991" },
        fan: { width: 21, height: 33, color: "#5ee1bf" },
        lance: { width: 48, height: 82, color: "#ff8068" },
        homing: { width: 26, height: 39, color: "#68bfff" },
        twin: { width: 25, height: 41, color: "#c28bff" },
      }[shot.type] || { width: 28, height: 42, color: "#ffb13e" };
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = visual.color;
      ctx.shadowBlur = shot.type === "lance" ? 16 : 9;
      ctx.drawImage(image, frame * 64, 0, 64, 96, -visual.width / 2, -visual.height * 0.66, visual.width, visual.height);
      ctx.restore();
    }
  }

  drawEnemies(ctx) {
    for (const enemy of this.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.type === "boss" ? enemy.age * 0.25 : enemy.age * 0.7);
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = enemy.type === "boss" ? 28 : 12;
      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = "rgba(255,255,255,.72)";
      ctx.lineWidth = enemy.type === "boss" ? 3 : 1.4;
      if (enemy.type === "orb") {
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#111722";
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.42, 0, TAU);
        ctx.fill();
      } else if (enemy.type === "dart") {
        this.polygon(ctx, 3, enemy.radius, -Math.PI / 2);
        ctx.fill();
        ctx.stroke();
      } else if (enemy.type === "turret") {
        this.polygon(ctx, 6, enemy.radius, Math.PI / 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#111722";
        this.polygon(ctx, 6, enemy.radius * 0.48, Math.PI / 6);
        ctx.fill();
      } else if (enemy.type === "spinner") {
        this.polygon(ctx, 8, enemy.radius, Math.PI / 8);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-enemy.age * 1.8);
        ctx.fillStyle = "#121827";
        this.polygon(ctx, 4, enemy.radius * 0.58, Math.PI / 4);
        ctx.fill();
      } else if (enemy.type === "boss") {
        ctx.globalAlpha = this.bossIntro > 0 ? clamp(1 - this.bossIntro / 2.2, 0.2, 1) : 1;
        for (let ring = 0; ring < 3; ring += 1) {
          ctx.rotate(0.35 + ring * 0.2);
          ctx.globalAlpha *= 0.82;
          ctx.beginPath();
          for (let i = 0; i < 12; i += 1) {
            const angle = (TAU * i) / 12;
            const radius = enemy.radius + (i % 2 ? 10 + ring * 5 : -5);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff3d5";
        ctx.beginPath();
        ctx.arc(0, 0, 14 + Math.sin(this.time * 5) * 3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawEnemyBullets(ctx) {
    for (const bullet of this.enemyBullets) {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 7;
      ctx.fillStyle = bullet.color;
      ctx.strokeStyle = "rgba(255,255,255,.88)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (bullet.shape === "diamond") {
        ctx.moveTo(0, -bullet.radius * 1.45);
        ctx.lineTo(bullet.radius * 0.78, 0);
        ctx.lineTo(0, bullet.radius * 1.45);
        ctx.lineTo(-bullet.radius * 0.78, 0);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, bullet.radius, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPickups(ctx) {
    for (const pickup of this.pickups) {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(pickup.age * 3);
      ctx.shadowColor = "#ffd36b";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffd36b";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFloatingTexts(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const text of this.floatingTexts) {
      ctx.globalAlpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.font = "900 19px system-ui";
      ctx.fillStyle = "#fff4d6";
      ctx.shadowColor = "#0b101a";
      ctx.shadowBlur = 8;
      ctx.fillText(text.value, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  showFloatingBanner(value) {
    this.floatingTexts.push({ x: WIDTH / 2, y: 350, value, life: 2.1, maxLife: 2.1 });
  }

  drawVignette(ctx) {
    const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.22, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.62);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.38)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  polygon(ctx, sides, radius, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const angle = rotation + (TAU * i) / sides;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  finishRun(success, retreated = false) {
    if (this.state !== "playing") return;
    this.state = "result";
    this.pointer = null;
    this.setShotMode(false);
    this.dom.touchControls.classList.add("is-hidden");
    this.dom.hud.classList.add("is-hidden");

    const survivalRatio = retreated ? 0.5 : success ? 1 : 0.72;
    const coins = Math.floor((this.runCoins + this.kills * 2 + (success ? 45 * this.stage.id : 10)) * survivalRatio * this.stage.reward);
    const xp = Math.floor((this.runXp + this.kills * 3 + (success ? 70 * this.stage.id : 15)) * survivalRatio);
    const levels = applyRunRewards(this.save, { coins, xp, cleared: success, stage: this.stage.id });
    const lootStage = success ? this.stage.id : Math.max(1, this.stage.id - 1);
    const choices = retreated
      ? []
      : Array.from({ length: success ? 2 : 1 }, () => generateLoot({
          stage: lootStage,
          lootBonus: this.stats.lootBonus,
        }));
    if (success) {
      choices.push(generateOptionDrop({
        stage: lootStage,
        lootBonus: this.stats.lootBonus,
      }));
    }
    persistSave(this.save);

    const title = retreated ? "撤収" : success ? "踏破" : "力尽きた";
    const message = retreated
      ? "持ち帰れるものだけを確保した。欲を抑えるのも腕のうちだ。"
      : success
        ? "異形核を砕いた。通常装備か、副砲を加える随伴器を一つ選べ。"
        : "鍛錬と欠片は残る。回収できた品を一つ持ち帰れる。";
    const lootHtml = choices.length
      ? `<div class="loot-choices">${choices.map((item, index) => `<button class="loot-choice" data-loot-index="${index}">${item.kind === "option" ? this.optionCardHtml(item, false, true) : this.gearCardHtml(item, false, true)}</button>`).join("")}</div>`
      : "";
    this.showModal(`<p class="eyebrow">SORTIE RESULT</p><h2>${title}</h2><p>${message}${levels ? `　鍛錬が ${levels} 上がった。` : ""}</p>
      <div class="result-stats"><div><strong>${this.kills}</strong><span>撃破</span></div><div><strong>${coins}</strong><span>欠片</span></div><div><strong>${xp}</strong><span>鍛錬</span></div></div>
      ${lootHtml}
      <div class="modal-actions"><button id="result-return" class="primary-button">格納庫へ戻る</button></div>`);

    this.dom.modalCard.querySelectorAll("[data-loot-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = choices[Number(button.dataset.lootIndex)];
        if (!item) return;
        const collected = item.kind === "option" ? addOption(this.save, item) : addItem(this.save, item);
        if (collected) {
          this.showToast(`${item.name}を回収した`);
        } else {
          this.save.coins += item.value;
          this.showToast(`所持枠が満杯のため欠片 ${item.value} に変えた`);
        }
        persistSave(this.save);
        this.returnToMenu();
      });
    });
    document.querySelector("#result-return").addEventListener("click", () => this.returnToMenu());
  }

  togglePause() {
    if (this.state !== "playing") return;
    this.paused = !this.paused;
    if (!this.paused) {
      this.dom.modal.classList.add("is-hidden");
      this.lastTime = performance.now();
      return;
    }
    this.showModal(`<p class="eyebrow">PAUSE</p><h2>息を整えよ</h2><p>出撃は止まっている。撤収すれば獲得量は半分になる。</p>
      <div class="modal-actions"><button id="resume-run" class="primary-button">続ける</button><button id="retreat-run" class="secondary-button">撤収する</button></div>`);
    document.querySelector("#resume-run").addEventListener("click", () => this.togglePause());
    document.querySelector("#retreat-run").addEventListener("click", () => {
      this.paused = false;
      this.finishRun(false, true);
    });
  }

  showModal(html) {
    this.dom.modalCard.innerHTML = html;
    this.dom.modal.classList.remove("is-hidden");
  }

  returnToMenu() {
    this.state = "menu";
    this.stage = null;
    this.paused = false;
    this.dom.modal.classList.add("is-hidden");
    this.dom.menu.classList.remove("is-hidden");
    this.dom.hud.classList.add("is-hidden");
    this.dom.touchControls.classList.add("is-hidden");
    this.renderMenu();
  }

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add("is-visible");
    this.toastTimer = 2.4;
  }

  resumeAudio() {
    if (!this.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audio = new AudioContext();
    }
    this.audio?.resume?.();
  }

  tone(frequency, duration, type = "sine", gain = 0.06, delay = 0) {
    if (!this.audio || this.save.settings.volume <= 0) return;
    const oscillator = this.audio.createOscillator();
    const volume = this.audio.createGain();
    const start = this.audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.72), start + duration);
    volume.gain.setValueAtTime(gain * this.save.settings.volume, start);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(this.audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  exportSave() {
    const blob = new Blob([JSON.stringify(this.save, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `judan-save-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast("セーブを書き出した");
  }

  importSave() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.save = normalizeSave(JSON.parse(await file.text()));
        persistSave(this.save);
        this.renderMenu();
        this.showToast("セーブを読み込んだ");
      } catch {
        this.showToast("正しいセーブデータではない");
      }
    });
    input.click();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.__judanGame = new JudanGame();
