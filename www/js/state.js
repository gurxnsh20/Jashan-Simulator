/**
 * Jashan's Simulator (AM) - Aulakh Motors
 * Module: state.js
 * Purpose: 90-Day Calendar Progression, Event Routing, LocalStorage Persistence,
 *          Stamina/Profit/Helpers State Management, and Web Audio Synthesizer.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'aulakh_motors_jashan_sim_v1';

  const DEFAULT_STATE = {
    currentDay: 1,
    unlockedMaxDay: 1,
    totalDays: 90,
    cash: 12500, // Starting dealership working capital in Rs
    todayProfit: 0,
    todayRevenue: 0,
    todayPenalties: 0,
    stamina: 100,
    maxStamina: 100,
    tiffinUsesToday: 0,
    maxTiffinUsesPerDay: 3,
    phase: 'HUB', // HUB | MORNING_OTP | MORNING_DISPLAY | DAYTIME | EVENING_PACKUP | BOSS_BIG_TRUCK | BOSS_SMALL_TRUCK | DAY_SUMMARY
    shutterUnlocked: false,
    otpJammedToday: false,
    scootersOutside: 0,
    totalScootersToDisplay: 10,
    customersServedToday: 0,
    customersTargetToday: 5,
    customersAngryToday: 0,
    soundEnabled: true,
    helpers: {
      jass: {
        name: 'Jass',
        role: 'Lead Floor & Crate Helper',
        level: 1,
        active: true,
        morale: 100,
        greenZoneBonus: 6, // Widens Big Truck green zone by % points per level
        scooterAssistSpeed: 1.0
      },
      tanu: {
        name: 'Tanu',
        role: 'Tech & Diagnostics Helper',
        level: 1,
        active: true,
        morale: 100,
        greenZoneBonus: 6, // Widens Big Truck green zone by % points per level
        patienceDecayReduction: 0.20 // Slows customer patience drain by 20%
      }
    },
    dayHistory: {}, // { [dayNumber]: { completed: true, profit: number, stars: 1..3, type: string } }
    stats: {
      totalScootersRepaired: 0,
      totalCratesUnloaded: 0,
      totalSmallTrucksLoaded: 0,
      totalOtpSuccesses: 0,
      totalOtpJams: 0,
      totalTiffinsEaten: 0
    }
  };

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type = 'sine', duration = 0.12, volume = 0.15, slideTo = null) {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
          osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Ignore audio errors before user gesture
      }
    }

    beep() {
      this.playTone(880, 'sine', 0.08, 0.12);
    }

    click() {
      this.playTone(520, 'triangle', 0.05, 0.1);
    }

    success() {
      this.playTone(523.25, 'triangle', 0.1, 0.15);
      setTimeout(() => this.playTone(659.25, 'triangle', 0.1, 0.15), 90);
      setTimeout(() => this.playTone(783.99, 'triangle', 0.18, 0.18), 180);
    }

    error() {
      this.playTone(220, 'sawtooth', 0.18, 0.18, 130);
      setTimeout(() => this.playTone(160, 'sawtooth', 0.25, 0.18, 95), 160);
    }

    spark() {
      this.playTone(1200, 'sawtooth', 0.06, 0.14, 300);
    }

    ratchet() {
      this.playTone(380, 'square', 0.035, 0.08, 620);
    }

    shutter() {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.playTone(140 + i * 25, 'sawtooth', 0.07, 0.1), i * 65);
      }
    }

    tiffin() {
      this.playTone(440, 'sine', 0.1, 0.15);
      setTimeout(() => this.playTone(554.37, 'sine', 0.1, 0.15), 110);
      setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.15), 220);
      setTimeout(() => this.playTone(880, 'sine', 0.25, 0.18), 340);
    }
  }

  const Sound = new SoundEngine();

  const GameState = {
    data: JSON.parse(JSON.stringify(DEFAULT_STATE)),
    listeners: [],

    init() {
      this.load();
      Sound.enabled = this.data.soundEnabled;
      this.notify();
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
          if (parsed.helpers) {
            this.data.helpers.jass = Object.assign({}, DEFAULT_STATE.helpers.jass, parsed.helpers.jass);
            this.data.helpers.tanu = Object.assign({}, DEFAULT_STATE.helpers.tanu, parsed.helpers.tanu);
          }
          if (parsed.stats) {
            this.data.stats = Object.assign({}, DEFAULT_STATE.stats, parsed.stats);
          }
          if (parsed.dayHistory) {
            this.data.dayHistory = Object.assign({}, parsed.dayHistory);
          }
        }
      } catch (e) {
        console.warn('LocalStorage unavailable, using in-memory state.');
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        // Fallback silently in sandboxed contexts
      }
      this.notify();
    },

    resetAll() {
      this.data = JSON.parse(JSON.stringify(DEFAULT_STATE));
      this.save();
    },

    subscribe(fn) {
      this.listeners.push(fn);
    },

    notify() {
      for (const fn of this.listeners) {
        try {
          fn(this.data);
        } catch (e) {
          console.error(e);
        }
      }
    },

    /**
     * Calendar Day Classification Logic (90-Day Cycle)
     * - Big Truck Days (Boss Event): Days 15, 45, 75
     * - Small Truck Days (Mini-Boss Event): Every 6th day (6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90)
     * - Normal Days: All other days
     */
    getDayType(dayNum) {
      const d = Number(dayNum);
      if (d === 15 || d === 45 || d === 75) {
        return 'BIG_TRUCK';
      }
      if (d % 6 === 0) {
        return 'SMALL_TRUCK';
      }
      return 'NORMAL';
    },

    getDayMetadata(dayNum) {
      const type = this.getDayType(dayNum);
      if (type === 'BIG_TRUCK') {
        return {
          day: dayNum,
          type: 'BIG_TRUCK',
          badge: 'BOSS EVENT',
          title: 'Big Truck Unloading Day',
          subtitle: 'Heavy 8-Crate Freight Consignment from Factory',
          color: '#DC2626',
          icon: '🚛',
          targetCustomers: 0
        };
      }
      if (type === 'SMALL_TRUCK') {
        return {
          day: dayNum,
          type: 'SMALL_TRUCK',
          badge: 'MINI-BOSS EVENT',
          title: 'Small Truck Loading Day',
          subtitle: 'Spatial 9-Scooter Dispatch (3 Top, 3 Bottom, 3 Half-In/Out)',
          color: '#D97706',
          icon: '🛻',
          targetCustomers: 0
        };
      }
      // Scale customer count slightly as days progress
      const targetCustomers = Math.min(8, 4 + Math.floor((dayNum - 1) / 18));
      return {
        day: dayNum,
        type: 'NORMAL',
        badge: 'DEALERSHIP OPS',
        title: `Aulakh Motors Day ${dayNum}`,
        subtitle: `Morning OTP & Display → ${targetCustomers} Customer Repairs → Evening Lockup`,
        color: '#059669',
        icon: '🛵',
        targetCustomers
      };
    },

    canPlayDay(dayNum) {
      return dayNum >= 1 && dayNum <= this.data.totalDays && dayNum <= this.data.unlockedMaxDay;
    },

    startDay(dayNum) {
      if (!this.canPlayDay(dayNum)) return false;
      const meta = this.getDayMetadata(dayNum);
      this.data.currentDay = dayNum;
      this.data.todayProfit = 0;
      this.data.todayRevenue = 0;
      this.data.todayPenalties = 0;
      this.data.stamina = this.data.maxStamina;
      this.data.tiffinUsesToday = 0;
      this.data.shutterUnlocked = false;
      this.data.otpJammedToday = false;
      this.data.scootersOutside = 0;
      this.data.customersServedToday = 0;
      this.data.customersAngryToday = 0;
      this.data.customersTargetToday = meta.targetCustomers;

      // Always start with Morning OTP Lock to open the Aulakh Motors shutter,
      // or route into morning OTP then the Day's primary phase!
      this.data.phase = 'MORNING_OTP';
      this.save();
      return true;
    },

    addCash(amount, reason = '') {
      const delta = Math.round(amount);
      this.data.cash += delta;
      this.data.todayProfit += delta;
      if (delta >= 0) {
        this.data.todayRevenue += delta;
      } else {
        this.data.todayPenalties += Math.abs(delta);
      }
      this.save();
      if (global.UI && typeof global.UI.showFloatingToast === 'function') {
        global.UI.showFloatingToast(
          `${delta >= 0 ? '+Rs ' + delta : '-Rs ' + Math.abs(delta)} ${reason ? '(' + reason + ')' : ''}`,
          delta >= 0 ? 'success' : 'danger'
        );
      }
    },

    consumeStamina(amount) {
      this.data.stamina = Math.max(0, Math.min(this.data.maxStamina, this.data.stamina - amount));
      this.save();
      return this.data.stamina;
    },

    eatTiffin() {
      if (this.data.stamina >= 100) {
        if (global.UI) global.UI.showFloatingToast("Jashan's energy is already at 100%!", 'info');
        return false;
      }
      this.data.stamina = 100;
      this.data.tiffinUsesToday += 1;
      this.data.stats.totalTiffinsEaten += 1;
      Sound.tiffin();
      this.save();
      if (global.UI) {
        global.UI.showFloatingToast('🍱 Home Tiffin eaten! Stamina restored to 100%!', 'success');
      }
      return true;
    },

    upgradeHelper(helperKey) {
      const h = this.data.helpers[helperKey];
      if (!h) return false;
      if (h.level >= 5) {
        if (global.UI) global.UI.showFloatingToast(`${h.name} is at Max Level (Lv.5)!`, 'info');
        return false;
      }
      const cost = h.level * 2500;
      if (this.data.cash < cost) {
        Sound.error();
        if (global.UI) global.UI.showFloatingToast(`Need Rs ${cost} to train ${h.name}!`, 'danger');
        return false;
      }
      this.data.cash -= cost;
      h.level += 1;
      h.greenZoneBonus = 4 + h.level * 2;
      if (helperKey === 'jass') {
        h.scooterAssistSpeed = 1 + (h.level - 1) * 0.25;
      } else if (helperKey === 'tanu') {
        h.patienceDecayReduction = Math.min(0.5, 0.15 + h.level * 0.06);
      }
      Sound.success();
      this.save();
      if (global.UI) {
        global.UI.showFloatingToast(`${h.name} promoted to Level ${h.level}!`, 'success');
      }
      return true;
    },

    completeCurrentDay() {
      const d = this.data.currentDay;
      const meta = this.getDayMetadata(d);
      let stars = 1;
      if (this.data.todayProfit >= 2500 && this.data.customersAngryToday === 0 && !this.data.otpJammedToday) {
        stars = 3;
      } else if (this.data.todayProfit >= 1000) {
        stars = 2;
      }

      this.data.dayHistory[d] = {
        completed: true,
        profit: this.data.todayProfit,
        revenue: this.data.todayRevenue,
        penalties: this.data.todayPenalties,
        stars,
        type: meta.type
      };

      if (d >= this.data.unlockedMaxDay && d < this.data.totalDays) {
        this.data.unlockedMaxDay = d + 1;
      }

      this.data.phase = 'DAY_SUMMARY';
      Sound.success();
      this.save();
    },

    toggleSound() {
      this.data.soundEnabled = !this.data.soundEnabled;
      Sound.enabled = this.data.soundEnabled;
      this.save();
      return this.data.soundEnabled;
    }
  };

  global.GameState = GameState;
  global.Sound = Sound;
})(window);
