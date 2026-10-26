/**
 * Jashan's Simulator (AM) - Aulakh Motors 3D
 * Module: main.js
 * Purpose:
 *   - 3-Screen State Machine Controller:
 *       * Screen 1: Main Menu (#screen-main-menu)
 *       * Screen 2: Day Selection 1..90 (#screen-day-select)
 *       * Screen 3: Active Gameplay Full-Screen 3D (#screen-gameplay)
 *   - Minimal Floating HUD updates (Current Day, Stamina Bar, Treasury, Objective Indicator)
 *   - Pause / Settings Modal (Resume, Camera View Switcher, Jass & Tanu Training, Audio, Day Select)
 *   - Full 90-Day Loop & Boss Routing (Morning OTP -> 3D Scooter Display -> Daytime Queue -> Evening Lockup)
 */

(function (global) {
  'use strict';

  const UI = {
    currentScreen: 'MAIN_MENU', // 'MAIN_MENU' | 'DAY_SELECT' | 'GAMEPLAY'
    scootersLocations: {}, // { [1..10]: 'INSIDE' | 'OUTSIDE' }

    init() {
      global.GameState.init();
      if (global.Scene3D) {
        global.Scene3D.init('three-canvas-container');
      }
      this.resetScooterPositions('INSIDE');
      this.bindScreenNavigation();
      this.updateHUD();
      this.showScreen('MAIN_MENU');
    },

    showScreen(screenName) {
      this.currentScreen = screenName;
      const sMenu = document.getElementById('screen-main-menu');
      const sDays = document.getElementById('screen-day-select');
      const sGame = document.getElementById('screen-gameplay');

      if (sMenu) sMenu.classList.toggle('active-screen', screenName === 'MAIN_MENU');
      if (sDays) sDays.classList.toggle('active-screen', screenName === 'DAY_SELECT');
      if (sGame) sGame.classList.toggle('active-screen', screenName === 'GAMEPLAY');

      if (screenName === 'MAIN_MENU' && global.Scene3D) {
        global.Scene3D.setCameraPreset('OVERVIEW');
      } else if (screenName === 'DAY_SELECT') {
        this.renderDaySelectionGrid();
      } else if (screenName === 'GAMEPLAY' && global.Scene3D) {
        global.Scene3D.setCameraPreset('THIRD_PERSON');
      }
    },

    resetScooterPositions(location = 'INSIDE') {
      for (let i = 1; i <= 10; i++) {
        this.scootersLocations[i] = location;
      }
      global.GameState.data.scootersOutside = location === 'OUTSIDE' ? 10 : 0;
      if (global.Scene3D) {
        global.Scene3D.syncDisplayScooterLocations(this.scootersLocations);
      }
    },

    bindScreenNavigation() {
      // Screen 1: START GAME -> Screen 2: Day Selection
      const startBtn = document.getElementById('btn-main-start-game');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          if (global.Sound) global.Sound.click();
          this.showScreen('DAY_SELECT');
        });
      }

      // Screen 2: Back to Main Menu
      const backBtn = document.getElementById('btn-back-to-title');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (global.Sound) global.Sound.click();
          this.showScreen('MAIN_MENU');
        });
      }

      // Screen 2: Practice / Event Jump Menu
      const pracBtn = document.getElementById('btn-open-practice-menu');
      if (pracBtn) {
        pracBtn.addEventListener('click', () => {
          if (global.Sound) global.Sound.click();
          this.openEventSimulatorPicker();
        });
      }

      // Screen 3: Top-Right Pause / Settings Button
      const pauseBtn = document.getElementById('btn-pause-settings');
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          if (global.Sound) global.Sound.click();
          this.openPauseSettingsModal();
        });
      }

      // Floating 3D Customer Patience Badges
      document.querySelectorAll('.floating-3d-cust-badge').forEach((badge) => {
        badge.addEventListener('click', () => {
          const chairIdx = Number(badge.getAttribute('data-chair'));
          if (global.CustomerQueue) {
            global.CustomerQueue.onCustomerClicked(chairIdx);
          }
        });
      });
    },

    renderDaySelectionGrid() {
      const grid = document.getElementById('day-select-grid');
      if (!grid) return;
      const d = global.GameState.data;

      let html = '';
      for (let day = 1; day <= 90; day++) {
        const type = global.GameState.getDayType(day);
        const unlocked = day <= d.unlockedMaxDay;
        const hist = d.dayHistory[day];
        const isCurrent = day === d.currentDay;

        let bossClass = '';
        let icon = '🛵';
        if (type === 'BIG_TRUCK') {
          bossClass = 'day-boss-big';
          icon = '🚛';
        } else if (type === 'SMALL_TRUCK') {
          bossClass = 'day-boss-small';
          icon = '🛻';
        }

        html += `
          <button type="button"
                  class="day-grid-btn ${unlocked ? 'day-unlocked' : 'day-locked'} ${bossClass} ${isCurrent ? 'day-current-glow' : ''}"
                  data-day="${day}">
            <span class="day-num-txt">DAY ${day}</span>
            <span class="day-icon-txt">${unlocked ? icon : '🔒'}</span>
            <span class="day-stars-txt">${hist && hist.completed ? '⭐'.repeat(hist.stars) : unlocked ? 'PLAY' : 'LOCKED'}</span>
          </button>
        `;
      }

      grid.innerHTML = html;

      grid.querySelectorAll('.day-grid-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const selectedDay = Number(btn.getAttribute('data-day'));
          if (selectedDay <= d.unlockedMaxDay) {
            if (global.Sound) global.Sound.click();
            this.showScreen('GAMEPLAY');
            this.startDayWorkflow(selectedDay);
          } else {
            if (global.Sound) global.Sound.error();
            this.showFloatingToast(`🔒 Day ${selectedDay} is locked! Complete Day ${d.unlockedMaxDay} first.`, 'danger');
          }
        });
      });
    },

    moveScooterTo(scooterNum, targetZone) {
      const phase = global.GameState.data.phase;
      if (phase === 'MORNING_DISPLAY' && targetZone !== 'OUTSIDE') return;
      if (phase === 'EVENING_PACKUP' && targetZone !== 'INSIDE') return;
      if (phase !== 'MORNING_DISPLAY' && phase !== 'EVENING_PACKUP') return;
      if (this.scootersLocations[scooterNum] === targetZone) return;

      if (global.GameState.data.stamina < 4) {
        if (global.Sound) global.Sound.error();
        this.showFloatingToast('🍱 Out of stamina! Walk to the Tiffin Box on the counter!', 'danger');
        return;
      }

      this.scootersLocations[scooterNum] = targetZone;
      global.GameState.consumeStamina(3);
      if (global.Sound) global.Sound.click();

      const outsideCount = Object.values(this.scootersLocations).filter((loc) => loc === 'OUTSIDE').length;
      global.GameState.data.scootersOutside = outsideCount;
      this.renderShowroomScooters();
      this.updateHUD();

      if (phase === 'MORNING_DISPLAY') {
        this.showFloatingToast(`🛵 Parked Scooter #${scooterNum} Outside (${outsideCount}/10)`, 'success');
        if (outsideCount === 10) {
          if (global.Sound) global.Sound.success();
          global.GameState.addCash(300, 'All 10 Scooters Displayed');
          setTimeout(() => this.transitionAfterMorningDisplay(), 600);
        }
      } else if (phase === 'EVENING_PACKUP') {
        const insideCount = 10 - outsideCount;
        this.showFloatingToast(`🏢 Parked Scooter #${scooterNum} Inside (${insideCount}/10)`, 'success');
        if (outsideCount === 0) {
          if (global.Sound) global.Sound.shutter();
          global.GameState.addCash(300, 'Evening Lockup Complete');
          if (global.Scene3D) global.Scene3D.setShutterOpen(false);
          setTimeout(() => {
            global.GameState.completeCurrentDay();
            this.updateHUD();
            this.openDaySummaryModal();
          }, 700);
        }
      }
    },

    jassAssistMoveBatch() {
      const phase = global.GameState.data.phase;
      const jassLv = global.GameState.data.helpers.jass.level || 1;
      const batchSize = Math.min(5, 1 + jassLv);

      if (phase === 'MORNING_DISPLAY') {
        const insideIds = Object.keys(this.scootersLocations)
          .map(Number)
          .filter((id) => this.scootersLocations[id] === 'INSIDE')
          .slice(0, batchSize);
        insideIds.forEach((id) => {
          this.scootersLocations[id] = 'OUTSIDE';
        });
        if (global.Sound) global.Sound.ratchet();
        this.showFloatingToast(`👷 Jass rolled ${insideIds.length} scooters outside!`, 'success');
      } else if (phase === 'EVENING_PACKUP') {
        const outsideIds = Object.keys(this.scootersLocations)
          .map(Number)
          .filter((id) => this.scootersLocations[id] === 'OUTSIDE')
          .slice(0, batchSize);
        outsideIds.forEach((id) => {
          this.scootersLocations[id] = 'INSIDE';
        });
        if (global.Sound) global.Sound.ratchet();
        this.showFloatingToast(`👷 Jass parked ${outsideIds.length} scooters inside!`, 'success');
      }

      const outsideCount = Object.values(this.scootersLocations).filter((loc) => loc === 'OUTSIDE').length;
      global.GameState.data.scootersOutside = outsideCount;
      this.renderShowroomScooters();
      this.updateHUD();

      if (phase === 'MORNING_DISPLAY' && outsideCount === 10) {
        if (global.Sound) global.Sound.success();
        global.GameState.addCash(300, 'All 10 Scooters Displayed');
        setTimeout(() => this.transitionAfterMorningDisplay(), 600);
      } else if (phase === 'EVENING_PACKUP' && outsideCount === 0) {
        if (global.Sound) global.Sound.shutter();
        global.GameState.addCash(300, 'Evening Lockup Complete');
        if (global.Scene3D) global.Scene3D.setShutterOpen(false);
        setTimeout(() => {
          global.GameState.completeCurrentDay();
          this.updateHUD();
          this.openDaySummaryModal();
        }, 700);
      }
    },

    startDayWorkflow(dayNum) {
      const targetDay = dayNum || global.GameState.data.currentDay;
      if (!global.GameState.canPlayDay(targetDay)) {
        this.showFloatingToast(`🔒 Day ${targetDay} is locked!`, 'danger');
        return;
      }

      global.CustomerQueue.stopQueue();
      this.resetScooterPositions('INSIDE');
      global.GameState.startDay(targetDay);

      if (global.Scene3D) {
        global.Scene3D.grabbedScooterNum = null;
        global.Scene3D.playerPos = { x: -2.5, y: 0, z: -2.2 };
        if (global.Scene3D.characters.jashan) {
          global.Scene3D.characters.jashan.position.set(-2.5, 0, -2.2);
        }
        global.Scene3D.setShutterOpen(false);
        global.Scene3D.setCameraPreset('THIRD_PERSON');
      }

      this.updateHUD();

      // Launch Morning OTP Lock Modal over blurred 3D world
      global.OTPLock.start(() => {
        if (global.Scene3D) global.Scene3D.setShutterOpen(true);

        const dayType = global.GameState.getDayType(targetDay);
        if (dayType === 'BIG_TRUCK') {
          global.GameState.data.phase = 'BOSS_BIG_TRUCK';
          global.GameState.save();
          this.updateHUD();
          this.showFloatingToast('🚛 Big Truck arrived outside! Walk out to the truck & tap INTERACT!', 'info');
          global.BigTruckBoss.start(() => {
            if (global.Scene3D) global.Scene3D.setCameraPreset('THIRD_PERSON');
            global.GameState.completeCurrentDay();
            this.updateHUD();
            this.openDaySummaryModal();
          });
        } else if (dayType === 'SMALL_TRUCK') {
          global.GameState.data.phase = 'BOSS_SMALL_TRUCK';
          global.GameState.save();
          this.updateHUD();
          this.showFloatingToast('🛻 Small Truck arrived outside! Load 9 Scooters!', 'info');
          global.SmallTruckPuzzle.start(() => {
            if (global.Scene3D) global.Scene3D.setCameraPreset('THIRD_PERSON');
            global.GameState.completeCurrentDay();
            this.updateHUD();
            this.openDaySummaryModal();
          });
        } else {
          global.GameState.data.phase = 'MORNING_DISPLAY';
          global.GameState.save();
          this.updateHUD();
          this.showFloatingToast('🌅 Walk to each 3D scooter inside, tap INTERACT to grab, and push outside!', 'info');
        }
      });
    },

    transitionAfterMorningDisplay() {
      global.GameState.data.phase = 'DAYTIME';
      global.GameState.save();
      this.updateHUD();
      this.showFloatingToast('☀️ Daytime Shift! Walk to waiting customers on the brown chairs & tap INTERACT!', 'info');

      const targetCust = global.GameState.data.customersTargetToday || 5;
      global.CustomerQueue.startDaytimeQueue(targetCust, () => {
        global.GameState.data.phase = 'EVENING_PACKUP';
        global.GameState.save();
        if (global.Sound) global.Sound.beep();
        this.showFloatingToast('🌙 Evening Phase! Grab all 10 scooters outside and push them back inside!', 'info');
        this.updateHUD();
      });
    },

    renderShowroomScooters() {
      if (global.Scene3D) {
        global.Scene3D.syncDisplayScooterLocations(this.scootersLocations);
      }
    },

    renderPhaseActionBanner() {
      this.updateHUD();
    },

    updateHUD() {
      const d = global.GameState.data;
      const dayEl = document.getElementById('hud-day-badge');
      const cashEl = document.getElementById('hud-cash-val');
      const stamFill = document.getElementById('hud-stamina-fill');
      const stamText = document.getElementById('hud-stamina-text');
      const objChip = document.getElementById('hud-objective-chip');

      if (dayEl) dayEl.textContent = `DAY ${d.currentDay}`;
      if (cashEl) cashEl.textContent = `₹${d.cash.toLocaleString('en-IN')}`;
      if (stamFill) {
        stamFill.style.width = `${d.stamina}%`;
        stamFill.style.background = d.stamina > 50 ? '#10B981' : d.stamina > 25 ? '#F59E0B' : '#EF4444';
      }
      if (stamText) stamText.textContent = `${Math.round(d.stamina)}%`;

      if (objChip) {
        const outsideCount = Object.values(this.scootersLocations).filter((loc) => loc === 'OUTSIDE').length;
        const insideCount = 10 - outsideCount;
        if (d.phase === 'MORNING_OTP') {
          objChip.textContent = '🔐 Unlock Shutter OTP';
        } else if (d.phase === 'MORNING_DISPLAY') {
          objChip.textContent = `🛵 Push Scooters Outside (${outsideCount}/10)`;
        } else if (d.phase === 'DAYTIME') {
          const served = global.CustomerQueue ? global.CustomerQueue.resolvedCount : d.customersServedToday;
          objChip.textContent = `🛠️ Serve Customers (${served}/${d.customersTargetToday})`;
        } else if (d.phase === 'EVENING_PACKUP') {
          objChip.textContent = `🌙 Park Scooters Inside (${insideCount}/10)`;
        } else if (d.phase === 'BOSS_BIG_TRUCK') {
          objChip.textContent = '🚛 Unload 8 Big Truck Crates';
        } else if (d.phase === 'BOSS_SMALL_TRUCK') {
          objChip.textContent = '🛻 Fit 9 Scooters in Small Truck';
        } else {
          objChip.textContent = '🕹️ Walk in 3D & Tap INTERACT';
        }
      }
    },

    openPauseSettingsModal() {
      const container = document.getElementById('modal-layer');
      if (!container) return;
      const d = global.GameState.data;
      const jass = d.helpers.jass;
      const tanu = d.helpers.tanu;

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card">
            <div class="modal-header-bar red-header">
              <div>
                <span class="phase-pill">⚙️ PAUSE &amp; DEALERSHIP SETTINGS</span>
                <h3>Aulakh Motors — Day ${d.currentDay}</h3>
              </div>
              <button type="button" class="btn-close-modal" id="btn-close-pause">✕</button>
            </div>

            <div class="staff-cards-list">
              <div class="staff-member-card">
                <div class="staff-avatar">🍱</div>
                <div class="staff-details">
                  <h4>Jashan’s Lunch Tiffin &amp; Helper Assist</h4>
                  <p>Walk to the 3D Tiffin on the counter (or tap below) for 100% energy, or ask Jass to batch-move scooters.</p>
                  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                    <button type="button" class="btn-primary-sm" id="btn-pause-tiffin">🍱 Eat Tiffin (100% ⚡)</button>
                    <button type="button" class="btn-secondary-sm" id="btn-pause-jass-batch">👷 Ask Jass to Move Scooters</button>
                  </div>
                </div>
              </div>

              <div class="staff-member-card">
                <div class="staff-avatar">👷🏽‍♂️</div>
                <div class="staff-details">
                  <h4>Jass (Helper • Lv.${jass.level}/5)</h4>
                  <p>+${jass.greenZoneBonus}% Big Truck Safe Zone &amp; faster scooter batch assist.</p>
                  <button type="button" class="btn-primary-sm" id="btn-upgrade-jass">
                    ${jass.level < 5 ? `⬆️ Train Jass (₹${jass.level * 2500})` : '✅ Max Level'}
                  </button>
                </div>
              </div>

              <div class="staff-member-card">
                <div class="staff-avatar">👩‍🔧</div>
                <div class="staff-details">
                  <h4>Tanu (Helper • Lv.${tanu.level}/5)</h4>
                  <p>+${tanu.greenZoneBonus}% Big Truck Safe Zone &amp; -${Math.round(tanu.patienceDecayReduction * 100)}% Customer Patience drain.</p>
                  <button type="button" class="btn-primary-sm" id="btn-upgrade-tanu">
                    ${tanu.level < 5 ? `⬆️ Train Tanu (₹${tanu.level * 2500})` : '✅ Max Level'}
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-footer-btns">
              <button type="button" class="btn-secondary-md" id="btn-pause-audio">
                ${d.soundEnabled ? '🔊 Audio: ON' : '🔇 Audio: MUTED'}
              </button>
              <button type="button" class="btn-secondary-md" id="btn-pause-day-select">📅 Day Select</button>
              <button type="button" class="btn-secondary-md" id="btn-pause-practice">⚡ Practice Mini-Games</button>
              <button type="button" class="btn-primary-lg" id="btn-pause-resume">▶ Resume Game</button>
            </div>
          </div>
        </div>
      `;

      const closePause = () => {
        container.innerHTML = '';
      };

      document.getElementById('btn-close-pause').addEventListener('click', closePause);
      document.getElementById('btn-pause-resume').addEventListener('click', closePause);

      document.getElementById('btn-pause-tiffin').addEventListener('click', () => {
        global.GameState.eatTiffin();
        this.updateHUD();
        closePause();
      });

      document.getElementById('btn-pause-jass-batch').addEventListener('click', () => {
        closePause();
        this.jassAssistMoveBatch();
      });

      document.getElementById('btn-upgrade-jass').addEventListener('click', () => {
        if (global.GameState.upgradeHelper('jass')) {
          this.updateHUD();
          this.openPauseSettingsModal();
        }
      });

      document.getElementById('btn-upgrade-tanu').addEventListener('click', () => {
        if (global.GameState.upgradeHelper('tanu')) {
          this.updateHUD();
          this.openPauseSettingsModal();
        }
      });

      document.getElementById('btn-pause-audio').addEventListener('click', () => {
        global.GameState.toggleSound();
        this.openPauseSettingsModal();
      });

      document.getElementById('btn-pause-day-select').addEventListener('click', () => {
        closePause();
        global.CustomerQueue.stopQueue();
        this.showScreen('DAY_SELECT');
      });

      document.getElementById('btn-pause-practice').addEventListener('click', () => {
        this.openEventSimulatorPicker();
      });
    },

    openDaySummaryModal() {
      const container = document.getElementById('modal-layer');
      if (!container) return;
      const d = global.GameState.data;
      const hist = d.dayHistory[d.currentDay] || { profit: d.todayProfit, stars: 2 };
      const nextDay = Math.min(90, d.currentDay + 1);
      const nextMeta = global.GameState.getDayMetadata(nextDay);

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card">
            <div class="modal-header-bar emerald-header">
              <div>
                <span class="phase-pill">🌙 DAY ${d.currentDay} COMPLETE</span>
                <h3>Aulakh Motors Daily Report</h3>
              </div>
              <div class="stars-display">${'⭐'.repeat(hist.stars)}${'☆'.repeat(3 - hist.stars)}</div>
            </div>

            <div class="summary-ledger-grid">
              <div class="ledger-item">
                <span>Revenue Earned</span>
                <strong class="pos">+Rs ${d.todayRevenue}</strong>
              </div>
              <div class="ledger-item">
                <span>Penalties</span>
                <strong class="neg">-Rs ${d.todayPenalties}</strong>
              </div>
              <div class="ledger-item total-row">
                <span>Net Profit</span>
                <strong class="${d.todayProfit >= 0 ? 'pos' : 'neg'}">${d.todayProfit >= 0 ? '+Rs ' + d.todayProfit : '-Rs ' + Math.abs(d.todayProfit)}</strong>
              </div>
              <div class="ledger-item">
                <span>Total Treasury</span>
                <strong>Rs ${d.cash.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div class="next-day-preview-box">
              <span>🔓 UNLOCKED: <strong>Day ${nextDay} (${nextMeta.badge})</strong></span>
              <small>${nextMeta.icon} ${nextMeta.title}</small>
            </div>

            <div class="modal-footer-btns">
              <button type="button" class="btn-secondary-md" id="btn-sum-calendar">📅 Day Select</button>
              <button type="button" class="btn-primary-lg" id="btn-sum-next-day">▶ Play Day ${nextDay}</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-sum-calendar').addEventListener('click', () => {
        container.innerHTML = '';
        d.currentDay = nextDay;
        d.phase = 'HUB';
        global.GameState.save();
        this.showScreen('DAY_SELECT');
      });

      document.getElementById('btn-sum-next-day').addEventListener('click', () => {
        container.innerHTML = '';
        d.currentDay = nextDay;
        d.phase = 'HUB';
        global.GameState.save();
        this.showScreen('GAMEPLAY');
        this.startDayWorkflow(nextDay);
      });
    },

    openEventSimulatorPicker() {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card">
            <div class="modal-header-bar amber-header">
              <div>
                <span class="phase-pill">🎮 PRACTICE &amp; EVENT SELECTOR</span>
                <h3>Launch Any Boss Event or Mini-Game</h3>
              </div>
              <button type="button" class="btn-close-modal" id="btn-close-sim-picker">✕</button>
            </div>
            <div class="sim-picker-grid">
              <button type="button" class="sim-card-btn" id="sim-launch-otp">
                <strong>🔐 Morning OTP Lock</strong>
                <small>5s Phone Code + 3-Try Keypad</small>
              </button>
              <button type="button" class="sim-card-btn" id="sim-launch-big-truck">
                <strong>🚛 Big Truck Boss (Day 15)</strong>
                <small>8 Crates Timing Slider</small>
              </button>
              <button type="button" class="sim-card-btn" id="sim-launch-small-truck">
                <strong>🛻 Small Truck Puzzle (Day 6)</strong>
                <small>9 Scooters: 3 Top, 3 Inside, 3 Half-Out</small>
              </button>
              <button type="button" class="sim-card-btn" id="sim-launch-wiring">
                <strong>🔌 Repair 1: Wiring Fix</strong>
                <small>Drag 4 Colored Wires</small>
              </button>
              <button type="button" class="sim-card-btn" id="sim-launch-battery">
                <strong>🔋 Repair 2: Battery Setup</strong>
                <small>Connect (+) to (+) and (-) to (-)</small>
              </button>
              <button type="button" class="sim-card-btn" id="sim-launch-hardware">
                <strong>🔩 Repair 3: Hardware</strong>
                <small>Circular Screw Drag + Couplers</small>
              </button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-close-sim-picker').addEventListener('click', () => {
        container.innerHTML = '';
      });

      document.getElementById('sim-launch-otp').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.OTPLock.start(() => this.updateHUD());
      });

      document.getElementById('sim-launch-big-truck').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.GameState.data.unlockedMaxDay = Math.max(global.GameState.data.unlockedMaxDay, 15);
        global.GameState.data.currentDay = 15;
        global.GameState.data.phase = 'BOSS_BIG_TRUCK';
        global.GameState.save();
        this.updateHUD();
        global.BigTruckBoss.start(() => {
          if (global.Scene3D) global.Scene3D.setCameraPreset('THIRD_PERSON');
          global.GameState.completeCurrentDay();
          this.updateHUD();
          this.openDaySummaryModal();
        });
      });

      document.getElementById('sim-launch-small-truck').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.GameState.data.unlockedMaxDay = Math.max(global.GameState.data.unlockedMaxDay, 6);
        global.GameState.data.currentDay = 6;
        global.GameState.data.phase = 'BOSS_SMALL_TRUCK';
        global.GameState.save();
        this.updateHUD();
        global.SmallTruckPuzzle.start(() => {
          if (global.Scene3D) global.Scene3D.setCameraPreset('THIRD_PERSON');
          global.GameState.completeCurrentDay();
          this.updateHUD();
          this.openDaySummaryModal();
        });
      });

      document.getElementById('sim-launch-wiring').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.RepairMiniGames.openForCustomer(
          { name: 'Gurpreet Singh', repairType: 'WIRING', repairTitle: 'Controller Wiring Harness Fix', reward: 750 },
          () => {
            global.GameState.addCash(750, 'Wiring Repair Completed');
            this.updateHUD();
          }
        );
      });

      document.getElementById('sim-launch-battery').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.RepairMiniGames.openForCustomer(
          { name: 'Harjit Kaur', repairType: 'BATTERY', repairTitle: '72V Lithium Battery Setup', reward: 800 },
          () => {
            global.GameState.addCash(800, 'Battery Setup Completed');
            this.updateHUD();
          }
        );
      });

      document.getElementById('sim-launch-hardware').addEventListener('click', () => {
        this.showScreen('GAMEPLAY');
        global.RepairMiniGames.openForCustomer(
          { name: 'Manpreet Gill', repairType: 'HARDWARE', repairTitle: 'Hub Bolts & Couplers Fastening', reward: 850 },
          () => {
            global.GameState.addCash(850, 'Hardware Fastening Completed');
            this.updateHUD();
          }
        );
      });
    },

    showFloatingToast(message, type = 'info') {
      const tray = document.getElementById('toast-notification-tray');
      if (!tray) return;
      const toast = document.createElement('div');
      toast.className = `game-toast toast-${type}`;
      toast.innerHTML = message;
      tray.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 250);
      }, 2400);
    }
  };

  global.UI = UI;

  window.addEventListener('DOMContentLoaded', () => {
    UI.init();
  });
})(window);
