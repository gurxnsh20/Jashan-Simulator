/**
 * Jashan's Simulator (AM) - Aulakh Motors
 * Module: slider.js
 * Purpose: Big Truck Unloading Boss Event (Days 15, 45, 75)
 *   - 8 heavy electric scooter crates to unload from the factory freight truck.
 *   - A needle sweeps back and forth across a gauge with:
 *       * Green Safe Zone (center) -> Perfect Tap = +Rs 1500
 *       * Amber/Red Penalty Bands (flanking green zone) -> Red Band Tap = +Rs 500
 *       * Outer Miss Dead-Zones -> Miss = -Rs 1500
 *   - The needle speeds up after every crate unloaded (Crate 1 -> Crate 8).
 *   - Helpers Jass and Tanu actively widen the Green Safe Zone based on their levels & active status!
 */

(function (global) {
  'use strict';

  const BigTruckBoss = {
    totalCrates: 8,
    currentCrate: 1,
    needlePos: 10, // 0 to 100 percentage
    needleDir: 1,
    baseSpeed: 42, // % per second on Crate 1
    speedIncrement: 14, // additional % per second per crate
    isRunning: false,
    isPausedBetweenCrates: false,
    rafId: null,
    lastFrameTime: 0,
    crateResults: [], // array of { crate, outcome, amount }
    zones: {
      greenStart: 40,
      greenEnd: 60,
      redLeftStart: 25,
      redRightEnd: 75
    },
    onCompleteCallback: null,
    keyHandler: null,

    start(onComplete) {
      this.cleanup();
      this.onCompleteCallback = onComplete;
      this.currentCrate = 1;
      this.needlePos = 8;
      this.needleDir = 1;
      this.crateResults = [];
      this.isRunning = true;
      this.isPausedBetweenCrates = false;

      if (global.Scene3D) {
        global.Scene3D.setCameraPreset('BIG_TRUCK');
        global.Scene3D.updateBigTruckCrates3D(0);
      }
      this.computeZonesForCurrentCrate();
      this.renderModal();
      this.bindKeyboard();

      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    },

    cleanup() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler);
        this.keyHandler = null;
      }
    },

    bindKeyboard() {
      this.keyHandler = (e) => {
        if (e.code === 'Space' && this.isRunning && !this.isPausedBetweenCrates) {
          e.preventDefault();
          this.handleUnloadTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    },

    computeZonesForCurrentCrate() {
      const helpers = global.GameState.data.helpers;
      // Base green zone width starts at 14% and narrows slightly on later crates,
      // while Jass & Tanu widen the green zone substantially!
      const baseGreenWidth = Math.max(8, 15 - (this.currentCrate - 1) * 0.7);
      const jassBonus = helpers.jass && helpers.jass.active ? (helpers.jass.greenZoneBonus || 6) : 0;
      const tanuBonus = helpers.tanu && helpers.tanu.active ? (helpers.tanu.greenZoneBonus || 6) : 0;

      const totalGreenWidth = Math.min(42, baseGreenWidth + jassBonus + tanuBonus);
      const redBandEachSide = 14; // 14% red penalty band on each side of the green zone

      // Slight random center shift per crate (between 38% and 62%) to keep gameplay dynamic
      const center = 50 + ((this.currentCrate % 2 === 0 ? 1 : -1) * ((this.currentCrate * 3) % 9));
      const halfGreen = totalGreenWidth / 2;

      this.zones = {
        center,
        greenWidth: totalGreenWidth,
        jassBonus,
        tanuBonus,
        greenStart: Math.max(15, center - halfGreen),
        greenEnd: Math.min(85, center + halfGreen),
        redLeftStart: Math.max(5, center - halfGreen - redBandEachSide),
        redRightEnd: Math.min(95, center + halfGreen + redBandEachSide)
      };
    },

    getCurrentSpeed() {
      // Speed increases with each crate unloaded
      return this.baseSpeed + (this.currentCrate - 1) * this.speedIncrement;
    },

    loop(now) {
      if (!this.isRunning) return;
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;

      if (!this.isPausedBetweenCrates) {
        const speed = this.getCurrentSpeed();
        this.needlePos += this.needleDir * speed * dt;
        if (this.needlePos >= 98) {
          this.needlePos = 98;
          this.needleDir = -1;
        } else if (this.needlePos <= 2) {
          this.needlePos = 2;
          this.needleDir = 1;
        }
        this.updateNeedleUI();
      }

      this.rafId = requestAnimationFrame((t) => this.loop(t));
    },

     updateNeedleUI() {
      const needleEl = document.getElementById('slider-needle');
      if (needleEl) {
        needleEl.style.left = `${this.needlePos}%`;
      }
    },

    handleUnloadTap() {
      if (!this.isRunning || this.isPausedBetweenCrates) return;
      this.isPausedBetweenCrates = true;

      const pos = this.needlePos;
      const z = this.zones;
      let outcome = 'MISS';
      let deltaCash = -1500;
      let label = '💥 MISS! Crate Dropped (-Rs 1,500)';
      let badgeClass = 'outcome-miss';

      if (pos >= z.greenStart && pos <= z.greenEnd) {
        outcome = 'PERFECT';
        deltaCash = 1500;
        label = '🎯 PERFECT UNLOAD! (+Rs 1,500)';
        badgeClass = 'outcome-perfect';
        if (global.Sound) global.Sound.success();
      } else if (
        (pos >= z.redLeftStart && pos < z.greenStart) ||
        (pos > z.greenEnd && pos <= z.redRightEnd)
      ) {
        outcome = 'RED_BAND';
        deltaCash = 500;
        label = '⚠️ RED PENALTY BAND! Rough Unload (+Rs 500)';
        badgeClass = 'outcome-red';
        if (global.Sound) global.Sound.beep();
      } else {
        outcome = 'MISS';
        deltaCash = -1500;
        label = '💥 MISSED! Damaged Scooter Crate (-Rs 1,500)';
        badgeClass = 'outcome-miss';
        if (global.Sound) global.Sound.error();
      }

      global.GameState.addCash(deltaCash, `Crate #${this.currentCrate} (${outcome})`);
      global.GameState.consumeStamina(7);
      global.GameState.data.stats.totalCratesUnloaded += 1;

      this.crateResults.push({
        crate: this.currentCrate,
        outcome,
        amount: deltaCash,
        pos: Math.round(pos)
      });

      if (global.Scene3D) {
        global.Scene3D.updateBigTruckCrates3D(this.crateResults.length);
      }
      this.updateCrateFeedbackUI(label, badgeClass);
      this.updateCrateGridUI();

      setTimeout(() => {
        if (!this.isRunning) return;
        if (this.currentCrate >= this.totalCrates) {
          this.finishBossEvent();
        } else {
          this.currentCrate += 1;
          this.needlePos = this.currentCrate % 2 === 0 ? 92 : 8;
          this.needleDir = this.currentCrate % 2 === 0 ? -1 : 1;
          this.computeZonesForCurrentCrate();
          this.updateTrackZonesUI();
          this.isPausedBetweenCrates = false;
        }
      }, 900);
    },

    updateCrateFeedbackUI(label, badgeClass) {
      const fb = document.getElementById('slider-live-feedback');
      if (fb) {
        fb.innerHTML = label;
        fb.className = `slider-feedback-box ${badgeClass}`;
      }
      const headerStat = document.getElementById('slider-crate-counter');
      if (headerStat) {
        headerStat.textContent = `Crate ${this.currentCrate} of ${this.totalCrates}`;
      }
      const speedBadge = document.getElementById('slider-speed-badge');
      if (speedBadge) {
        const mult = (this.getCurrentSpeed() / this.baseSpeed).toFixed(2);
        speedBadge.textContent = `⚡ Needle Speed: ${mult}x`;
      }
    },

    updateTrackZonesUI() {
      const z = this.zones;
      const redLeftEl = document.getElementById('zone-red-left');
      const greenEl = document.getElementById('zone-green-safe');
      const redRightEl = document.getElementById('zone-red-right');
      const headerStat = document.getElementById('slider-crate-counter');
      const speedBadge = document.getElementById('slider-speed-badge');

      if (redLeftEl) {
        redLeftEl.style.left = `${z.redLeftStart}%`;
        redLeftEl.style.width = `${z.greenStart - z.redLeftStart}%`;
      }
      if (greenEl) {
        greenEl.style.left = `${z.greenStart}%`;
        greenEl.style.width = `${z.greenEnd - z.greenStart}%`;
      }
      if (redRightEl) {
        redRightEl.style.left = `${z.greenEnd}%`;
        redRightEl.style.width = `${z.redRightEnd - z.greenEnd}%`;
      }
      if (headerStat) {
        headerStat.textContent = `Crate ${this.currentCrate} of ${this.totalCrates}`;
      }
      if (speedBadge) {
        const mult = (this.getCurrentSpeed() / this.baseSpeed).toFixed(2);
        speedBadge.textContent = `⚡ Needle Speed: ${mult}x`;
      }
    },

    updateCrateGridUI() {
      const grid = document.getElementById('slider-crates-grid');
      if (!grid) return;
      let html = '';
      for (let i = 1; i <= this.totalCrates; i++) {
        const res = this.crateResults.find((r) => r.crate === i);
        let statusClass = 'crate-pending';
        let statusIcon = '📦';
        let subText = `Crate #${i}`;
        if (res) {
          if (res.outcome === 'PERFECT') {
            statusClass = 'crate-perfect';
            statusIcon = '✅';
            subText = '+Rs 1500';
          } else if (res.outcome === 'RED_BAND') {
            statusClass = 'crate-red';
            statusIcon = '⚠️';
            subText = '+Rs 500';
          } else {
            statusClass = 'crate-miss';
            statusIcon = '💥';
            subText = '-Rs 1500';
          }
        } else if (i === this.currentCrate) {
          statusClass = 'crate-active';
          statusIcon = '🏗️';
          subText = 'Unloading...';
        }
        html += `
          <div class="crate-slot-card ${statusClass}">
            <div class="crate-icon">${statusIcon}</div>
            <div class="crate-label">${subText}</div>
          </div>
        `;
      }
      grid.innerHTML = html;
    },

    finishBossEvent() {
      this.cleanup();
      const totalEarned = this.crateResults.reduce((acc, r) => acc + r.amount, 0);
      const perfectCount = this.crateResults.filter((r) => r.outcome === 'PERFECT').length;
      const redCount = this.crateResults.filter((r) => r.outcome === 'RED_BAND').length;
      const missCount = this.crateResults.filter((r) => r.outcome === 'MISS').length;

      const container = document.getElementById('modal-layer');
      if (container) {
        container.innerHTML = `
          <div class="game-modal-backdrop">
            <div class="game-modal-card">
              <div class="modal-header-bar red-header">
                <h3>🚛 Big Truck Consignment Complete!</h3>
                <span class="phase-pill">Day ${global.GameState.data.currentDay} Boss Event</span>
              </div>
              <div class="boss-summary-stats">
                <div class="stat-box perfect-box">
                  <span class="stat-val">${perfectCount}</span>
                  <span class="stat-lbl">Perfect (+Rs 1500)</span>
                </div>
                <div class="stat-box warn-box">
                  <span class="stat-val">${redCount}</span>
                  <span class="stat-lbl">Red Band (+Rs 500)</span>
                </div>
                <div class="stat-box danger-box">
                  <span class="stat-val">${missCount}</span>
                  <span class="stat-lbl">Misses (-Rs 1500)</span>
                </div>
              </div>
              <div class="net-profit-callout ${totalEarned >= 0 ? 'pos' : 'neg'}">
                Net Unloading Profit: <strong>${totalEarned >= 0 ? '+Rs ' + totalEarned : '-Rs ' + Math.abs(totalEarned)}</strong>
              </div>
              <button type="button" class="btn-primary-lg" id="btn-finish-big-truck">
                Complete Day ${global.GameState.data.currentDay} & Save Progress →
              </button>
            </div>
          </div>
        `;
        const finishBtn = document.getElementById('btn-finish-big-truck');
        if (finishBtn) {
          finishBtn.addEventListener('click', () => {
            container.innerHTML = '';
            if (this.onCompleteCallback) this.onCompleteCallback();
          });
        }
      }
    },

    renderModal() {
      const container = document.getElementById('modal-layer');
      if (!container) return;
      const z = this.zones;
      const helpers = global.GameState.data.helpers;

      container.innerHTML = `
        <div class="game-modal-backdrop boss-3d-peek-backdrop" id="big-truck-modal">
          <div class="game-modal-card boss-modal-layout">
            <div class="modal-header-bar red-header">
              <div>
                <span class="phase-pill">🚛 BOSS EVENT • DAY ${global.GameState.data.currentDay}</span>
                <h3>Big Truck Heavy Crate Unloading</h3>
              </div>
              <div class="tries-pill" id="slider-crate-counter">Crate ${this.currentCrate} of ${this.totalCrates}</div>
            </div>

            <div class="helper-boost-strip">
              <div class="helper-chip">
                👷 <strong>Jass (Lv.${helpers.jass.level}):</strong> +${z.jassBonus}% Green Zone Width
              </div>
              <div class="helper-chip">
                👩‍🔧 <strong>Tanu (Lv.${helpers.tanu.level}):</strong> +${z.tanuBonus}% Green Zone Width
              </div>
              <div class="helper-chip speed-chip" id="slider-speed-badge">
                ⚡ Needle Speed: 1.00x
              </div>
            </div>

            <!-- 8 Crates Progress Grid -->
            <div class="slider-crates-grid" id="slider-crates-grid"></div>

            <!-- Timing Gauge Bar -->
            <div class="slider-arena-box">
              <div class="slider-legend-row">
                <span class="legend-item"><i class="dot-miss"></i> Miss (-Rs 1500)</span>
                <span class="legend-item"><i class="dot-red"></i> Red Band (+Rs 500)</span>
                <span class="legend-item"><i class="dot-green"></i> Green Safe Zone (+Rs 1500)</span>
              </div>

              <div class="slider-track-outer" id="slider-track">
                <div class="slider-zone-miss"></div>
                <div class="slider-zone-red" id="zone-red-left" style="left: ${z.redLeftStart}%; width: ${z.greenStart - z.redLeftStart}%;"></div>
                <div class="slider-zone-green" id="zone-green-safe" style="left: ${z.greenStart}%; width: ${z.greenEnd - z.greenStart}%;">
                  <span>SAFE</span>
                </div>
                <div class="slider-zone-red" id="zone-red-right" style="left: ${z.greenEnd}%; width: ${z.redRightEnd - z.greenEnd}%;"></div>
                <div class="slider-needle-pointer" id="slider-needle" style="left: ${this.needlePos}%;">
                  <div class="needle-head">▼</div>
                  <div class="needle-line"></div>
                </div>
              </div>

              <div class="slider-feedback-box" id="slider-live-feedback">
                Tap <strong>UNLOAD CRATE</strong> (or press Spacebar) when the needle hits the Green Safe Zone!
              </div>

              <button type="button" class="btn-unload-giant" id="btn-unload-crate">
                🏗️ UNLOAD CRATE NOW!
              </button>
            </div>
          </div>
        </div>
      `;

      this.updateCrateGridUI();

      const btn = document.getElementById('btn-unload-crate');
      if (btn) {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.handleUnloadTap();
        });
      }
    }
  };

  global.BigTruckBoss = BigTruckBoss;
})(window);
