/**
 * Jashan's Simulator (AM) - Aulakh Motors 3D Engine
 * Module: joystick.js
 * Purpose:
 *   - On-Screen Virtual Joystick (Left Side of 3D Viewport) to walk/run Jashan freely
 *     and physically push/drive grabbed 3D electric scooters around the dealership.
 *   - Right-Side Camera Rotation Touch/Drag Zone for Third-Person Camera yaw/pitch control.
 *   - Dynamic Context-Sensitive On-Screen "INTERACT" Button that appears whenever Jashan
 *     approaches interactive 3D objects (Shutter OTP Lock, 10 Display Scooters, Drop-off Zones,
 *     Waiting 3D Customers on Brown Chairs, Tiffin Box, Big Truck, Small Truck & 9 Staging Scooters).
 *   - Full WASD / Arrow Keys + E / Enter keyboard support alongside mobile touch controls.
 */

(function (global) {
  'use strict';

  const VirtualJoystick = {
    // Normalized movement vector (-1..1)
    moveX: 0,
    moveY: 0,
    magnitude: 0,
    isTouchingJoystick: false,
    joystickPointerId: null,
    joyOrigin: { x: 0, y: 0 },
    maxRadius: 44,

    // Right-side camera look state
    isTouchingLook: false,
    lookPointerId: null,
    lastLookPos: { x: 0, y: 0 },
    camYawDelta: 0,
    camPitchDelta: 0,

    // Keyboard state fallback
    keys: {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      ArrowUp: false,
      ArrowLeft: false,
      ArrowDown: false,
      ArrowRight: false
    },

    // Current nearest interactable target detected by Scene3D
    currentInteractTarget: null,

    init() {
      this.bindJoystickDOM();
      this.bindCameraLookZoneDOM();
      this.bindInteractButtonDOM();
      this.bindKeyboardFallback();
    },

    bindJoystickDOM() {
      const zone = document.getElementById('virtual-joystick-zone');
      const base = document.getElementById('virtual-joystick-base');
      const knob = document.getElementById('virtual-joystick-knob');
      if (!zone || !base || !knob) return;

      const updateKnob = (clientX, clientY) => {
        const dx = clientX - this.joyOrigin.x;
        const dy = clientY - this.joyOrigin.y;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, this.maxRadius);
        const angle = Math.atan2(dy, dx);

        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(calc(-50% + ${kx.toFixed(1)}px), calc(-50% + ${ky.toFixed(1)}px))`;

        this.moveX = kx / this.maxRadius;
        this.moveY = ky / this.maxRadius;
        this.magnitude = clampedDist / this.maxRadius;
      };

      const resetKnob = () => {
        this.isTouchingJoystick = false;
        this.joystickPointerId = null;
        this.moveX = 0;
        this.moveY = 0;
        this.magnitude = 0;
        knob.style.transform = 'translate(-50%, -50%)';
        base.classList.remove('joystick-active');
      };

      zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchingJoystick = true;
        this.joystickPointerId = e.pointerId;
        const rect = base.getBoundingClientRect();
        this.joyOrigin = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        base.classList.add('joystick-active');
        updateKnob(e.clientX, e.clientY);
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.isTouchingJoystick || e.pointerId !== this.joystickPointerId) return;
        updateKnob(e.clientX, e.clientY);
      });

      window.addEventListener('pointerup', (e) => {
        if (this.isTouchingJoystick && e.pointerId === this.joystickPointerId) {
          resetKnob();
        }
      });

      window.addEventListener('pointercancel', (e) => {
        if (this.isTouchingJoystick && e.pointerId === this.joystickPointerId) {
          resetKnob();
        }
      });
    },

    bindCameraLookZoneDOM() {
      const lookZone = document.getElementById('camera-look-zone');
      if (!lookZone) return;

      lookZone.addEventListener('pointerdown', (e) => {
        // Ignore if clicking interact button or floating customer badge
        if (e.target.closest && (e.target.closest('#btn-3d-interact') || e.target.closest('.floating-3d-cust-badge'))) {
          return;
        }
        this.isTouchingLook = true;
        this.lookPointerId = e.pointerId;
        this.lastLookPos = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.isTouchingLook || e.pointerId !== this.lookPointerId) return;
        const dx = e.clientX - this.lastLookPos.x;
        const dy = e.clientY - this.lastLookPos.y;
        this.lastLookPos = { x: e.clientX, y: e.clientY };

        if (global.Scene3D) {
          global.Scene3D.rotateThirdPersonCamera(-dx * 0.0065, dy * 0.0045);
        }
      });

      const stopLook = (e) => {
        if (this.isTouchingLook && e.pointerId === this.lookPointerId) {
          this.isTouchingLook = false;
          this.lookPointerId = null;
        }
      };

      window.addEventListener('pointerup', stopLook);
      window.addEventListener('pointercancel', stopLook);
    },

    bindInteractButtonDOM() {
      const btn = document.getElementById('btn-3d-interact');
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerContextInteraction();
      });
    },

    bindKeyboardFallback() {
      window.addEventListener('keydown', (e) => {
        // Don't hijack keys when a modal is open (except Space in Big Truck which slider.js handles)
        const modalContainer = document.getElementById('modal-layer');
        const modalOpen = modalContainer && modalContainer.children.length > 0;
        if (modalOpen) return;

        if (Object.prototype.hasOwnProperty.call(this.keys, e.code)) {
          this.keys[e.code] = true;
        } else if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') {
          e.preventDefault();
          this.triggerContextInteraction();
        }
      });

      window.addEventListener('keyup', (e) => {
        if (Object.prototype.hasOwnProperty.call(this.keys, e.code)) {
          this.keys[e.code] = false;
        }
      });
    },

    getInputVector() {
      if (this.isTouchingJoystick && this.magnitude > 0.04) {
        return { x: this.moveX, y: this.moveY, mag: this.magnitude };
      }

      let kx = 0;
      let ky = 0;
      if (this.keys.KeyW || this.keys.ArrowUp) ky -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) ky += 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) kx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) kx += 1;

      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        return { x: kx / len, y: ky / len, mag: 1.0 };
      }

      return { x: 0, y: 0, mag: 0 };
    },

    updateInteractPrompt(targetInfo) {
      this.currentInteractTarget = targetInfo;
      const btn = document.getElementById('btn-3d-interact');
      const labelEl = document.getElementById('interact-btn-label');
      const subEl = document.getElementById('interact-btn-sub');
      const iconEl = document.getElementById('interact-btn-icon');
      if (!btn) return;

      if (!targetInfo) {
        btn.classList.add('interact-hidden');
        btn.classList.remove('interact-pulse-ready');
        return;
      }

      btn.classList.remove('interact-hidden');
      btn.classList.add('interact-pulse-ready');
      if (iconEl) iconEl.textContent = targetInfo.icon || '✋';
      if (labelEl) labelEl.textContent = targetInfo.label || 'INTERACT';
      if (subEl) subEl.textContent = targetInfo.sublabel || 'Tap or Press [E]';
    },

    triggerContextInteraction() {
      if (!this.currentInteractTarget) {
        if (global.UI) {
          global.UI.showFloatingToast('🕹️ Walk Jashan closer to a Scooter, Shutter Lock, Customer, Tiffin, or Truck to interact!', 'info');
        }
        return;
      }
      if (global.Scene3D) {
        global.Scene3D.executeInteraction(this.currentInteractTarget);
      }
    }
  };

  global.VirtualJoystick = VirtualJoystick;
})(window);
