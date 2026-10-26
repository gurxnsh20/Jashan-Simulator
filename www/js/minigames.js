/**
 * Jashan's Simulator (AM) - Aulakh Motors
 * Module: minigames.js
 * Purpose:
 *   1. Daytime Customer Queue on the 4 Brown Plastic Waiting Chairs outside/inside the shop
 *      with real-time Green-to-Red Patience Meters and angry walkout penalty (-Rs 600).
 *   2. All 3 Complete Interactive Repair Mini-Games (triggered when tapping a waiting customer):
 *      - Mini-Game 1: WIRING FIX (Drag 4 differently colored wires - Red, Blue, Yellow, Green -
 *        across an interactive SVG/Canvas harness to match their corresponding colored nodes).
 *      - Mini-Game 2: BATTERY SETUP (Drag Positive [+] Red Cable to Positive [+] Lithium Pack Terminal
 *        and Negative [-] Black Cable to Negative [-] Terminal, with short-circuit spark protection).
 *      - Mini-Game 3: HARDWARE FASTENING (Circular dragging motion on 3 loose motor hub bolts to torque
 *        them to 100%, plus tapping 3 white plastic wiring couplers to snap them shut).
 */

(function (global) {
  'use strict';

  const CUSTOMER_NAMES = [
    'Gurpreet Singh', 'Harjit Kaur', 'Manpreet Gill', 'Simranjeet Brar',
    'Kuldeep Sidhu', 'Navjot Sandhu', 'Rajवीर Dhillon', 'Amandeep Grewal',
    'Sukhchain Virk', 'Lovepreet Aulakh', 'Bikramjit Mann', 'Jaswinder Bains'
  ];

  const REPAIR_TYPES = [
    { id: 'WIRING', title: 'Controller Wiring Harness Fix', icon: '🔌', reward: 750 },
    { id: 'BATTERY', title: 'Lithium-Ion Battery Terminal Setup', icon: '🔋', reward: 800 },
    { id: 'HARDWARE', title: 'Hub Bolts & Coupler Fastening', icon: '🔩', reward: 850 }
  ];

  const CustomerQueue = {
    chairs: [null, null, null, null], // 4 brown plastic waiting chairs
    spawnedCount: 0,
    resolvedCount: 0,
    targetCount: 5,
    isRunning: false,
    activeMiniGameCustomer: null,
    rafId: null,
    lastTick: 0,
    spawnTimer: 0,
    onAllServedCallback: null,

    startDaytimeQueue(targetCount, onAllServed) {
      this.stopQueue();
      this.chairs = [null, null, null, null];
      this.spawnedCount = 0;
      this.resolvedCount = 0;
      this.targetCount = targetCount || 5;
      this.isRunning = true;
      this.activeMiniGameCustomer = null;
      this.onAllServedCallback = onAllServed;
      this.lastTick = performance.now();
      this.spawnTimer = 0.6; // Spawn first customer almost immediately

      this.renderChairsUI();
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    },

    stopQueue() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    },

    tick(now) {
      if (!this.isRunning) return;
      const dt = Math.min(0.08, (now - this.lastTick) / 1000);
      this.lastTick = now;

      // Spawn new customers if chairs available and we haven't reached targetCount
      if (this.spawnedCount < this.targetCount) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const emptyChairIdx = this.chairs.findIndex((c) => c === null);
          if (emptyChairIdx !== -1) {
            this.spawnCustomerAtChair(emptyChairIdx);
            this.spawnTimer = 3.8; // Next customer arrives in ~3.8s
          } else {
            this.spawnTimer = 1.5;
          }
        }
      }

      // Decay patience for waiting customers (slowed down if Tanu is helping or while player is actively repairing that customer)
      const tanuReduction =
        global.GameState.data.helpers.tanu && global.GameState.data.helpers.tanu.active
          ? global.GameState.data.helpers.tanu.patienceDecayReduction || 0.2
          : 0;

      let uiNeedsRefresh = false;

      for (let i = 0; i < this.chairs.length; i++) {
        const cust = this.chairs[i];
        if (!cust) continue;

        // If player is currently repairing THIS specific customer, pause their patience decay slightly
        const isBeingRepaired = this.activeMiniGameCustomer && this.activeMiniGameCustomer.id === cust.id;
        const baseDecayRate = isBeingRepaired ? 1.2 : 4.2; // ~24 seconds total patience on normal chairs
        const effectiveDecay = baseDecayRate * (1 - tanuReduction);

        cust.patience = Math.max(0, cust.patience - effectiveDecay * dt);
        this.updateSingleChairMeterUI(i, cust.patience);

        if (cust.patience <= 0) {
          // Customer walks out angry!
          this.handleCustomerWalkout(i, cust);
          uiNeedsRefresh = true;
        }
      }

      if (uiNeedsRefresh) {
        this.renderChairsUI();
      }

      if (this.resolvedCount >= this.targetCount && this.chairs.every((c) => c === null)) {
        this.stopQueue();
        if (this.onAllServedCallback) {
          setTimeout(() => this.onAllServedCallback(), 500);
        }
        return;
      }

      this.rafId = requestAnimationFrame((t) => this.tick(t));
    },

    spawnCustomerAtChair(chairIndex) {
      this.spawnedCount += 1;
      const name = CUSTOMER_NAMES[(this.spawnedCount + global.GameState.data.currentDay) % CUSTOMER_NAMES.length];
      const repair = REPAIR_TYPES[(this.spawnedCount - 1) % REPAIR_TYPES.length];
      const avatars = ['🧔🏽‍♂️', '👳🏽‍♂️', '👩🏽', '👨🏽‍🦱', '🧓🏽', '👱🏽‍♀️'];

      this.chairs[chairIndex] = {
        id: 'cust_' + Date.now() + '_' + chairIndex,
        chairIndex,
        name,
        avatar: avatars[this.spawnedCount % avatars.length],
        repairType: repair.id,
        repairTitle: repair.title,
        repairIcon: repair.icon,
        reward: repair.reward,
        patience: 100
      };

      if (global.Sound) global.Sound.beep();
      this.renderChairsUI();
    },

    handleCustomerWalkout(chairIndex, cust) {
      if (this.activeMiniGameCustomer && this.activeMiniGameCustomer.id === cust.id) {
        RepairMiniGames.closeActiveModal();
        this.activeMiniGameCustomer = null;
      }
      this.chairs[chairIndex] = null;
      this.resolvedCount += 1;
      global.GameState.data.customersAngryToday += 1;
      global.GameState.addCash(-600, `${cust.name} left angry!`);
      if (global.Sound) global.Sound.error();
    },

    onCustomerClicked(chairIndex) {
      const cust = this.chairs[chairIndex];
      if (!cust) return;

      // Check Jashan's Stamina!
      if (global.GameState.data.stamina < 15) {
        if (global.Sound) global.Sound.error();
        if (global.UI) {
          global.UI.showFloatingToast('⚡ Jashan is exhausted! Tap the Home Tiffin 🍱 on the counter to restore 100% energy!', 'danger');
        }

        return;
      }

      this.activeMiniGameCustomer = cust;
      if (global.Sound) global.Sound.click();

      RepairMiniGames.openForCustomer(cust, () => {
        // On Repair Completed Successfully!
        const cIdx = this.chairs.findIndex((c) => c && c.id === cust.id);
        if (cIdx !== -1) {
          const speedTip = cust.patience >= 65 ? 200 : cust.patience >= 35 ? 100 : 0;
          const totalPay = cust.reward + speedTip;
          this.chairs[cIdx] = null;
          this.resolvedCount += 1;
          this.activeMiniGameCustomer = null;
          global.GameState.data.customersServedToday += 1;
          global.GameState.data.stats.totalScootersRepaired += 1;
          global.GameState.consumeStamina(18);
          global.GameState.addCash(totalPay, `${cust.repairTitle}${speedTip ? ' + Fast Tip' : ''}`);
          this.renderChairsUI();
          if (global.UI) global.UI.updateHUD();
        }
      }, () => {
        // On Modal Closed / Cancelled
        this.activeMiniGameCustomer = null;
      });
    },

    updateSingleChairMeterUI(chairIndex, patience) {
      const bar = document.getElementById(`chair-patience-fill-${chairIndex}`);
      const pctText = document.getElementById(`chair-patience-pct-${chairIndex}`);
      if (bar) {
        bar.style.width = `${Math.round(patience)}%`;
        if (patience > 60) {
          bar.style.background = '#10B981'; // Green
        } else if (patience > 30) {
          bar.style.background = '#F59E0B'; // Amber
        } else {
          bar.style.background = '#EF4444'; // Red
        }
      }
      if (pctText) {
        pctText.textContent = `${Math.round(patience)}%`;
      }
    },

    renderChairsUI() {
      if (global.Scene3D) {
        for (let cIdx = 0; cIdx < 4; cIdx++) {
          global.Scene3D.syncCustomerChair3D(cIdx, this.chairs[cIdx]);
        }
      }
      if (global.UI && typeof global.UI.updateHUD === 'function') {
        global.UI.updateHUD();
      }
    }
  };

  /**
   * REPAIR MINI-GAMES ENGINE (ZERO PLACEHOLDERS)
   * 1. Wiring Fix
   * 2. Battery Setup
   * 3. Hardware Fastening
   */
  const RepairMiniGames = {
    activeCleanup: null,

    openForCustomer(cust, onSuccess, onCancel) {
      this.closeActiveModal();
      if (cust.repairType === 'WIRING') {
        this.startWiringMiniGame(cust, onSuccess, onCancel);
      } else if (cust.repairType === 'BATTERY') {
        this.startBatteryMiniGame(cust, onSuccess, onCancel);
      } else {
        this.startHardwareMiniGame(cust, onSuccess, onCancel);
      }
    },

    closeActiveModal() {
      if (this.activeCleanup) {
        this.activeCleanup();
        this.activeCleanup = null;
      }
      const container = document.getElementById('modal-layer');
      if (container) container.innerHTML = '';
    },

    /* =========================================================================
     * MINI-GAME 1: WIRING FIX
     * Drag 4 differently colored wires (Red, Blue, Yellow, Green) from the left
     * scooter controller plugs to match their corresponding colored nodes on the right.
     * ========================================================================= */
    startWiringMiniGame(cust, onSuccess, onCancel) {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      const WIRES = [
        { id: 'red', label: '5V Ignition (RED)', color: '#EF4444' },
        { id: 'blue', label: 'Hall Sensor (BLUE)', color: '#3B82F6' },
        { id: 'yellow', label: 'Phase A (YELLOW)', color: '#F59E0B' },
        { id: 'green', label: 'Throttle Signal (GREEN)', color: '#10B981' }
      ];

      // Shuffle right-hand target nodes so wires cross authentically
      const rightOrder = [WIRES[2], WIRES[0], WIRES[3], WIRES[1]];
      const connected = {}; // { red: true, ... }
      let activeDragColor = null;
      let pointerPos = { x: 0, y: 0 };

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card minigame-modal-card">
            <div class="modal-header-bar emerald-header">
              <div>
                <span class="phase-pill">🔌 REPAIR MINI-GAME 1/3 • WIRING FIX</span>
                <h3>${cust.name}'s Scooter — ${cust.repairTitle}</h3>
              </div>
              <button type="button" class="btn-close-modal" id="btn-cancel-minigame">✕</button>
            </div>

            <p class="modal-instruction">
              Drag each of the <strong>4 colored wires</strong> from the Left Controller Terminals to its matching colored Socket Node on the right! (Or tap a left terminal, then tap its matching right node).
            </p>

            <div class="wiring-board-stage" id="wiring-board-stage">
              <svg class="wiring-svg-layer" id="wiring-svg" viewBox="0 0 500 280" preserveAspectRatio="none"></svg>

              <div class="wiring-column left-terminals">
                ${WIRES.map((w, idx) => `
                  <div class="wire-node-socket left-node" id="wire-left-${w.id}" data-color="${w.id}" data-idx="${idx}" style="border-color:${w.color};">
                    <span class="wire-dot" style="background:${w.color};"></span>
                    <span class="wire-lbl">${w.label}</span>
                  </div>
                `).join('')}
              </div>

              <div class="wiring-column right-terminals">
                ${rightOrder.map((w, idx) => `
                  <div class="wire-node-socket right-node" id="wire-right-${w.id}" data-color="${w.id}" data-idx="${idx}" style="border-color:${w.color};">
                    <span class="wire-lbl">${w.label}</span>
                    <span class="wire-dot" style="background:${w.color};"></span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="minigame-status-footer" id="wiring-status-footer">
              Connected: <strong>0 / 4</strong> Wires
            </div>
          </div>
        </div>
      `;

      const board = document.getElementById('wiring-board-stage');
      const svg = document.getElementById('wiring-svg');
      const statusFooter = document.getElementById('wiring-status-footer');

      const getRelativeCoords = (el) => {
        const bRect = board.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const x = ((eRect.left + eRect.width / 2 - bRect.left) / bRect.width) * 500;
        const y = ((eRect.top + eRect.height / 2 - bRect.top) / bRect.height) * 280;
        return { x, y };
      };

      const renderCables = () => {
        let pathsHtml = '';
        for (const w of WIRES) {
          if (connected[w.id]) {
            const leftEl = document.getElementById(`wire-left-${w.id}`);
            const rightEl = document.getElementById(`wire-right-${w.id}`);
            if (leftEl && rightEl) {
              const p1 = getRelativeCoords(leftEl);
              const p2 = getRelativeCoords(rightEl);
              const cx1 = p1.x + 130;
              const cx2 = p2.x - 130;
              pathsHtml += `<path d="M ${p1.x} ${p1.y} C ${cx1} ${p1.y}, ${cx2} ${p2.y}, ${p2.x} ${p2.y}" stroke="${w.color}" stroke-width="10" stroke-linecap="round" fill="none" />`;
            }
          }
        }

        if (activeDragColor && !connected[activeDragColor]) {
          const wObj = WIRES.find((x) => x.id === activeDragColor);
          const leftEl = document.getElementById(`wire-left-${activeDragColor}`);
          if (wObj && leftEl) {
            const p1 = getRelativeCoords(leftEl);
            const cx1 = p1.x + 100;
            const cx2 = pointerPos.x - 100;
            pathsHtml += `<path d="M ${p1.x} ${p1.y} C ${cx1} ${p1.y}, ${cx2} ${pointerPos.y}, ${pointerPos.x} ${pointerPos.y}" stroke="${wObj.color}" stroke-width="8" stroke-dasharray="10,6" stroke-linecap="round" fill="none" />`;
          }
        }

        svg.innerHTML = pathsHtml;
      };

      const tryConnect = (targetColor) => {
        if (!activeDragColor) return;
        if (activeDragColor === targetColor) {
          connected[targetColor] = true;
          const leftEl = document.getElementById(`wire-left-${targetColor}`);
          const rightEl = document.getElementById(`wire-right-${targetColor}`);
          if (leftEl) leftEl.classList.add('node-connected');
          if (rightEl) rightEl.classList.add('node-connected');
          activeDragColor = null;
          if (global.Sound) global.Sound.spark();
          renderCables();

          const count = Object.keys(connected).length;
          if (statusFooter) {
            statusFooter.innerHTML = `Connected: <strong>${count} / 4</strong> Wires`;
          }
          if (count === 4) {
            if (global.Sound) global.Sound.success();
            if (statusFooter) {
              statusFooter.innerHTML = `✅ <strong>ALL 4 WIRES MATCHED!</strong> Harness Repaired!`;
            }
            setTimeout(() => {
              this.closeActiveModal();
              onSuccess();
            }, 550);
          }
        } else {
          if (global.Sound) global.Sound.error();
          if (statusFooter) {
            statusFooter.innerHTML = `❌ Wrong node color! Match <strong>${activeDragColor.toUpperCase()}</strong> to <strong>${activeDragColor.toUpperCase()}</strong>!`;
          }
          activeDragColor = null;
          renderCables();
        }
      };

      board.querySelectorAll('.left-node').forEach((node) => {
        const c = node.getAttribute('data-color');
        node.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (connected[c]) return;
          activeDragColor = c;
          const bRect = board.getBoundingClientRect();
          pointerPos = {
            x: ((e.clientX - bRect.left) / bRect.width) * 500,
            y: ((e.clientY - bRect.top) / bRect.height) * 280
          };
          board.querySelectorAll('.left-node').forEach((n) => n.classList.remove('node-selected'));
          node.classList.add('node-selected');
          if (global.Sound) global.Sound.click();
          renderCables();
        });
      });

      board.querySelectorAll('.right-node').forEach((node) => {
        const c = node.getAttribute('data-color');
        node.addEventListener('pointerup', () => {
          if (activeDragColor) tryConnect(c);
        });
        node.addEventListener('click', () => {
          if (activeDragColor) tryConnect(c);
        });
      });

      const onPointerMove = (e) => {
        if (!activeDragColor) return;
        const bRect = board.getBoundingClientRect();
        pointerPos = {
          x: Math.max(0, Math.min(500, ((e.clientX - bRect.left) / bRect.width) * 500)),
          y: Math.max(0, Math.min(280, ((e.clientY - bRect.top) / bRect.height) * 280))
        };
        renderCables();
      };

      const onPointerUpGlobal = (e) => {
        if (!activeDragColor) return;
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const rightNode = elUnder && elUnder.closest ? elUnder.closest('.right-node') : null;
        if (rightNode) {
          tryConnect(rightNode.getAttribute('data-color'));
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUpGlobal);

      const cancelBtn = document.getElementById('btn-cancel-minigame');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.closeActiveModal();
          if (onCancel) onCancel();
        });
      }

      this.activeCleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUpGlobal);
      };
    },

    /* =========================================================================
     * MINI-GAME 2: BATTERY SETUP
     * Connect Positive (+) terminal to Positive (+), and Negative (-) to Negative (-).
     * Includes interactive drag/tap clamps, polarity short-circuit spark check, and voltage meter!
     * ========================================================================= */
    startBatteryMiniGame(cust, onSuccess, onCancel) {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      const state = {
        posConnected: false,
        negConnected: false,
        selectedLead: null, // 'POS' | 'NEG'
        draggingLead: null,
        pointerPos: { x: 0, y: 0 }
      };

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card minigame-modal-card">
            <div class="modal-header-bar emerald-header">
              <div>
                <span class="phase-pill">🔋 REPAIR MINI-GAME 2/3 • BATTERY SETUP</span>
                <h3>${cust.name}'s Scooter — 72V Lithium Battery Pack</h3>
              </div>
              <button type="button" class="btn-close-modal" id="btn-cancel-minigame">✕</button>
            </div>

            <p class="modal-instruction">
              Connect the <strong>Positive (+) Red Lead</strong> to the <strong>Positive (+) Battery Post</strong>, and the <strong>Negative (-) Black Lead</strong> to the <strong>Negative (-) Post</strong>! Never cross polarity!
            </p>

            <div class="battery-stage-box" id="battery-stage-box">
              <svg class="wiring-svg-layer" id="battery-svg" viewBox="0 0 500 260" preserveAspectRatio="none"></svg>

              <!-- Scooter Harness Clamps (Top/Left) -->
              <div class="battery-leads-row">
                <div class="battery-lead-clamp lead-pos" id="lead-clamp-pos" data-polarity="POS">
                  <div class="clamp-icon">➕</div>
                  <div class="clamp-info">
                    <strong>POSITIVE (+) LEAD</strong>
                    <small>Red 72V Main Cable</small>
                  </div>
                </div>

                <div class="battery-lead-clamp lead-neg" id="lead-clamp-neg" data-polarity="NEG">
                  <div class="clamp-icon">➖</div>
                  <div class="clamp-info">
                    <strong>NEGATIVE (-) LEAD</strong>
                    <small>Black Ground Cable</small>
                  </div>
                </div>
              </div>

              <!-- 72V Aulakh Lithium Battery Unit (Bottom) -->
              <div class="lithium-battery-body">
                <div class="battery-terminals-bar">
                  <div class="battery-post post-pos" id="post-target-pos" data-polarity="POS">
                    <span class="post-symbol">+</span>
                    <span class="post-label">POSITIVE (+) POST</span>
                  </div>

                  <div class="battery-volt-readout" id="battery-volt-readout">
                    <span>0.0 V</span>
                    <small>ISOLATED</small>
                  </div>

                  <div class="battery-post post-neg" id="post-target-neg" data-polarity="NEG">
                    <span class="post-symbol">−</span>
                    <span class="post-label">NEGATIVE (-) POST</span>
                  </div>
                </div>
                <div class="battery-casing-brand">
                  🐯 AULAKH MOTORS • 72V 42Ah LFP SMART BATTERY PACK
                </div>
              </div>
            </div>

            <div class="minigame-status-footer" id="battery-status-footer">
              Drag or tap a cable clamp above, then attach it to the matching (+) or (-) battery post!
            </div>
          </div>
        </div>
      `;

      const stage = document.getElementById('battery-stage-box');
      const svg = document.getElementById('battery-svg');
      const voltEl = document.getElementById('battery-volt-readout');
      const statusEl = document.getElementById('battery-status-footer');

      const getCoords = (el) => {
        const sRect = stage.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        return {
          x: ((eRect.left + eRect.width / 2 - sRect.left) / sRect.width) * 500,
          y: ((eRect.top + eRect.height / 2 - sRect.top) / sRect.height) * 260
        };
      };

      const renderBatteryCables = () => {
        let html = '';
        if (state.posConnected) {
          const p1 = getCoords(document.getElementById('lead-clamp-pos'));
          const p2 = getCoords(document.getElementById('post-target-pos'));
          html += `<path d="M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + 60}, ${p2.x} ${p2.y - 60}, ${p2.x} ${p2.y}" stroke="#EF4444" stroke-width="12" stroke-linecap="round" fill="none"/>`;
        }
        if (state.negConnected) {
          const p1 = getCoords(document.getElementById('lead-clamp-neg'));
          const p2 = getCoords(document.getElementById('post-target-neg'));
          html += `<path d="M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + 60}, ${p2.x} ${p2.y - 60}, ${p2.x} ${p2.y}" stroke="#1F2937" stroke-width="12" stroke-linecap="round" fill="none"/>`;
        }
        if (state.draggingLead) {
          const srcEl = document.getElementById(state.draggingLead === 'POS' ? 'lead-clamp-pos' : 'lead-clamp-neg');
          const color = state.draggingLead === 'POS' ? '#EF4444' : '#1F2937';
          if (srcEl) {
            const p1 = getCoords(srcEl);
            html += `<path d="M ${p1.x} ${p1.y} L ${state.pointerPos.x} ${state.pointerPos.y}" stroke="${color}" stroke-width="10" stroke-dasharray="10,6" stroke-linecap="round" fill="none"/>`;
          }
        }
        svg.innerHTML = html;
      };

      const attemptTerminalConnect = (leadPol, postPol) => {
        if (!leadPol) return;
        if (leadPol !== postPol) {
          // Reverse Polarity Short Circuit!
          if (global.Sound) global.Sound.error();
          global.GameState.addCash(-150, 'Reverse Polarity Spark Warning');
          if (statusEl) {
            statusEl.innerHTML = '⚡ <strong>SPARK WARNING!</strong> Never connect (+) to (-)! Reverse polarity damages the BMS (-Rs 150)!';
          }
          state.selectedLead = null;
          state.draggingLead = null;
          renderBatteryCables();
          return;
        }

        if (leadPol === 'POS') {
          state.posConnected = true;
          document.getElementById('lead-clamp-pos').classList.add('clamp-locked');
          document.getElementById('post-target-pos').classList.add('post-locked');
        } else {
          state.negConnected = true;
          document.getElementById('lead-clamp-neg').classList.add('clamp-locked');
          document.getElementById('post-target-neg').classList.add('post-locked');
        }

        state.selectedLead = null;
        state.draggingLead = null;
        if (global.Sound) global.Sound.spark();
        renderBatteryCables();

        if (state.posConnected && state.negConnected) {
          if (voltEl) {
            voltEl.innerHTML = `<span style="color:#10B981;">72.8 V</span><small>ONLINE ✅</small>`;
          }
          if (statusEl) {
            statusEl.innerHTML = '✅ <strong>72.8V LITHIUM PACK ONLINE!</strong> Polarity Verified!';
          }
          if (global.Sound) global.Sound.success();
          setTimeout(() => {
            this.closeActiveModal();
            onSuccess();
          }, 600);
        } else {
          if (voltEl) {
            voltEl.innerHTML = `<span>36.4 V</span><small>1 LEAD LEFT</small>`;
          }
          if (statusEl) {
            statusEl.innerHTML = `👍 ${leadPol === 'POS' ? 'Positive (+)' : 'Negative (-)'} terminal clamped! Now connect the remaining lead!`;
          }
        }
      };

      ['pos', 'neg'].forEach((key) => {
        const clampEl = document.getElementById(`lead-clamp-${key}`);
        const pol = key.toUpperCase();
        clampEl.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if ((pol === 'POS' && state.posConnected) || (pol === 'NEG' && state.negConnected)) return;
          state.selectedLead = pol;
          state.draggingLead = pol;
          const sRect = stage.getBoundingClientRect();
          state.pointerPos = {
            x: ((e.clientX - sRect.left) / sRect.width) * 500,
            y: ((e.clientY - sRect.top) / sRect.height) * 260
          };
          document.querySelectorAll('.battery-lead-clamp').forEach((el) => el.classList.remove('clamp-selected'));
          clampEl.classList.add('clamp-selected');
          if (global.Sound) global.Sound.click();
          renderBatteryCables();
        });
      });

      ['pos', 'neg'].forEach((key) => {
        const postEl = document.getElementById(`post-target-${key}`);
        const postPol = key.toUpperCase();
        postEl.addEventListener('click', () => {
          if (state.selectedLead) {
            attemptTerminalConnect(state.selectedLead, postPol);
          }
        });
        postEl.addEventListener('pointerup', () => {
          if (state.draggingLead || state.selectedLead) {
            attemptTerminalConnect(state.draggingLead || state.selectedLead, postPol);
          }
        });
      });

      const onPointerMove = (e) => {
        if (!state.draggingLead) return;
        const sRect = stage.getBoundingClientRect();
        state.pointerPos = {
          x: Math.max(0, Math.min(500, ((e.clientX - sRect.left) / sRect.width) * 500)),
          y: Math.max(0, Math.min(260, ((e.clientY - sRect.top) / sRect.height) * 260))
        };
        renderBatteryCables();
      };

      const onPointerUp = (e) => {
        if (!state.draggingLead) return;
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const postEl = elUnder && elUnder.closest ? elUnder.closest('.battery-post') : null;
        if (postEl) {
          attemptTerminalConnect(state.draggingLead, postEl.getAttribute('data-polarity'));
        } else {
          state.draggingLead = null;
          renderBatteryCables();
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      const cancelBtn = document.getElementById('btn-cancel-minigame');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.closeActiveModal();
          if (onCancel) onCancel();
        });
      }

      this.activeCleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
    },

    /* =========================================================================
     * MINI-GAME 3: HARDWARE FASTENING
     * 1) Circular dragging motion around the Hub Screw Dial to fasten 3 bolts to 100%.
     * 2) Tap 3 Plastic Wiring Couplers to snap them tightly together.
     * ========================================================================= */
    startHardwareMiniGame(cust, onSuccess, onCancel) {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      const state = {
        bolts: [0, 0, 0], // 0 to 100% torque each
        activeBoltIdx: 0,
        couplers: [false, false, false], // 3 snap couplers
        isDraggingDial: false,
        lastAngle: null
      };

      container.innerHTML = `
        <div class="game-modal-backdrop">
          <div class="game-modal-card minigame-modal-card">
            <div class="modal-header-bar emerald-header">
              <div>
                <span class="phase-pill">🔩 REPAIR MINI-GAME 3/3 • HARDWARE & COUPLERS</span>
                <h3>${cust.name}'s Scooter — ${cust.repairTitle}</h3>
              </div>
              <button type="button" class="btn-close-modal" id="btn-cancel-minigame">✕</button>
            </div>

            <p class="modal-instruction">
              <strong>Part A:</strong> Drag in a <strong>circular motion</strong> around the Ratchet Screw Dial to tighten all 3 Hub Bolts to 100%.<br/>
              <strong>Part B:</strong> <strong>Tap all 3 Couplers</strong> on the right to snap the connectors shut!
            </p>

            <div class="hardware-split-stage">
              <!-- Left: Circular Screw Fastening Dial -->
              <div class="hardware-screw-panel">
                <div class="bolt-selector-tabs" id="bolt-selector-tabs">
                  ${[0, 1, 2].map((i) => `
                    <button type="button" class="bolt-tab-btn ${i === 0 ? 'active-bolt' : ''}" data-bolt="${i}" id="bolt-tab-${i}">
                      🔩 Bolt #${i + 1}: <span id="bolt-pct-${i}">0%</span>
                    </button>
                  `).join('')}
                </div>

                <div class="circular-screw-arena" id="screw-dial-arena">
                  <div class="screw-orbit-ring">
                    <div class="screw-direction-hint">↻ Drag in a Circle ↻</div>
                    <div class="screw-head-hex" id="screw-head-hex" style="transform: rotate(0deg);">
                      <div class="screw-slot-line"></div>
                      <div class="screw-slot-line cross"></div>
                    </div>
                  </div>
                </div>
                <div class="screw-quick-hint">Tip: Drag your finger/mouse in circles around the bolt head!</div>
              </div>

              <!-- Right: Tap to Connect Couplers -->
              <div class="hardware-couplers-panel">
                <h4>🔗 Snap-Fit Wiring Couplers (Tap to Connect)</h4>
                <div class="couplers-list">
                  ${['Motor Hall Coupler', 'Brake Cut-Off Coupler', 'LED Headlamp Coupler'].map((name, idx) => `
                    <button type="button" class="coupler-snap-card" id="coupler-card-${idx}" data-coupler="${idx}">
                      <div class="coupler-plugs-visual" id="coupler-vis-${idx}">
                        <span class="plug-left">🔌===</span>
                        <span class="plug-gap">•••</span>
                        <span class="plug-right">===🔌</span>
                      </div>
                      <div class="coupler-meta">
                        <strong>${name}</strong>
                        <span class="coupler-badge" id="coupler-badge-${idx}">TAP TO SNAP</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="minigame-status-footer" id="hardware-status-footer">
              Progress: <strong>0/3 Bolts Tightened</strong> • <strong>0/3 Couplers Snapped</strong>
            </div>
          </div>
        </div>
      `;

      const dialArena = document.getElementById('screw-dial-arena');
      const screwHex = document.getElementById('screw-head-hex');
      const statusFooter = document.getElementById('hardware-status-footer');
      let visualRotation = 0;

      const checkAllHardwareComplete = () => {
        const boltsDone = state.bolts.filter((b) => b >= 100).length;
        const couplersDone = state.couplers.filter(Boolean).length;
        if (statusFooter) {
          statusFooter.innerHTML = `Progress: <strong>${boltsDone}/3 Bolts Tightened</strong> • <strong>${couplersDone}/3 Couplers Snapped</strong>`;
        }
        if (boltsDone === 3 && couplersDone === 3) {
          if (global.Sound) global.Sound.success();
          if (statusFooter) {
            statusFooter.innerHTML = `✅ <strong>ALL BOLTS TORQUED & COUPLERS SNAPPED!</strong> Hardware Check Complete!`;
          }
          setTimeout(() => {
            this.closeActiveModal();
            onSuccess();
          }, 550);
        }
      };

      const selectBolt = (idx) => {
        state.activeBoltIdx = idx;
        document.querySelectorAll('.bolt-tab-btn').forEach((b, i) => {
          b.classList.toggle('active-bolt', i === idx);
        });
      };

      document.querySelectorAll('.bolt-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectBolt(Number(btn.getAttribute('data-bolt')));
        });
      });

      const advanceBoltTorque = (deltaDegrees) => {
        const idx = state.activeBoltIdx;
        if (state.bolts[idx] >= 100) {
          const nextIdx = state.bolts.findIndex((b) => b < 100);
          if (nextIdx !== -1) selectBolt(nextIdx);
          return;
        }
        // ~540 degrees of circular rotation = 100% bolt fastened
        state.bolts[idx] = Math.min(100, state.bolts[idx] + (deltaDegrees / 540) * 100);
        visualRotation += deltaDegrees;
        if (screwHex) {
          screwHex.style.transform = `rotate(${Math.round(visualRotation)}deg)`;
        }
        const pctEl = document.getElementById(`bolt-pct-${idx}`);
        const tabEl = document.getElementById(`bolt-tab-${idx}`);
        if (pctEl) pctEl.textContent = `${Math.round(state.bolts[idx])}%`;

        if (Math.random() < 0.25 && global.Sound) {
          global.Sound.ratchet();
        }

        if (state.bolts[idx] >= 100) {
          if (tabEl) tabEl.classList.add('bolt-done');
          if (global.Sound) global.Sound.beep();
          const nextOpen = state.bolts.findIndex((b) => b < 100);
          if (nextOpen !== -1) {
            selectBolt(nextOpen);
          }
        }
        checkAllHardwareComplete();
      };

      const computeAngleFromCenter = (clientX, clientY) => {
        const rect = dialArena.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      };

      dialArena.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        state.isDraggingDial = true;
        state.lastAngle = computeAngleFromCenter(e.clientX, e.clientY);
        // Also give a small 12% ratchet nudge on tap/click for accessibility on small screens
        advanceBoltTorque(65);
      });

      const onPointerMove = (e) => {
        if (!state.isDraggingDial) return;
        const curAngle = computeAngleFromCenter(e.clientX, e.clientY);
        if (state.lastAngle !== null) {
          let diff = curAngle - state.lastAngle;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          const absDiff = Math.abs(diff);
          if (absDiff > 1 && absDiff < 90) {
            advanceBoltTorque(absDiff * 1.35);
          }
        }
        state.lastAngle = curAngle;
      };

      const onPointerUp = () => {
        state.isDraggingDial = false;
        state.lastAngle = null;
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      // Couplers Tap to Connect
      document.querySelectorAll('.coupler-snap-card').forEach((card) => {
        card.addEventListener('click', () => {
          const idx = Number(card.getAttribute('data-coupler'));
          if (state.couplers[idx]) return;
          state.couplers[idx] = true;
          card.classList.add('coupler-snapped');
          const vis = document.getElementById(`coupler-vis-${idx}`);
          const badge = document.getElementById(`coupler-badge-${idx}`);
          if (vis) {
            vis.innerHTML = `<span class="plug-snapped">🔌═══🔒═══🔌</span>`;
          }
          if (badge) {
            badge.textContent = 'SNAPPED ✅';
          }
          if (global.Sound) global.Sound.spark();
          checkAllHardwareComplete();
        });
      });

      const cancelBtn = document.getElementById('btn-cancel-minigame');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.closeActiveModal();
          if (onCancel) onCancel();
        });
      }

      this.activeCleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
    }
  };

  global.CustomerQueue = CustomerQueue;
  global.RepairMiniGames = RepairMiniGames;
})(window);
