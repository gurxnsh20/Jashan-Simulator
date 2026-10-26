/**
 * Jashan's Simulator (AM) - Aulakh Motors
 * Module: tetris.js
 * Purpose: Small Truck Loading Spatial/Tetris Puzzle (Mini-Boss Event: Every 6th Day - 6, 12, 18, 24, ..., 90)
 *   - Load exactly 9 electric scooters into a small utility truck grid.
 *   - The player must correctly orient, drag, and fit:
 *       * 3 scooters on the TOP RACK (Horizontal / Roof Carrier Orientation)
 *       * 3 scooters INSIDE THE BOTTOM BED (Upright Standard Orientation)
 *       * 3 scooters HALF-INSIDE / HALF-OUTSIDE on the Rear Tailgate Extension (Angled Tailgate Overhang Orientation)
 *   - Includes spatial grid collision/orientation validation, drag-and-drop + tap-to-place support,
 *     and rotation controls for each scooter unit before/during placement.
 */

(function (global) {
  'use strict';

  const ORIENTATIONS = {
    TOP_RACK: {
      id: 'TOP_RACK',
      label: 'Top Rack Clamp (Horizontal)',
      short: 'TOP RACK',
      icon: '🛵↔️',
      badgeColor: '#2563EB'
    },
    BOTTOM_BED: {
      id: 'BOTTOM_BED',
      label: 'Bottom Deck (Upright Locked)',
      short: 'BOTTOM BED',
      icon: '🛵⬆️',
      badgeColor: '#059669'
    },
    HALF_IN_OUT: {
      id: 'HALF_IN_OUT',
      label: 'Tailgate Half-In / Half-Out (45° Overhang)',
      short: 'HALF-IN/OUT',
      icon: '🛵↗️',
      badgeColor: '#D97706'
    }
  };

  const SmallTruckPuzzle = {
    scooters: [], // 9 scooter items
    slots: [], // 9 spatial truck grid slots: 3 Top Rack, 3 Inside Bottom, 3 Half-In/Half-Out
    selectedScooterId: null,
    draggedScooterId: null,
    mistakesCount: 0,
    startTime: 0,
    onCompleteCallback: null,

    start(onComplete) {
      this.onCompleteCallback = onComplete;
      this.mistakesCount = 0;
      this.selectedScooterId = null;
      this.draggedScooterId = null;
      this.startTime = Date.now();

      const models = [
        { name: 'AM Tiger Pro', color: '#EF4444' },
        { name: 'AM Volt S1', color: '#3B82F6' },
        { name: 'AM Cheetah X', color: '#10B981' },
        { name: 'AM Falcon Eco', color: '#F59E0B' },
        { name: 'AM Thunder GT', color: '#8B5CF6' },
        { name: 'AM Blitz Neo', color: '#EC4899' },
        { name: 'AM Spark Plus', color: '#14B8A6' },
        { name: 'AM Stallion EV', color: '#EA580C' },
        { name: 'AM Panther Z', color: '#6366F1' }
      ];

      // Initialize 9 scooters with cycled initial orientations so player must rotate/match or fit them
      const orientKeys = ['TOP_RACK', 'BOTTOM_BED', 'HALF_IN_OUT'];
      this.scooters = models.map((m, idx) => ({
        id: 'sc_' + (idx + 1),
        num: idx + 1,
        name: m.name,
        color: m.color,
        orientation: orientKeys[(idx + 1) % 3], // requires active checking/rotation or matching slot
        placedSlotId: null
      }));

      // Initialize the 9 spatial slots across the 3 truck zones
      this.slots = [
        // 3 Top Rack Slots
        { id: 'slot_top_1', zone: 'TOP_RACK', label: 'Top Rack Bay 1', index: 1, scooterId: null },
        { id: 'slot_top_2', zone: 'TOP_RACK', label: 'Top Rack Bay 2', index: 2, scooterId: null },
        { id: 'slot_top_3', zone: 'TOP_RACK', label: 'Top Rack Bay 3', index: 3, scooterId: null },
        // 3 Inside Bottom Bed Slots
        { id: 'slot_bot_1', zone: 'BOTTOM_BED', label: 'Inside Bottom Slot 1', index: 1, scooterId: null },
        { id: 'slot_bot_2', zone: 'BOTTOM_BED', label: 'Inside Bottom Slot 2', index: 2, scooterId: null },
        { id: 'slot_bot_3', zone: 'BOTTOM_BED', label: 'Inside Bottom Slot 3', index: 3, scooterId: null },
        // 3 Half-Inside / Half-Outside Tailgate Slots
        { id: 'slot_half_1', zone: 'HALF_IN_OUT', label: 'Half-In/Half-Out Tail 1', index: 1, scooterId: null },
        { id: 'slot_half_2', zone: 'HALF_IN_OUT', label: 'Half-In/Half-Out Tail 2', index: 2, scooterId: null },
        { id: 'slot_half_3', zone: 'HALF_IN_OUT', label: 'Half-In/Half-Out Tail 3', index: 3, scooterId: null }
      ];

      // Select first unplaced scooter by default
      this.selectedScooterId = this.scooters[0].id;
      if (global.Scene3D) {
        global.Scene3D.setCameraPreset('SMALL_TRUCK');
        global.Scene3D.syncSmallTruck3DSlots(this.slots, this.scooters);
      }
      this.renderModal();
    },

    rotateScooter(scooterId, e) {
      if (e) e.stopPropagation();
      const sc = this.scooters.find((s) => s.id === scooterId);
      if (!sc || sc.placedSlotId) return;
      const order = ['TOP_RACK', 'BOTTOM_BED', 'HALF_IN_OUT'];
      const nextIdx = (order.indexOf(sc.orientation) + 1) % order.length;
      sc.orientation = order[nextIdx];
      this.selectedScooterId = scooterId;
      if (global.Sound) global.Sound.ratchet();
      this.updateUI();
    },

    setScooterOrientation(scooterId, orientKey) {
      const sc = this.scooters.find((s) => s.id === scooterId);
      if (!sc || sc.placedSlotId) return;
      sc.orientation = orientKey;
      this.selectedScooterId = scooterId;
      if (global.Sound) global.Sound.click();
      this.updateUI();
    },

    attemptPlaceScooter(scooterId, slotId) {
      const sc = this.scooters.find((s) => s.id === scooterId);
      const slot = this.slots.find((sl) => sl.id === slotId);
      if (!sc || !slot) return;

      if (slot.scooterId) {
        this.setFeedback('⚠️ That truck bay is already occupied! Tap an occupied slot to unload it first.', 'warn');
        if (global.Sound) global.Sound.error();
        return;
      }

      // Check spatial orientation match!
      // A scooter must be rotated to match the spatial stance of the zone (Top Rack vs Bottom Inside vs Half-In/Half-Out)
      if (sc.orientation !== slot.zone) {
        this.mistakesCount += 1;
        const requiredMeta = ORIENTATIONS[slot.zone];
        const currentMeta = ORIENTATIONS[sc.orientation];
        global.GameState.addCash(-150, 'Truck Spatial Mismatch Scrape');
        if (global.Sound) global.Sound.error();
        this.setFeedback(
          `❌ Spatial Mismatch! <strong>${sc.name}</strong> is in <em>${currentMeta.short}</em> stance, but this bay requires <strong>${requiredMeta.short}</strong>! Rotate it first (-Rs 150).`,
          'danger'
        );
        return;
      }

      // Valid spatial fit!
      sc.placedSlotId = slot.id;
      slot.scooterId = sc.id;
      if (global.Sound) global.Sound.success();
      global.GameState.consumeStamina(4);

      const zoneCount = this.slots.filter((s) => s.zone === slot.zone && s.scooterId).length;
      this.setFeedback(
        `✅ Locked <strong>${sc.name}</strong> into <strong>${slot.label}</strong> (${zoneCount}/3 in ${ORIENTATIONS[slot.zone].short})!`,
        'success'
      );

      // Auto-select next unplaced scooter
      const nextUnplaced = this.scooters.find((s) => !s.placedSlotId);
      this.selectedScooterId = nextUnplaced ? nextUnplaced.id : null;
      this.updateUI();

      // Check if all 9 scooters are loaded
      const totalLoaded = this.slots.filter((s) => s.scooterId !== null).length;
      if (totalLoaded === 9) {
        setTimeout(() => this.completePuzzle(), 700);
      }
    },

    removeScooterFromSlot(slotId) {
      const slot = this.slots.find((sl) => sl.id === slotId);
      if (!slot || !slot.scooterId) return;
      const sc = this.scooters.find((s) => s.id === slot.scooterId);
      if (sc) sc.placedSlotId = null;
      slot.scooterId = null;
      if (sc) this.selectedScooterId = sc.id;
      if (global.Sound) global.Sound.click();
      this.setFeedback(`🔄 Removed ${sc ? sc.name : 'scooter'} back to staging yard.`, 'info');
      this.updateUI();
    },

    jassAutoOrientHelper() {
      // Helper button: Jass aligns the selected scooter's stance to match the next open bay!
      const sc = this.scooters.find((s) => s.id === this.selectedScooterId && !s.placedSlotId);
      if (!sc) return;
      const openSlot = this.slots.find((sl) => !sl.scooterId);
      if (!openSlot) return;
      sc.orientation = openSlot.zone;
      if (global.Sound) global.Sound.ratchet();
      this.setFeedback(`👷 Jass tilted <strong>${sc.name}</strong> to fit <strong>${openSlot.label}</strong>! Now tap or drag it into the highlighted bay.`, 'info');
      this.updateUI();
    },

    setFeedback(html, level) {
      const fb = document.getElementById('tetris-feedback-bar');
      if (fb) {
        fb.innerHTML = html;
        fb.className = `tetris-feedback-bar fb-${level}`;
      }
    },

    completePuzzle() {
      const bonus = Math.max(1500, 3600 - this.mistakesCount * 200);
      global.GameState.addCash(bonus, 'Small Truck 9-Scooter Dispatch Bonus');
      global.GameState.data.stats.totalSmallTrucksLoaded += 1;

      const container = document.getElementById('modal-layer');
      if (container) {
        container.innerHTML = `
          <div class="game-modal-backdrop">
            <div class="game-modal-card">
              <div class="modal-header-bar amber-header">
                <h3>🛻 Small Truck Fully Loaded (9/9 Scooters)!</h3>
                <span class="phase-pill">Day ${global.GameState.data.currentDay} Mini-Boss Complete</span>
              </div>
              <div class="boss-summary-stats">
                <div class="stat-box perfect-box">
                  <span class="stat-val">3 / 3</span>
                  <span class="stat-lbl">Top Rack Scooters</span>
                </div>
                <div class="stat-box perfect-box">
                  <span class="stat-val">3 / 3</span>
                  <span class="stat-lbl">Inside Bottom Bed</span>
                </div>
                <div class="stat-box perfect-box">
                  <span class="stat-val">3 / 3</span>
                  <span class="stat-lbl">Half-In / Half-Out</span>
                </div>
              </div>
              <div class="net-profit-callout pos">
                Dispatch Payout: <strong>+Rs ${bonus}</strong> (${this.mistakesCount} spatial scrapes)
              </div>
              <button type="button" class="btn-primary-lg" id="btn-finish-small-truck">
                Complete Day ${global.GameState.data.currentDay} & Save Progress →
              </button>
            </div>
          </div>
        `;
        const btn = document.getElementById('btn-finish-small-truck');
        if (btn) {
          btn.addEventListener('click', () => {
            container.innerHTML = '';
            if (this.onCompleteCallback) this.onCompleteCallback();
          });
        }
      }
    },

    updateUI() {
      const topLoaded = this.slots.filter((s) => s.zone === 'TOP_RACK' && s.scooterId).length;
      const botLoaded = this.slots.filter((s) => s.zone === 'BOTTOM_BED' && s.scooterId).length;
      const halfLoaded = this.slots.filter((s) => s.zone === 'HALF_IN_OUT' && s.scooterId).length;
      const totalLoaded = topLoaded + botLoaded + halfLoaded;

      const counterEl = document.getElementById('tetris-loaded-counter');
      if (counterEl) counterEl.textContent = `Loaded: ${totalLoaded} / 9 Scooters`;

      const renderZoneSlots = (zoneKey) => {
        return this.slots
          .filter((sl) => sl.zone === zoneKey)
          .map((sl) => {
            const sc = sl.scooterId ? this.scooters.find((x) => x.id === sl.scooterId) : null;
            const selectedSc = this.scooters.find((x) => x.id === this.selectedScooterId && !x.placedSlotId);
            const isCompatibleHighlight = !sc && selectedSc && selectedSc.orientation === sl.zone;
            return `
              <div class="truck-grid-slot ${sc ? 'slot-filled' : 'slot-empty'} ${isCompatibleHighlight ? 'slot-ready-glow' : ''}"
                   data-slot-id="${sl.id}">
                <div class="slot-header-tag">${sl.label}</div>
                ${sc ? `
                  <div class="placed-scooter-token orient-${sc.orientation.toLowerCase()}" style="border-color: ${sc.color};">
                    <span class="sc-token-icon">${ORIENTATIONS[sc.orientation].icon}</span>
                    <span class="sc-token-name">${sc.name}</span>
                    <span class="sc-undo-hint">Tap to Remove</span>
                  </div>
                ` : `
                  <div class="slot-placeholder">
                    <span>${ORIENTATIONS[sl.zone].icon}</span>
                    <small>Fit ${ORIENTATIONS[sl.zone].short}</small>
                  </div>
                `}
              </div>
            `;
          })
          .join('');
      };

      const topContainer = document.getElementById('truck-zone-top');
      const botContainer = document.getElementById('truck-zone-bottom');
      const halfContainer = document.getElementById('truck-zone-half');

      if (topContainer) topContainer.innerHTML = renderZoneSlots('TOP_RACK');
      if (botContainer) botContainer.innerHTML = renderZoneSlots('BOTTOM_BED');
      if (halfContainer) halfContainer.innerHTML = renderZoneSlots('HALF_IN_OUT');

      // Render Unplaced Scooters Pool
      const poolEl = document.getElementById('tetris-scooter-pool');
      if (poolEl) {
        const unplaced = this.scooters.filter((s) => !s.placedSlotId);
        if (unplaced.length === 0) {
          poolEl.innerHTML = `<div class="all-loaded-msg">🎉 All 9 Scooters Fitted into the Small Truck!</div>`;
        } else {
          poolEl.innerHTML = unplaced
            .map((sc) => {
              const isSel = sc.id === this.selectedScooterId;
              const oMeta = ORIENTATIONS[sc.orientation];
              return `
                <div class="scooter-pool-card ${isSel ? 'selected-scooter-card' : ''}"
                     draggable="true"
                     data-scooter-id="${sc.id}">
                  <div class="sc-card-top">
                    <span class="sc-num-badge" style="background:${sc.color};">#${sc.num}</span>
                    <strong class="sc-model-title">${sc.name}</strong>
                  </div>
                  <div class="sc-stance-pill" style="background:${oMeta.badgeColor}22; color:${oMeta.badgeColor}; border:1px solid ${oMeta.badgeColor};">
                    ${oMeta.icon} ${oMeta.short}
                  </div>
                  <button type="button" class="btn-rotate-sc" data-rotate-id="${sc.id}">
                    🔄 Rotate Stance
                  </button>
                </div>
              `;
            })
            .join('');
        }
      }

      if (global.Scene3D) {
        global.Scene3D.syncSmallTruck3DSlots(this.slots, this.scooters);
      }
      this.bindSlotAndPoolEvents();
    },

    bindSlotAndPoolEvents() {
      // Pool card selection, dragstart, and rotate button
      document.querySelectorAll('.scooter-pool-card').forEach((card) => {
        const scId = card.getAttribute('data-scooter-id');
        card.addEventListener('click', () => {
          this.selectedScooterId = scId;
          if (global.Sound) global.Sound.click();
          this.updateUI();
        });
        card.addEventListener('dragstart', (e) => {
          this.draggedScooterId = scId;
          this.selectedScooterId = scId;
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', scId);
          }
        });
      });

      document.querySelectorAll('.btn-rotate-sc').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const scId = btn.getAttribute('data-rotate-id');
          this.rotateScooter(scId, e);
        });
      });

      // Truck slot click (place selected or remove existing) & drag/drop
      document.querySelectorAll('.truck-grid-slot').forEach((slotEl) => {
        const slotId = slotEl.getAttribute('data-slot-id');

        slotEl.addEventListener('click', () => {
          const slotObj = this.slots.find((s) => s.id === slotId);
          if (!slotObj) return;
          if (slotObj.scooterId) {
            this.removeScooterFromSlot(slotId);
          } else if (this.selectedScooterId) {
            this.attemptPlaceScooter(this.selectedScooterId, slotId);
          }
        });

        slotEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          slotEl.classList.add('slot-dragover');
        });

        slotEl.addEventListener('dragleave', () => {
          slotEl.classList.remove('slot-dragover');
        });

        slotEl.addEventListener('drop', (e) => {
          e.preventDefault();
          slotEl.classList.remove('slot-dragover');
          const droppedId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this.draggedScooterId || this.selectedScooterId;
          if (droppedId) {
            this.attemptPlaceScooter(droppedId, slotId);
          }
        });
      });
    },

    renderModal() {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      container.innerHTML = `
        <div class="game-modal-backdrop boss-3d-peek-backdrop" id="small-truck-modal">
          <div class="game-modal-card tetris-modal-layout">
            <div class="modal-header-bar amber-header">
              <div>
                <span class="phase-pill">🛻 MINI-BOSS EVENT • DAY ${global.GameState.data.currentDay}</span>
                <h3>Small Truck 9-Scooter Spatial Loading</h3>
              </div>
              <div class="tries-pill" id="tetris-loaded-counter">Loaded: 0 / 9 Scooters</div>
            </div>

            <div class="tetris-instructions-row">
              <span><strong>Goal:</strong> Fit <strong>3 scooters on Top Rack</strong>, <strong>3 Inside Bottom</strong>, and <strong>3 Half-In/Half-Out</strong> on the rear tailgate! Rotate each scooter to match the bay stance, then drag or tap to load.</span>
              <button type="button" class="btn-secondary-sm" id="btn-jass-orient">👷 Ask Jass to Align Stance</button>
            </div>

            <!-- Cross-Section Spatial Diagram of the Small Carrier Truck -->
            <div class="small-truck-blueprint">
              <div class="truck-cab-front">
                <div class="cab-window">🪟</div>
                <div class="cab-label">AULAKH<br/>CARRIER</div>
                <div class="truck-wheel front-wheel">🛞</div>
              </div>

              <div class="truck-cargo-body">
                <!-- Zone 1: Top Rack (3 Scooters) -->
                <div class="truck-zone-section zone-top-rack">
                  <div class="zone-title-banner">
                    <span>1️⃣ TOP RACK CARRIER (3 Scooters • Horizontal Clamp)</span>
                  </div>
                  <div class="truck-slots-row" id="truck-zone-top"></div>
                </div>

                <!-- Zone 2 & 3: Inside Bottom (3) + Rear Half-In / Half-Out Overhang (3) -->
                <div class="truck-lower-deck-split">
                  <div class="truck-zone-section zone-bottom-bed">
                    <div class="zone-title-banner">
                      <span>2️⃣ INSIDE BOTTOM BED (3 Scooters • Upright)</span>
                    </div>
                    <div class="truck-slots-row" id="truck-zone-bottom"></div>
                  </div>

                  <div class="truck-zone-section zone-half-tailgate">
                    <div class="zone-title-banner">
                      <span>3️⃣ HALF-IN / HALF-OUT TAILGATE (3 Scooters • 45° Overhang)</span>
                    </div>
                    <div class="truck-slots-row" id="truck-zone-half"></div>
                  </div>
                </div>

                <div class="truck-wheels-rear">
                  <div class="truck-wheel">🛞</div>
                  <div class="truck-wheel">🛞</div>
                </div>
              </div>
            </div>

            <div class="tetris-feedback-bar fb-info" id="tetris-feedback-bar">
              💡 Select a scooter below, click <strong>Rotate Stance</strong> so its stance badge matches the target zone, then drag or tap the bay!
            </div>

            <!-- Staging Yard: 9 Scooters -->
            <div class="scooter-pool-grid" id="tetris-scooter-pool"></div>
          </div>
        </div>
      `;

      const jassBtn = document.getElementById('btn-jass-orient');
      if (jassBtn) {
        jassBtn.addEventListener('click', () => this.jassAutoOrientHelper());
      }

      this.updateUI();
    }
  };

  global.SmallTruckPuzzle = SmallTruckPuzzle;
})(window);
