/**
 * Jashan's Simulator (AM) - Aulakh Motors
 * Module: otp.js
 * Purpose: Morning Phase OTP Lock Mechanic
 *   - On-screen smartphone displays a 4-digit security OTP for 5.0 seconds, then hides.
 *   - Player enters the 4-digit code on the shutter digital keypad (3 attempts max).
 *   - Failing all 3 tries jams the shutter lock, calls an emergency locksmith (-Rs 1000 profit penalty),
 *     and forces the shutter open so the workday can proceed.
 */

(function (global) {
  'use strict';

  const OTPLock = {
    code: '',
    entered: '',
    triesRemaining: 3,
    maxTries: 3,
    phoneVisible: false,
    countdownRemaining: 5.0,
    timerId: null,
    resolved: false,
    onCompleteCallback: null,

    start(onComplete) {
      this.cleanup();
      this.onCompleteCallback = onComplete;
      this.code = String(Math.floor(1000 + Math.random() * 9000));
      this.entered = '';
      this.triesRemaining = 3;
      this.phoneVisible = true;
      this.countdownRemaining = 5.0;
      this.resolved = false;

      this.renderModal();
      if (global.Sound) global.Sound.beep();

      const startTime = performance.now();
      const duration = 5000; // 5 seconds exact

      const tick = (now) => {
        if (this.resolved) return;
        const elapsed = now - startTime;
        const left = Math.max(0, (duration - elapsed) / 1000);
        this.countdownRemaining = left;
        this.updatePhoneCountdownUI(left, duration - elapsed);

        if (elapsed < duration && this.phoneVisible) {
          this.timerId = requestAnimationFrame(tick);
        } else {
          this.hidePhoneCode();
        }
      };

      this.timerId = requestAnimationFrame(tick);
    },

    cleanup() {
      if (this.timerId) {
        cancelAnimationFrame(this.timerId);
        this.timerId = null;
      }
    },

    hidePhoneCode() {
      this.phoneVisible = false;
      const codeBox = document.getElementById('otp-phone-digits');
      const statusText = document.getElementById('otp-phone-status');
      const phoneCard = document.getElementById('otp-phone-device');
      if (codeBox) {
        codeBox.textContent = '• • • •';
        codeBox.classList.add('otp-hidden-code');
      }
      if (statusText) {
        statusText.textContent = '🔒 SMS Auto-Hidden (5s Expired) - Enter on Shutter Keypad';
      }
      if (phoneCard) {
        phoneCard.classList.add('phone-dimmed');
      }
    },

    peekPhoneAgain() {
      // Optional helper assist: Tanu can resend SMS once for 2 seconds if player forgot, costing 5 stamina
      if (this.resolved || this.phoneVisible) return;
      if (global.GameState.data.stamina < 8) {
        if (global.UI) global.UI.showFloatingToast('Too tired! Eat Tiffin first!', 'danger');
        return;
      }
      global.GameState.consumeStamina(8);
      this.phoneVisible = true;
      const codeBox = document.getElementById('otp-phone-digits');
      const statusText = document.getElementById('otp-phone-status');
      const phoneCard = document.getElementById('otp-phone-device');
      if (codeBox) {
        codeBox.textContent = this.code.split('').join(' ');
        codeBox.classList.remove('otp-hidden-code');
      }
      if (statusText) {
        statusText.textContent = '📲 Tanu re-checked SMS (2.5s)...';
      }
      if (phoneCard) {
        phoneCard.classList.remove('phone-dimmed');
      }
      if (global.Sound) global.Sound.beep();

      setTimeout(() => {
        if (!this.resolved) this.hidePhoneCode();
      }, 2500);
    },

    pressDigit(d) {
      if (this.resolved) return;
      if (this.entered.length >= 4) return;
      this.entered += String(d);
      if (global.Sound) global.Sound.click();
      this.updateKeypadScreen();

      if (this.entered.length === 4) {
        setTimeout(() => this.verifyCode(), 180);
      }
    },

    pressBackspace() {
      if (this.resolved) return;
      if (this.entered.length > 0) {
        this.entered = this.entered.slice(0, -1);
        if (global.Sound) global.Sound.click();
        this.updateKeypadScreen();
      }
    },

    pressClear() {
      if (this.resolved) return;
      this.entered = '';
      if (global.Sound) global.Sound.click();
      this.updateKeypadScreen();
    },

    verifyCode() {
      if (this.resolved) return;
      const screenEl = document.getElementById('otp-keypad-display');
      const feedbackEl = document.getElementById('otp-feedback-banner');

      if (this.entered === this.code) {
        this.resolved = true;
        this.cleanup();
        if (global.Sound) global.Sound.shutter();
        global.GameState.data.shutterUnlocked = true;
        global.GameState.data.stats.totalOtpSuccesses += 1;
        global.GameState.addCash(250, 'Timely Morning Opening Bonus');

        if (screenEl) {
          screenEl.textContent = 'OPEN';
          screenEl.className = 'otp-keypad-screen screen-success';
        }
        if (feedbackEl) {
          feedbackEl.innerHTML = '✅ <strong>SHUTTER UNLOCKED!</strong> Aulakh Motors is open for Day ' + global.GameState.data.currentDay + '!';
          feedbackEl.className = 'otp-feedback-banner banner-success';
        }

        if (global.Scene3D) global.Scene3D.setShutterOpen(true);

        setTimeout(() => {
          this.closeModal();
          if (this.onCompleteCallback) this.onCompleteCallback(true);
        }, 1100);
      } else {
        this.triesRemaining -= 1;
        if (global.Sound) global.Sound.error();

        if (screenEl) {
          screenEl.textContent = 'ERR!';
          screenEl.className = 'otp-keypad-screen screen-error';
        }

        const triesEl = document.getElementById('otp-tries-badge');
        if (triesEl) {
          triesEl.textContent = `Tries Left: ${this.triesRemaining} / ${this.maxTries}`;
        }

        if (this.triesRemaining <= 0) {
          // Lock Jammed!
          this.resolved = true;
          this.cleanup();
          global.GameState.data.shutterUnlocked = true;
          global.GameState.data.otpJammedToday = true;
          global.GameState.data.stats.totalOtpJams += 1;
          global.GameState.addCash(-1000, 'Shutter Lock Jammed - Emergency Locksmith Fee');

          if (feedbackEl) {
            feedbackEl.innerHTML = '🚨 <strong>LOCK JAMMED!</strong> 3 failed attempts! Emergency locksmith forced the shutter (-Rs 1,000 penalty).';
            feedbackEl.className = 'otp-feedback-banner banner-danger';
          }

          setTimeout(() => {
            this.closeModal();
            if (this.onCompleteCallback) this.onCompleteCallback(false);
          }, 1800);
        } else {
          if (feedbackEl) {
            feedbackEl.innerHTML = `❌ Wrong OTP! ${this.triesRemaining} attempt(s) remaining before lock jams!`;
            feedbackEl.className = 'otp-feedback-banner banner-warning';
          }
          setTimeout(() => {
            if (!this.resolved) {
              this.entered = '';
              this.updateKeypadScreen();
            }
          }, 600);
        }
      }
    },

    updatePhoneCountdownUI(secondsLeft, msLeft) {
      const timerBar = document.getElementById('otp-timer-bar-fill');
      const timerLabel = document.getElementById('otp-timer-seconds');
      if (timerBar) {
        const pct = Math.max(0, Math.min(100, (msLeft / 5000) * 100));
        timerBar.style.width = pct + '%';
        if (pct < 30) {
          timerBar.style.background = '#EF4444';
        } else if (pct < 60) {
          timerBar.style.background = '#F59E0B';
        } else {
          timerBar.style.background = '#10B981';
        }
      }
      if (timerLabel) {
        timerLabel.textContent = secondsLeft.toFixed(1) + 's';
      }
    },

    updateKeypadScreen() {
      const screenEl = document.getElementById('otp-keypad-display');
      if (!screenEl) return;
      screenEl.className = 'otp-keypad-screen';
      const padded = this.entered.padEnd(4, '_').split('').join(' ');
      screenEl.textContent = padded;
    },

    renderModal() {
      const container = document.getElementById('modal-layer');
      if (!container) return;

      container.innerHTML = `
        <div class="game-modal-backdrop" id="otp-modal">
          <div class="game-modal-card otp-modal-layout">
            <div class="modal-header-bar red-header">
              <div>
                <span class="phase-pill">🌅 MORNING PHASE • STEP 1/2</span>
                <h3>Aulakh Motors Smart Shutter OTP Lock</h3>
              </div>
              <div class="tries-pill" id="otp-tries-badge">Tries Left: ${this.triesRemaining} / ${this.maxTries}</div>
            </div>

            <p class="modal-instruction">
              Memorize the <strong>4-digit Dealership Security OTP</strong> on Jashan's phone before it auto-hides in <strong>5 seconds</strong>, then punch it into the shutter keypad!
            </p>

            <div class="otp-split-stage">
              <!-- On-Screen Smartphone -->
              <div class="otp-phone-mockup" id="otp-phone-device">
                <div class="phone-notch"></div>
                <div class="phone-screen">
                  <div class="phone-top-bar">
                    <span>📶 AM-5G</span>
                    <span>08:00 AM</span>
                    <span>🔋 98%</span>
                  </div>
                  <div class="phone-sms-card">
                    <div class="sms-sender">🐯 AULAKH SECURITY</div>
                    <div class="sms-label" id="otp-phone-status">⏱️ Hiding in <span id="otp-timer-seconds">5.0s</span></div>
                    <div class="otp-code-display" id="otp-phone-digits">${this.code.split('').join(' ')}</div>
                    <div class="otp-timer-track">
                      <div class="otp-timer-fill" id="otp-timer-bar-fill" style="width: 100%;"></div>
                    </div>
                  </div>
                  <button type="button" class="btn-secondary-sm" id="btn-otp-repeek">
                    📲 Ask Tanu to Re-check SMS (-8⚡)
                  </button>
                </div>
              </div>

              <!-- Shutter Keypad -->
              <div class="otp-shutter-panel">
                <div class="shutter-housing-title">STEEL SHUTTER KEYPAD</div>
                <div class="otp-keypad-screen" id="otp-keypad-display">_ _ _ _</div>
                <div class="otp-numpad-grid">
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
                    <button type="button" class="otp-key-btn" data-key="${n}">${n}</button>
                  `).join('')}
                  <button type="button" class="otp-key-btn key-util" id="otp-key-clear">CLR</button>
                  <button type="button" class="otp-key-btn" data-key="0">0</button>
                  <button type="button" class="otp-key-btn key-util" id="otp-key-back">⌫</button>
                </div>
              </div>
            </div>

            <div class="otp-feedback-banner" id="otp-feedback-banner">
              💡 Tip: Failing all 3 tries jams the shutter and deducts Rs 1,000 for an emergency locksmith!
            </div>
          </div>
        </div>
      `;

      container.querySelectorAll('.otp-key-btn[data-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.pressDigit(btn.getAttribute('data-key'));
        });
      });

      const clearBtn = document.getElementById('otp-key-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => this.pressClear());

      const backBtn = document.getElementById('otp-key-back');
      if (backBtn) backBtn.addEventListener('click', () => this.pressBackspace());

      const repeekBtn = document.getElementById('btn-otp-repeek');
      if (repeekBtn) repeekBtn.addEventListener('click', () => this.peekPhoneAgain());
    },

    closeModal() {
      this.cleanup();
      const container = document.getElementById('modal-layer');
      if (container) container.innerHTML = '';
    }
  };

  global.OTPLock = OTPLock;
})(window);
