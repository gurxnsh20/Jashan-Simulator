/**
 * Jashan's Simulator (AM) - Aulakh Motors 3D Engine & Third-Person Controller
 * Module: scene.js (Three.js r128)
 * Purpose:
 *   - Third-Person Walkable 3D Dealership Environment controlled via VirtualJoystick (left screen)
 *     and Right-Screen Camera Rotation (yaw/pitch) + Camera Presets.
 *   - Physical 3D Scooter Grabbing & Pushing:
 *       * Morning Display Setup: Jashan walks up to each of the 10 3D scooters inside the showroom,
 *         taps INTERACT to grab the handlebars, physically drives/pushes the scooter outside using
 *         the joystick, and parks it in the Outside Display Yard!
 *       * Evening Phase: Jashan walks outside, grabs each 3D scooter, drives/pushes it back inside
 *         the showroom, and locks the 3D steel shutter!
 *       * Small Truck Loading (Every 6th Day): Jashan can physically grab any of the 9 staging scooters
 *         in the 3D yard, walk up to the 3D Small Truck, and load them into the 3 Top Rack bays,
 *         3 Inside Bottom bays, or 3 Half-Inside/Half-Outside tailgate bays (or open the 2D/3D spatial loader).
 *   - Proximity Interaction System:
 *       * Automatically detects when Jashan approaches the Shutter OTP Keypad, 10 Display Scooters,
 *         Drop-off Zones, 4 Seated 3D Customers on Brown Chairs, 3D Tiffin Box on Counter,
 *         3D Big Freight Truck (Days 15, 45, 75), or 3D Small Carrier Truck (Days 6, 12, 18...).
 */

(function (global) {
  'use strict';

  const SCOOTER_PALETTE = [
    0xEF4444, 0x3B82F6, 0x10B981, 0xF59E0B, 0x8B5CF6,
    0xEC4899, 0x14B8A6, 0xEA580C, 0x6366F1, 0xE2E8F0
  ];

  const Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    raycaster: null,
    pointer: null,
    container: null,
    clock: null,

    // Camera Mode: 'THIRD_PERSON' (default follow cam) | 'OVERVIEW' | 'INTERIOR' | 'EXTERIOR' | 'BIG_TRUCK' | 'SMALL_TRUCK'
    cameraMode: 'THIRD_PERSON',
    tpCamYaw: 0, // Third-person camera horizontal angle around Jashan (radians)
    tpCamPitch: 0.48, // Third-person camera vertical elevation angle
    tpCamDistance: 8.5,
    camTargetPos: { x: 0, y: 12.5, z: 22.5 },
    camLookAt: { x: 0, y: 1.8, z: 1.5 },
    currentLookAt: { x: 0, y: 1.8, z: 1.5 },
    orbitYaw: 0,

    // Jashan Third-Person Player Physics & Grab State
    playerPos: { x: -4.2, y: 0, z: -5.2 },
    playerRotY: 0,
    playerWalkCycle: 0,
    playerSpeed: 6.8,
    grabbedScooterNum: null, // 1..10 when pushing a showroom scooter
    grabbedSmallTruckScooterId: null, // 'sc_1'..'sc_9' when pushing a Small Truck puzzle scooter in 3D

    // 3D Scene Objects
    fans: [],
    shutterMesh: null,
    shutterKeypadMesh: null,
    shutterTargetY: 2.2,
    tiffinMesh: null,
    dropZoneOutsideMesh: null,
    dropZoneInsideMesh: null,
    interactRingMesh: null,

    characters: {
      jashan: null,
      jass: null,
      tanu: null
    },
    scooters3D: {}, // { [1..10]: { num, group, location, targetPos, targetRotY } }
    chairs3D: [], // 4 brown plastic chairs
    customers3D: [null, null, null, null], // 4 customer 3D humanoids
    bigTruckGroup: null,
    bigTruckCrates: [],
    smallTruckGroup: null,
    smallTruckBayMeshes: {},
    smallTruckStagingScooters3D: {}, // { ['sc_1'..'sc_9']: group }

    interactiveMeshes: [],

    init(containerId = 'three-canvas-container') {
      this.container = document.getElementById(containerId);
      if (!this.container || typeof global.THREE === 'undefined') {
        console.warn('Three.js or container not found.');
        return;
      }

      const THREE = global.THREE;
      this.clock = new THREE.Clock();
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0F172A);
      this.scene.fog = new THREE.FogExp2(0x0F172A, 0.012);

      const w = window.innerWidth || this.container.clientWidth || 420;
      const h = window.innerHeight || this.container.clientHeight || 800;

      this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 200);
      this.camera.position.set(-4.2, 5.5, 2.5);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const oldCanvas = this.container.querySelector('canvas');
      if (oldCanvas) oldCanvas.remove();
      this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();

      this.setupLights();
      this.buildDealershipArchitecture();
      this.buildRedSignboardWithTigerLogo();
      this.buildInteriorPropsAndFans();
      this.buildGreenDoormatAndShutter();
      this.buildDropOffZones3D();
      this.buildBrownWaitingChairs();
      this.buildMainCharacters();
      this.buildTenDisplayScooters();
      this.buildBigTruckBossProp();
      this.buildSmallTruckPuzzleProp();
      this.buildProximityRingIndicator();

      this.bindCanvasEvents();
      if (global.VirtualJoystick) {
        global.VirtualJoystick.init();
      }
      this.animate();
    },

    setupLights() {
      const THREE = global.THREE;
      const hemiLight = new THREE.HemisphereLight(0xFFFBEB, 0x334155, 0.88);
      hemiLight.position.set(0, 25, 0);
      this.scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.95);
      dirLight.position.set(14, 24, 18);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 65;
      const d = 19;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      this.scene.add(dirLight);

      const showroomLight = new THREE.PointLight(0xFDE68A, 0.8, 24);
      showroomLight.position.set(0, 4.5, -4);
      this.scene.add(showroomLight);
    },

    createSignboardTexture() {
      const THREE = global.THREE;
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#DC2626');
      grad.addColorStop(0.6, '#991B1B');
      grad.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 256);

      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, 1008, 240);

      ctx.save();
      ctx.beginPath();
      ctx.arc(135, 128, 86, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      ctx.font = 'bold 105px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐯', 135, 134);
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#450A0A';
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      ctx.font = '900 78px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('AULAKH MOTORS', 255, 118);

      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('ELECTRIC SCOOTER DEALERSHIP & EV SERVICE HUB', 258, 178);

      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = '#FEF3C7';
      ctx.fillText('⚡ 72V LFP', 258, 224);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    },

    createDoormatTexture() {
      const THREE = global.THREE;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#15803D';
      ctx.fillRect(0, 0, 512, 256);

      ctx.strokeStyle = '#86EFAC';
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 10, 492, 236);

      ctx.fillStyle = '#ECFDF5';
      ctx.font = '900 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WELCOME', 256, 110);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#BBF7D0';
      ctx.fillText('AULAKH MOTORS', 256, 168);

      return new THREE.CanvasTexture(canvas);
    },

    createPosterTexture(title, subtitle, bgHex, accentHex) {
      const THREE = global.THREE;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 340;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 256, 340);
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, 244, 328);

      ctx.fillStyle = accentHex;
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛵', 128, 115);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 28px sans-serif';
      ctx.fillText(title, 128, 200);

      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(subtitle, 128, 245);

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('AULAKH EV CERTIFIED', 128, 295);

      return new THREE.CanvasTexture(canvas);
    },

    buildDealershipArchitecture() {
      const THREE = global.THREE;

      const roadGeo = new THREE.PlaneGeometry(52, 42);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -0.05, 4);
      road.receiveShadow = true;
      this.scene.add(road);

      const inFloorGeo = new THREE.BoxGeometry(22, 0.16, 10);
      const inFloorMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.35, metalness: 0.1 });
      const inFloor = new THREE.Mesh(inFloorGeo, inFloorMat);
      inFloor.position.set(0, 0, -5);
      inFloor.receiveShadow = true;
      this.scene.add(inFloor);

      const outFloorGeo = new THREE.BoxGeometry(22, 0.12, 9);
      const outFloorMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.75 });
      const outFloor = new THREE.Mesh(outFloorGeo, outFloorMat);
      outFloor.position.set(0, -0.02, 4.5);
      outFloor.receiveShadow = true;
      this.scene.add(outFloor);

      const wallMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.6 });
      const redAccentMat = new THREE.MeshStandardMaterial({ color: 0xB91C1C, roughness: 0.4 });

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(22, 5.2, 0.4), wallMat);
      backWall.position.set(0, 2.6, -10);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      this.scene.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 10), wallMat);
      leftWall.position.set(-11, 2.6, -5);
      leftWall.castShadow = true;
      this.scene.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 10), wallMat);
      rightWall.position.set(11, 2.6, -5);
      rightWall.castShadow = true;
      this.scene.add(rightWall);

      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.2, 0.5), redAccentMat);
      leftPillar.position.set(-10.3, 2.6, 0);
      this.scene.add(leftPillar);

      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.2, 0.5), redAccentMat);
      rightPillar.position.set(10.3, 2.6, 0);
      this.scene.add(rightPillar);

      const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(22.4, 1.1, 0.7), redAccentMat);
      headerBeam.position.set(0, 4.8, 0);
      this.scene.add(headerBeam);
    },

    buildRedSignboardWithTigerLogo() {
      const THREE = global.THREE;
      const signTex = this.createSignboardTexture();

      const boardGeo = new THREE.BoxGeometry(15.5, 3.1, 0.55);
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x7F1D1D, metalness: 0.3, roughness: 0.4 });
      const frontMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.25 });

      const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
      const signboard = new THREE.Mesh(boardGeo, materials);
      signboard.position.set(0, 6.7, 0.35);
      signboard.castShadow = true;
      this.scene.add(signboard);
    },

    buildInteriorPropsAndFans() {
      const THREE = global.THREE;

      const poster1Tex = this.createPosterTexture('TIGER PRO', '120 KM RANGE', '#7F1D1D', '#FBBF24');
      const poster2Tex = this.createPosterTexture('72V LFP PACK', 'FAST CHARGE', '#064E3B', '#34D399');
      const poster3Tex = this.createPosterTexture('VOLT S1 EV', 'ZERO EMISSION', '#1E3A8A', '#60A5FA');

      const makePoster = (tex, xPos) => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2, 2.8),
          new THREE.MeshBasicMaterial({ map: tex })
        );
        mesh.position.set(xPos, 3.0, -9.75);
        this.scene.add(mesh);
      };
      makePoster(poster1Tex, -6.5);
      makePoster(poster2Tex, 0);
      makePoster(poster3Tex, 6.5);

      const create3DFan = (x, y, z, isCeiling) => {
        const fanGroup = new THREE.Group();
        fanGroup.position.set(x, y, z);

        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.16, 16),
          new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.6 })
        );
        if (!isCeiling) hub.rotation.x = Math.PI / 2;
        fanGroup.add(hub);

        const bladesGroup = new THREE.Group();
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, metalness: 0.3, roughness: 0.4 });
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.22), bladeMat);
          blade.position.x = 0.65;
          const pivot = new THREE.Group();
          pivot.rotation.y = (i * Math.PI * 2) / 3;
          pivot.add(blade);
          bladesGroup.add(pivot);
        }
        if (!isCeiling) {
          bladesGroup.rotation.x = Math.PI / 2;
        }
        fanGroup.add(bladesGroup);
        this.scene.add(fanGroup);
        this.fans.push({ bladesGroup, isCeiling });
      };

      create3DFan(-3.3, 3.8, -9.6, false);
      create3DFan(3.3, 3.8, -9.6, false);
      create3DFan(-5.0, 4.7, -4.5, true);
      create3DFan(5.0, 4.7, -4.5, true);

      // Dealership Desk & 3D Tiffin Box
      const deskGroup = new THREE.Group();
      deskGroup.position.set(-7.5, 0, -7.6);
      const deskBody = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.1, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 })
      );
      deskBody.position.y = 0.55;
      deskBody.castShadow = true;
      deskGroup.add(deskBody);

      const tiffinGroup = new THREE.Group();
      tiffinGroup.position.set(-7.5, 1.15, -7.5);
      const tierColors = [0xF59E0B, 0xFBBF24, 0xD97706];
      for (let t = 0; t < 3; t++) {
        const tier = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.22, 20),
          new THREE.MeshStandardMaterial({ color: tierColors[t], metalness: 0.5, roughness: 0.25 })
        );
        tier.position.y = t * 0.23 + 0.1;
        tier.userData = { type: 'TIFFIN_BOX' };
        tiffinGroup.add(tier);
        this.interactiveMeshes.push(tier);
      }
      this.tiffinMesh = tiffinGroup;
      this.scene.add(deskGroup);
      this.scene.add(tiffinGroup);
    },

    buildGreenDoormatAndShutter() {
      const THREE = global.THREE;

      const matTex = this.createDoormatTexture();
      const doormat = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.06, 1.7),
        new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.85 })
      );
      doormat.position.set(0, 0.05, 0.95);
      doormat.receiveShadow = true;
      this.scene.add(doormat);

      // 3D Shutter Keypad Box on left entrance pillar
      const keypadMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.65, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x38BDF8, emissive: 0x0284C7, emissiveIntensity: 0.45 })
      );
      keypadMesh.position.set(-9.2, 1.5, 0.2);
      keypadMesh.userData = { type: 'SHUTTER_KEYPAD_3D' };
      this.shutterKeypadMesh = keypadMesh;
      this.interactiveMeshes.push(keypadMesh);
      this.scene.add(keypadMesh);

      const shutterGeo = new THREE.BoxGeometry(19.0, 4.4, 0.18);
      const shutterMat = new THREE.MeshStandardMaterial({
        color: 0x64748B,
        metalness: 0.65,
        roughness: 0.4,
        transparent: true,
        opacity: 0.88
      });
      this.shutterMesh = new THREE.Mesh(shutterGeo, shutterMat);
      this.shutterMesh.position.set(0, 2.2, 0);
      this.shutterTargetY = 2.2;
      this.scene.add(this.shutterMesh);
    },

    buildDropOffZones3D() {
      const THREE = global.THREE;

      // Glowing Green Zone Outside for Morning Scooter Display Drop-Off
      const outZoneGeo = new THREE.PlaneGeometry(9.8, 4.8);
      const outZoneMat = new THREE.MeshBasicMaterial({
        color: 0x10B981,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide
      });
      this.dropZoneOutsideMesh = new THREE.Mesh(outZoneGeo, outZoneMat);
      this.dropZoneOutsideMesh.rotation.x = -Math.PI / 2;
      this.dropZoneOutsideMesh.position.set(4.8, 0.06, 4.2);
      this.scene.add(this.dropZoneOutsideMesh);

      // Glowing Blue Zone Inside for Evening Scooter Lockup Drop-Off
      const inZoneGeo = new THREE.PlaneGeometry(9.8, 4.4);
      const inZoneMat = new THREE.MeshBasicMaterial({
        color: 0x3B82F6,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide
      });
      this.dropZoneInsideMesh = new THREE.Mesh(inZoneGeo, inZoneMat);
      this.dropZoneInsideMesh.rotation.x = -Math.PI / 2;
      this.dropZoneInsideMesh.position.set(1.0, 0.09, -2.6);
      this.scene.add(this.dropZoneInsideMesh);
    },

    buildProximityRingIndicator() {
      const THREE = global.THREE;
      const ringGeo = new THREE.RingGeometry(0.65, 0.88, 28);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFBBF24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      this.interactRingMesh = new THREE.Mesh(ringGeo, ringMat);
      this.interactRingMesh.rotation.x = -Math.PI / 2;
      this.interactRingMesh.position.set(0, 0.12, 0);
      this.interactRingMesh.visible = false;
      this.scene.add(this.interactRingMesh);
    },

    setShutterOpen(isOpen) {
      this.shutterTargetY = isOpen ? 4.65 : 2.2;
      if (this.shutterMesh) {
        this.shutterMesh.material.opacity = isOpen ? 0.22 : 0.88;
      }
    },

    createBrownChairMesh() {
      const THREE = global.THREE;
      const group = new THREE.Group();
      const brownMat = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.6 });
      const lightBrownMat = new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.5 });

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.9), lightBrownMat);
      seat.position.y = 0.55;
      seat.castShadow = true;
      group.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.1), brownMat);
      back.position.set(0, 1.0, -0.4);
      back.rotation.x = -0.08;
      back.castShadow = true;
      group.add(back);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.85), brownMat);
      armL.position.set(-0.45, 0.82, 0);
      const armR = armL.clone();
      armR.position.x = 0.45;
      group.add(armL, armR);

      const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.55, 8);
      const legPositions = [
        [-0.4, 0.275, -0.38],
        [0.4, 0.275, -0.38],
        [-0.4, 0.275, 0.38],
        [0.4, 0.275, 0.38]
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, brownMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });

      return group;
    },

    buildBrownWaitingChairs() {
      this.chairs3D = [];
      const chairX = [-8.2, -6.3, -4.4, -2.5];
      chairX.forEach((x, idx) => {
        const chairGroup = this.createBrownChairMesh();
        chairGroup.position.set(x, 0, 5.8);
        this.scene.add(chairGroup);
        this.chairs3D.push({
          index: idx,
          group: chairGroup,
          x,
          z: 5.8
        });
      });
    },

    createHumanoidMesh(shirtHex, pantsHex, turbanOrHairHex, roleTag, userDataPayload = {}) {
      const THREE = global.THREE;
      const group = new THREE.Group();

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xD9A066, roughness: 0.6 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.5 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.7 });
      const topMat = new THREE.MeshStandardMaterial({ color: turbanOrHairHex, roughness: 0.5 });

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), pantsMat);
      legL.position.set(-0.16, 0.38, 0);
      legL.name = 'legL';
      const legR = legL.clone();
      legR.position.x = 0.16;
      legR.name = 'legR';
      group.add(legL, legR);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirtMat);
      torso.position.y = 1.15;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), skinMat);
      head.position.y = 1.82;
      head.castShadow = true;
      group.add(head);

      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), topMat);
      crown.position.set(0, 1.92, -0.02);
      crown.scale.set(1.05, 0.75, 1.05);
      group.add(crown);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.18), shirtMat);
      armL.position.set(-0.42, 1.15, 0);
      armL.name = 'armL';
      const armR = armL.clone();
      armR.position.x = 0.42;
      armR.name = 'armR';
      group.add(armL, armR);

      group.traverse((child) => {
        if (child.isMesh) {
          child.userData = Object.assign({ role: roleTag }, userDataPayload);
        }
      });

      return group;
    },

    buildMainCharacters() {
      // Jashan (Player-controlled Third-Person Protagonist)
      const jashan = this.createHumanoidMesh(0xDC2626, 0x1E293B, 0xF59E0B, 'JASHAN');
      jashan.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.scene.add(jashan);
      this.characters.jashan = jashan;

      // Jass (Helper)
      const jass = this.createHumanoidMesh(0x2563EB, 0x0F172A, 0xDC2626, 'JASS');
      jass.position.set(7.5, 0, -6.5);
      this.scene.add(jass);
      this.characters.jass = jass;

      // Tanu (Helper)
      const tanu = this.createHumanoidMesh(0x059669, 0x1E293B, 0x111827, 'TANU');
      tanu.position.set(-3.5, 0, -7.2);
      this.scene.add(tanu);
      this.characters.tanu = tanu;
    },

    syncCustomerChair3D(chairIndex, customerData) {
      if (!customerData) {
        if (this.customers3D[chairIndex]) {
          const oldGroup = this.customers3D[chairIndex];
          oldGroup.traverse((c) => {
            const idx = this.interactiveMeshes.indexOf(c);
            if (idx !== -1) this.interactiveMeshes.splice(idx, 1);
          });
          this.scene.remove(oldGroup);
          this.customers3D[chairIndex] = null;
        }
        return;
      }

      if (!this.customers3D[chairIndex]) {
        const chairInfo = this.chairs3D[chairIndex];
        if (!chairInfo) return;
        const shirtColors = [0xF97316, 0x8B5CF6, 0x06B6D4, 0xEC4899];
        const custGroup = this.createHumanoidMesh(
          shirtColors[chairIndex % shirtColors.length],
          0x1E293B,
          0xFBBF24,
          'CUSTOMER',
          { type: 'CUSTOMER_3D', chairIndex }
        );
        // Spawn customer walking in from road (z = 11) toward their brown waiting chair!
        custGroup.position.set(chairInfo.x, 0.15, 11.0);
        custGroup.userData.targetSitZ = chairInfo.z + 0.1;
        custGroup.traverse((c) => {
          if (c.isMesh) this.interactiveMeshes.push(c);
        });
        this.scene.add(custGroup);
        this.customers3D[chairIndex] = custGroup;
      }
    },

    createElectricScooterMesh(colorHex, userDataPayload = {}) {
      const THREE = global.THREE;
      const scGroup = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.35, roughness: 0.3 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.7 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.8, roughness: 0.2 });
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A });

      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 1.25), bodyMat);
      deck.position.set(0, 0.32, 0);
      deck.castShadow = true;
      scGroup.add(deck);

      const rearBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.65), bodyMat);
      rearBody.position.set(0, 0.56, -0.32);
      rearBody.castShadow = true;
      scGroup.add(rearBody);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.72), darkMat);
      seat.position.set(0, 0.82, -0.3);
      scGroup.add(seat);

      const frontColumn = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.92, 0.28), bodyMat);
      frontColumn.position.set(0, 0.76, 0.48);
      frontColumn.rotation.x = -0.18;
      frontColumn.castShadow = true;
      scGroup.add(frontColumn);

      const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.82, 10), chromeMat);
      handlebar.rotation.z = Math.PI / 2;
      handlebar.position.set(0, 1.24, 0.42);
      scGroup.add(handlebar);

      const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), lampMat);
      headlamp.position.set(0, 1.15, 0.6);
      scGroup.add(headlamp);

      const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 16);
      const wheelF = new THREE.Mesh(wheelGeo, darkMat);
      wheelF.rotation.z = Math.PI / 2;
      wheelF.position.set(0, 0.26, 0.58);
      const wheelR = wheelF.clone();
      wheelR.position.z = -0.52;
      scGroup.add(wheelF, wheelR);

      scGroup.traverse((child) => {
        if (child.isMesh) {
          child.userData = Object.assign({}, userDataPayload);
        }
      });

      return scGroup;
    },

    getScooterTargetSlotPosition(scooterNum, location) {
      const idx = scooterNum - 1;
      const col = idx % 5;
      const row = Math.floor(idx / 5);

      if (location === 'INSIDE') {
        return {
          x: -3.2 + col * 2.1,
          y: 0,
          z: -3.6 + row * 1.9,
          rotY: 0
        };
      } else {
        return {
          x: 0.6 + col * 2.1,
          y: 0,
          z: 3.2 + row * 2.2,
          rotY: 0.25
        };
      }
    },

    buildTenDisplayScooters() {
      this.scooters3D = {};
      for (let i = 1; i <= 10; i++) {
        const colorHex = SCOOTER_PALETTE[i - 1];
        const scGroup = this.createElectricScooterMesh(colorHex, {
          type: 'DISPLAY_SCOOTER_3D',
          scooterNum: i
        });
        const startSlot = this.getScooterTargetSlotPosition(i, 'INSIDE');
        scGroup.position.set(startSlot.x, startSlot.y, startSlot.z);
        scGroup.rotation.y = startSlot.rotY;

        scGroup.traverse((c) => {
          if (c.isMesh) this.interactiveMeshes.push(c);
        });

        this.scene.add(scGroup);
        this.scooters3D[i] = {
          num: i,
          group: scGroup,
          location: 'INSIDE',
          targetPos: { x: startSlot.x, y: startSlot.y, z: startSlot.z },
          targetRotY: startSlot.rotY
        };
      }
    },

    syncDisplayScooterLocations(locationsMap) {
      for (let i = 1; i <= 10; i++) {
        const loc = locationsMap[i] || 'INSIDE';
        const scObj = this.scooters3D[i];
        if (scObj) {
          scObj.location = loc;
          if (this.grabbedScooterNum !== i) {
            const target = this.getScooterTargetSlotPosition(i, loc);
            scObj.targetPos = { x: target.x, y: target.y, z: target.z };
            scObj.targetRotY = target.rotY;
          }
        }
      }
    },

    buildBigTruckBossProp() {
      const THREE = global.THREE;
      const truckGroup = new THREE.Group();
      truckGroup.position.set(-4.5, 0, 11.2);
      truckGroup.visible = false;

      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 3.2, 3.0),
        new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.4 })
      );
      cab.position.set(-5.2, 1.8, 0);
      cab.castShadow = true;
      truckGroup.add(cab);

      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(9.6, 0.35, 3.2),
        new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 })
      );
      bed.position.set(1.2, 0.9, 0);
      truckGroup.add(bed);

      this.bigTruckCrates = [];
      const crateMat = new THREE.MeshStandardMaterial({ color: 0xB45309, roughness: 0.7 });
      for (let c = 0; c < 8; c++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 1.15), crateMat.clone());
        const col = c % 4;
        const row = Math.floor(c / 4);
        crate.position.set(-1.8 + col * 1.9, 1.65, row === 0 ? -0.7 : 0.7);
        crate.castShadow = true;
        truckGroup.add(crate);
        this.bigTruckCrates.push(crate);
      }

      this.bigTruckGroup = truckGroup;
      this.scene.add(truckGroup);
    },

    updateBigTruckCrates3D(cratesUnloadedCount) {
      if (!this.bigTruckGroup) return;
      this.bigTruckGroup.visible = true;
      this.bigTruckCrates.forEach((mesh, idx) => {
        if (idx < cratesUnloadedCount) {
          mesh.position.set(-2.5 + idx * 1.25, 0.55, -3.5);
          mesh.material.color.setHex(0x10B981);
        } else {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          mesh.position.set(-1.8 + col * 1.9, 1.65, row === 0 ? -0.7 : 0.7);
          mesh.material.color.setHex(0xB45309);
        }
      });
    },

    buildSmallTruckPuzzleProp() {
      const THREE = global.THREE;
      const group = new THREE.Group();
      group.position.set(0, 0, 10.6);
      group.visible = false;

      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.5, 2.6),
        new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.4 })
      );
      cab.position.set(-4.6, 1.45, 0);
      group.add(cab);

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.25, 2.7),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
      );
      deck.position.set(0, 0.75, 0);
      group.add(deck);

      const topRackDeck = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 0.14, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x2563EB, metalness: 0.5, roughness: 0.4 })
      );
      topRackDeck.position.set(-0.2, 2.35, 0);
      group.add(topRackDeck);

      const tailgate = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.16, 2.65),
        new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.5 })
      );
      tailgate.position.set(4.5, 0.82, 0);
      tailgate.rotation.z = 0.12;
      group.add(tailgate);

      const slotDefs = [
        { id: 'slot_top_1', zone: 'TOP_RACK', x: -2.1, y: 2.45, z: 0 },
        { id: 'slot_top_2', zone: 'TOP_RACK', x: -0.2, y: 2.45, z: 0 },
        { id: 'slot_top_3', zone: 'TOP_RACK', x: 1.7, y: 2.45, z: 0 },
        { id: 'slot_bot_1', zone: 'BOTTOM_BED', x: -2.1, y: 0.9, z: 0 },
        { id: 'slot_bot_2', zone: 'BOTTOM_BED', x: -0.2, y: 0.9, z: 0 },
        { id: 'slot_bot_3', zone: 'BOTTOM_BED', x: 1.7, y: 0.9, z: 0 },
        { id: 'slot_half_1', zone: 'HALF_IN_OUT', x: 3.6, y: 0.95, z: -0.8 },
        { id: 'slot_half_2', zone: 'HALF_IN_OUT', x: 4.4, y: 0.98, z: 0 },
        { id: 'slot_half_3', zone: 'HALF_IN_OUT', x: 5.2, y: 1.02, z: 0.8 }
      ];

      this.smallTruckBayMeshes = {};
      slotDefs.forEach((def) => {
        const bayHighlight = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.12, 0.85),
          new THREE.MeshBasicMaterial({
            color: def.zone === 'TOP_RACK' ? 0x60A5FA : def.zone === 'BOTTOM_BED' ? 0x34D399 : 0xFBBF24,
            transparent: true,
            opacity: 0.45
          })
        );
        bayHighlight.position.set(def.x, def.y, def.z);
        bayHighlight.userData = {
          type: 'SMALL_TRUCK_SLOT_3D',
          slotId: def.id,
          zone: def.zone
        };
        group.add(bayHighlight);
        this.interactiveMeshes.push(bayHighlight);

        this.smallTruckBayMeshes[def.id] = {
          def,
          highlightMesh: bayHighlight,
          scooterMesh: null
        };
      });

      this.smallTruckGroup = group;
      this.scene.add(group);
    },

    syncSmallTruck3DSlots(slotsArray, scootersArray) {
      if (!this.smallTruckGroup) return;
      this.smallTruckGroup.visible = true;

      slotsArray.forEach((slotObj) => {
        const bay = this.smallTruckBayMeshes[slotObj.id];
        if (!bay) return;

        if (!slotObj.scooterId && bay.scooterMesh) {
          this.smallTruckGroup.remove(bay.scooterMesh);
          bay.scooterMesh = null;
        }

        if (slotObj.scooterId && !bay.scooterMesh) {
          const scData = scootersArray.find((s) => s.id === slotObj.scooterId);
          const hex = scData ? parseInt(scData.color.replace('#', '0x'), 16) : 0xEF4444;
          const scMesh = this.createElectricScooterMesh(hex, {
            type: 'SMALL_TRUCK_SLOT_3D',
            slotId: slotObj.id
          });
          scMesh.scale.set(0.82, 0.82, 0.82);
          scMesh.position.set(bay.def.x, bay.def.y + 0.05, bay.def.z);

          if (slotObj.zone === 'TOP_RACK') {
            scMesh.rotation.z = Math.PI / 2;
            scMesh.position.y += 0.35;
          } else if (slotObj.zone === 'HALF_IN_OUT') {
            scMesh.rotation.x = -0.45;
            scMesh.rotation.y = Math.PI / 2;
          } else {
            scMesh.rotation.y = Math.PI / 2;
          }

          this.smallTruckGroup.add(scMesh);
          bay.scooterMesh = scMesh;
        }
      });
    },

    /* =========================================================================
     * THIRD-PERSON CAMERA ROTATION & PRESETS
     * ========================================================================= */
    rotateThirdPersonCamera(deltaYaw, deltaPitch) {
      this.cameraMode = 'THIRD_PERSON';
      this.tpCamYaw += deltaYaw;
      this.tpCamPitch = Math.max(0.2, Math.min(1.15, this.tpCamPitch + deltaPitch));
    },

    setCameraPreset(mode) {
      this.cameraMode = mode;
      if (mode === 'THIRD_PERSON') {
        return;
      } else if (mode === 'INTERIOR') {
        this.camTargetPos = { x: 0, y: 8.5, z: 6.5 };
        this.camLookAt = { x: 0, y: 1.5, z: -5.5 };
      } else if (mode === 'EXTERIOR') {
        this.camTargetPos = { x: -2.0, y: 8.0, z: 16.5 };
        this.camLookAt = { x: -2.0, y: 1.2, z: 4.5 };
      } else if (mode === 'BIG_TRUCK') {
        if (this.bigTruckGroup) this.bigTruckGroup.visible = true;
        if (this.smallTruckGroup) this.smallTruckGroup.visible = false;
        this.camTargetPos = { x: -2.0, y: 7.5, z: 21.5 };
        this.camLookAt = { x: -3.0, y: 1.8, z: 10.5 };
      } else if (mode === 'SMALL_TRUCK') {
        if (this.smallTruckGroup) this.smallTruckGroup.visible = true;
        if (this.bigTruckGroup) this.bigTruckGroup.visible = false;
        this.camTargetPos = { x: 0.5, y: 6.8, z: 19.5 };
        this.camLookAt = { x: 0.5, y: 1.8, z: 10.6 };
      } else {
        this.camTargetPos = { x: 0, y: 12.5, z: 22.5 };
        this.camLookAt = { x: 0, y: 1.8, z: 1.5 };
      }
    },

    /* =========================================================================
     * PROXIMITY DETECTION & CONTEXT-SENSITIVE INTERACT SYSTEM
     * ========================================================================= */
    getNearestInteractable() {
      const px = this.playerPos.x;
      const pz = this.playerPos.z;
      const phase = global.GameState ? global.GameState.data.phase : 'HUB';
      const dayType = global.GameState ? global.GameState.getDayType(global.GameState.data.currentDay) : 'NORMAL';

      // 1. If Jashan is currently pushing/driving a grabbed 3D scooter:
      if (this.grabbedScooterNum !== null) {
        if (phase === 'MORNING_DISPLAY' && pz > 1.2) {
          return {
            type: 'PARK_SCOOTER_OUTSIDE',
            scooterNum: this.grabbedScooterNum,
            icon: '🅿️',
            label: `PARK SCOOTER #${this.grabbedScooterNum} OUTSIDE`,
            sublabel: 'Release in Display Yard (+Stamina/Progress)',
            x: px,
            z: pz
          };
        }
        if (phase === 'EVENING_PACKUP' && pz < -0.6) {
          return {
            type: 'PARK_SCOOTER_INSIDE',
            scooterNum: this.grabbedScooterNum,
            icon: '🏢',
            label: `PARK SCOOTER #${this.grabbedScooterNum} INSIDE`,
            sublabel: 'Release in Showroom Floor',
            x: px,
            z: pz
          };
        }
        return {
          type: 'DROP_SCOOTER_HERE',
          scooterNum: this.grabbedScooterNum,
          icon: '🛵',
          label: `PUSHING SCOOTER #${this.grabbedScooterNum}`,
          sublabel: phase === 'MORNING_DISPLAY' ? 'Drive Outside (z > 1) then Tap to Park!' : 'Drive Inside (z < -1) then Tap to Park!',
          x: px,
          z: pz
        };
      }

      let best = null;
      let bestDist = 3.2; // Max interaction distance in meters

      const consider = (dist, candidate) => {
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      };

      // 2. Check Shutter Keypad / Entrance Threshold (Morning OTP or Starting Day)
      const distShutter = Math.hypot(px - 0, pz - 0);
      const distKeypad = Math.hypot(px - (-9.2), pz - 0.2);
      const minShutterDist = Math.min(distShutter, distKeypad);
      if (!global.GameState.data.shutterUnlocked || phase === 'HUB' || phase === 'MORNING_OTP') {
        consider(minShutterDist, {
          type: 'SHUTTER_OTP_LOCK',
          icon: '🔐',
          label: 'UNLOCK SHUTTER (OTP KEYPAD)',
          sublabel: `Day ${global.GameState.data.currentDay} Morning Security Code`,
          x: 0,
          z: 0
        });
      }

      // 3. Check 3D Tiffin Box on Counter (-7.5, -7.5)
      const distTiffin = Math.hypot(px - (-7.5), pz - (-7.5));
      consider(distTiffin, {
        type: 'EAT_TIFFIN_3D',
        icon: '🍱',
        label: 'EAT HOME TIFFIN (100% ⚡)',
        sublabel: `Current Stamina: ${Math.round(global.GameState.data.stamina)}%`,
        x: -7.5,
        z: -7.5
      });

      // 4. Check 10 Display Scooters during Morning Display or Evening Packup
      if (phase === 'MORNING_DISPLAY' || phase === 'EVENING_PACKUP') {
        const requiredSourceLoc = phase === 'MORNING_DISPLAY' ? 'INSIDE' : 'OUTSIDE';
        for (let i = 1; i <= 10; i++) {
          const sc = this.scooters3D[i];
          if (sc && sc.location === requiredSourceLoc) {
            const d = Math.hypot(px - sc.group.position.x, pz - sc.group.position.z);
            consider(d, {
              type: 'GRAB_SCOOTER_3D',
              scooterNum: i,
              icon: '🛵',
              label: `GRAB & DRIVE SCOOTER #${i}`,
              sublabel: phase === 'MORNING_DISPLAY' ? 'Push to Outside Display Yard' : 'Push Back Inside Showroom',
              x: sc.group.position.x,
              z: sc.group.position.z
            });
          }
        }
      }

      // 5. Check Seated 3D Customers on Brown Waiting Chairs
      if (global.CustomerQueue) {
        for (let c = 0; c < 4; c++) {
          const cust = global.CustomerQueue.chairs[c];
          const chair = this.chairs3D[c];
          if (cust && chair) {
            const d = Math.hypot(px - chair.x, pz - chair.z);
            consider(d, {
              type: 'REPAIR_CUSTOMER_3D',
              chairIndex: c,
              icon: cust.repairIcon || '🛠️',
              label: `REPAIR ${cust.name.split(' ')[0].toUpperCase()}'S SCOOTER`,
              sublabel: `${cust.repairTitle} (+Rs ${cust.reward})`,
              x: chair.x,
              z: chair.z
            });
          }
        }
      }

      // 6. Check Big Truck Unloading Zone (Days 15, 45, 75 or when Big Truck visible)
      if ((dayType === 'BIG_TRUCK' || phase === 'BOSS_BIG_TRUCK') && this.bigTruckGroup) {
        this.bigTruckGroup.visible = true;
        const dTruck = Math.hypot(px - (-3.5), pz - 9.2);
        consider(dTruck, {
          type: 'BIG_TRUCK_INTERACT',
          icon: '🚛',
          label: 'UNLOAD BIG TRUCK CRATES',
          sublabel: '8 Heavy Crates Timing Slider Boss',
          x: -3.5,
          z: 9.8
        });
      }

      // 7. Check Small Truck Loading Zone (Every 6th Day or when Small Truck visible)
      if ((dayType === 'SMALL_TRUCK' || phase === 'BOSS_SMALL_TRUCK') && this.smallTruckGroup) {
        this.smallTruckGroup.visible = true;
        const dSmall = Math.hypot(px - 0, pz - 9.0);
        consider(dSmall, {
          type: 'SMALL_TRUCK_INTERACT',
          icon: '🛻',
          label: 'LOAD 9 SCOOTERS IN SMALL TRUCK',
          sublabel: '3 Top Rack • 3 Inside • 3 Half-Outside',
          x: 0,
          z: 9.8
        });
      }

      return best;
    },

    executeInteraction(target) {
      if (!target) return;
      if (global.Sound) global.Sound.click();

      if (target.type === 'SHUTTER_OTP_LOCK') {
        if (global.UI) {
          global.UI.startDayWorkflow(global.GameState.data.currentDay);
        }
      } else if (target.type === 'EAT_TIFFIN_3D') {
        global.GameState.eatTiffin();
        if (global.UI) global.UI.updateHUD();
      } else if (target.type === 'GRAB_SCOOTER_3D') {
        if (global.GameState.data.stamina < 4) {
          if (global.Sound) global.Sound.error();
          if (global.UI) global.UI.showFloatingToast('🍱 Too tired to push scooters! Walk to the Tiffin Box on the counter!', 'danger');
          return;
        }
        this.grabbedScooterNum = target.scooterNum;
        if (global.Sound) global.Sound.ratchet();
        if (global.UI) {
          const dest = global.GameState.data.phase === 'MORNING_DISPLAY' ? 'Outside Display Veranda (Green Zone)' : 'Inside Showroom (Blue Zone)';
          global.UI.showFloatingToast(`🛵 Grabbed Scooter #${target.scooterNum}! Use the Joystick to drive/push it to the ${dest}!`, 'info');
        }
      } else if (target.type === 'PARK_SCOOTER_OUTSIDE') {
        const num = this.grabbedScooterNum;
        this.grabbedScooterNum = null;
        if (global.UI && num) {
          global.UI.moveScooterTo(num, 'OUTSIDE');
        }
      } else if (target.type === 'PARK_SCOOTER_INSIDE') {
        const num = this.grabbedScooterNum;
        this.grabbedScooterNum = null;
        if (global.UI && num) {
          global.UI.moveScooterTo(num, 'INSIDE');
        }
      } else if (target.type === 'DROP_SCOOTER_HERE') {
        const phase = global.GameState.data.phase;
        if (phase === 'MORNING_DISPLAY' && this.playerPos.z > 0.5) {
          const num = this.grabbedScooterNum;
          this.grabbedScooterNum = null;
          if (global.UI && num) global.UI.moveScooterTo(num, 'OUTSIDE');
        } else if (phase === 'EVENING_PACKUP' && this.playerPos.z < 0) {
          const num = this.grabbedScooterNum;
          this.grabbedScooterNum = null;
          if (global.UI && num) global.UI.moveScooterTo(num, 'INSIDE');
        } else {
          // Put back if dropped early
          this.grabbedScooterNum = null;
          if (global.UI) {
            global.UI.renderShowroomScooters();
            global.UI.showFloatingToast('Released scooter handle. Walk into the highlighted target zone to park it!', 'info');
          }
        }
      } else if (target.type === 'REPAIR_CUSTOMER_3D') {
        if (global.CustomerQueue) {
          global.CustomerQueue.onCustomerClicked(target.chairIndex);
        }
      } else if (target.type === 'BIG_TRUCK_INTERACT') {
        global.BigTruckBoss.start(() => {
          global.GameState.completeCurrentDay();
          if (global.UI) {
            global.UI.updateHUD();
            global.UI.renderPhaseActionBanner();
            global.UI.openDaySummaryModal();
          }
        });
      } else if (target.type === 'SMALL_TRUCK_INTERACT') {
        global.SmallTruckPuzzle.start(() => {
          global.GameState.completeCurrentDay();
          if (global.UI) {
            global.UI.updateHUD();
            global.UI.renderPhaseActionBanner();
            global.UI.openDaySummaryModal();
          }
        });
      }
    },

    /* =========================================================================
     * 3D RAYCAST FALLBACK & FLOATING 2D PATIENCE METER PROJECTION
     * ========================================================================= */
    bindCanvasEvents() {
      const domEl = this.renderer.domElement;
      let downPos = { x: 0, y: 0 };

      domEl.addEventListener('pointerdown', (e) => {
        downPos = { x: e.clientX, y: e.clientY };
      });

      domEl.addEventListener('pointerup', (e) => {
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (dist < 8 && e.target === domEl) {
          this.handleCanvasTap(e);
        }
      });

      window.addEventListener('resize', () => this.handleResize());
    },

    handleResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = window.innerWidth || this.container.clientWidth || 420;
      const h = window.innerHeight || this.container.clientHeight || 800;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    },

    handleCanvasTap(e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactiveMeshes, true);
      if (!hits.length) return;

      const data = hits[0].object.userData || {};

      if (data.type === 'TIFFIN_BOX') {
        global.GameState.eatTiffin();
        if (global.UI) global.UI.updateHUD();
      } else if (data.type === 'SHUTTER_KEYPAD_3D') {
        if (global.UI) global.UI.startDayWorkflow(global.GameState.data.currentDay);
      } else if (data.type === 'DISPLAY_SCOOTER_3D' && data.scooterNum) {
        const phase = global.GameState.data.phase;
        if (phase === 'MORNING_DISPLAY' && global.UI) {
          global.UI.moveScooterTo(data.scooterNum, 'OUTSIDE');
        } else if (phase === 'EVENING_PACKUP' && global.UI) {
          global.UI.moveScooterTo(data.scooterNum, 'INSIDE');
        }
      } else if (data.type === 'CUSTOMER_3D' && typeof data.chairIndex === 'number') {
        if (global.CustomerQueue) {
          global.CustomerQueue.onCustomerClicked(data.chairIndex);
        }
      } else if (data.type === 'SMALL_TRUCK_SLOT_3D' && data.slotId) {
        if (global.SmallTruckPuzzle) {
          const slotObj = global.SmallTruckPuzzle.slots.find((s) => s.id === data.slotId);
          if (slotObj && slotObj.scooterId) {
            global.SmallTruckPuzzle.removeScooterFromSlot(data.slotId);
          } else if (global.SmallTruckPuzzle.selectedScooterId) {
            global.SmallTruckPuzzle.attemptPlaceScooter(global.SmallTruckPuzzle.selectedScooterId, data.slotId);
          }
        }
      }
    },

    projectFloatingPatienceMeters() {
      const overlay = document.getElementById('floating-3d-labels-layer');
      if (!overlay || !this.camera || !global.CustomerQueue) return;

      const THREE = global.THREE;
      const w = this.renderer.domElement.clientWidth;
      const h = this.renderer.domElement.clientHeight;

      for (let i = 0; i < 4; i++) {
        const badgeEl = document.getElementById(`floating-cust-tag-${i}`);
        const custData = global.CustomerQueue.chairs[i];
        const custMesh = this.customers3D[i];

        if (!custData || !custMesh) {
          if (badgeEl) badgeEl.style.display = 'none';
          continue;
        }

        const worldPos = new THREE.Vector3(
          custMesh.position.x,
          2.65,
          custMesh.position.z
        );
        worldPos.project(this.camera);

        if (worldPos.z > 1) {
          if (badgeEl) badgeEl.style.display = 'none';
          continue;
        }

        const sx = (worldPos.x * 0.5 + 0.5) * w;
        const sy = (-(worldPos.y * 0.5) + 0.5) * h;

        if (badgeEl) {
          badgeEl.style.display = 'flex';
          badgeEl.style.left = `${Math.round(sx)}px`;
          badgeEl.style.top = `${Math.round(sy)}px`;

          const fillEl = document.getElementById(`floating-cust-bar-${i}`);
          const nameEl = document.getElementById(`floating-cust-name-${i}`);
          const p = Math.round(custData.patience);
          if (nameEl) nameEl.textContent = `${custData.repairIcon} ${custData.name.split(' ')[0]} (${p}%)`;
          if (fillEl) {
            fillEl.style.width = `${p}%`;
            fillEl.style.background = p > 60 ? '#10B981' : p > 30 ? '#F59E0B' : '#EF4444';
          }
        }
      }
    },

    updateThirdPersonMovement(dt) {
      if (!global.VirtualJoystick || !this.characters.jashan) return;
      const input = global.VirtualJoystick.getInputVector();
      const jashan = this.characters.jashan;

      if (input.mag > 0.02) {
        // Transform joystick (x, y) relative to third-person camera yaw
        const sinY = Math.sin(this.tpCamYaw);
        const cosY = Math.cos(this.tpCamYaw);
        const worldDx = input.x * cosY + input.y * sinY;
        const worldDz = input.y * cosY - input.x * sinY;

        const moveSpeed = (this.grabbedScooterNum ? 5.6 : this.playerSpeed) * input.mag;
        let nextX = this.playerPos.x + worldDx * moveSpeed * dt;
        let nextZ = this.playerPos.z + worldDz * moveSpeed * dt;

        // Dealership wall boundaries
        nextX = Math.max(-10.1, Math.min(10.1, nextX));
        nextZ = Math.max(-9.1, Math.min(13.5, nextZ));

        // If shutter is closed (shutterTargetY < 3.5), prevent walking across z = 0 threshold
        if (this.shutterTargetY < 3.5) {
          if (this.playerPos.z < -0.35 && nextZ >= -0.35) {
            nextZ = -0.35;
          } else if (this.playerPos.z > 0.35 && nextZ <= 0.35) {
            nextZ = 0.35;
          }
        }

        this.playerPos.x = nextX;
        this.playerPos.z = nextZ;
        this.playerRotY = Math.atan2(worldDx, worldDz);

        jashan.position.set(this.playerPos.x, 0, this.playerPos.z);
        jashan.rotation.y = this.playerRotY;

        // Animate walking stride on Jashan's legs and arms
        this.playerWalkCycle += dt * 11 * input.mag;
        const swing = Math.sin(this.playerWalkCycle) * 0.55;
        const legL = jashan.getObjectByName('legL');
        const legR = jashan.getObjectByName('legR');
        const armL = jashan.getObjectByName('armL');
        const armR = jashan.getObjectByName('armR');
        if (legL) legL.rotation.x = swing;
        if (legR) legR.rotation.x = -swing;
        if (armL) armL.rotation.x = this.grabbedScooterNum ? -0.75 : -swing * 0.7;
        if (armR) armR.rotation.x = this.grabbedScooterNum ? -0.75 : swing * 0.7;

        // If Jashan is physically pushing/driving a grabbed 3D scooter:
        if (this.grabbedScooterNum && this.scooters3D[this.grabbedScooterNum]) {
          const sc = this.scooters3D[this.grabbedScooterNum];
          const forwardX = Math.sin(this.playerRotY) * 1.15;
          const forwardZ = Math.cos(this.playerRotY) * 1.15;
          sc.targetPos.x = this.playerPos.x + forwardX;
          sc.targetPos.z = this.playerPos.z + forwardZ;
          sc.targetRotY = this.playerRotY;
          sc.group.position.set(sc.targetPos.x, 0, sc.targetPos.z);
          sc.group.rotation.y = sc.targetRotY;

          // Auto-park if Jashan pushes the scooter into the target drop-off zone!
          const phase = global.GameState.data.phase;
          if (phase === 'MORNING_DISPLAY' && this.playerPos.z > 2.4 && this.playerPos.x > -0.5) {
            const num = this.grabbedScooterNum;
            this.grabbedScooterNum = null;
            if (global.UI) global.UI.moveScooterTo(num, 'OUTSIDE');
          } else if (phase === 'EVENING_PACKUP' && this.playerPos.z < -1.8) {
            const num = this.grabbedScooterNum;
            this.grabbedScooterNum = null;
            if (global.UI) global.UI.moveScooterTo(num, 'INSIDE');
          }
        }
      } else {
        // Reset limb rotations when standing idle
        const legL = jashan.getObjectByName('legL');
        const legR = jashan.getObjectByName('legR');
        const armL = jashan.getObjectByName('armL');
        const armR = jashan.getObjectByName('armR');
        if (legL) legL.rotation.x *= 0.85;
        if (legR) legR.rotation.x *= 0.85;
        if (armL) armL.rotation.x = this.grabbedScooterNum ? -0.75 : armL.rotation.x * 0.85;
        if (armR) armR.rotation.x = this.grabbedScooterNum ? -0.75 : armR.rotation.x * 0.85;
      }

      // Check proximity interactables & update the on-screen INTERACT button + 3D highlight ring
      const nearest = this.getNearestInteractable();
      if (global.VirtualJoystick) {
        global.VirtualJoystick.updateInteractPrompt(nearest);
      }
      if (this.interactRingMesh) {
        if (nearest) {
          this.interactRingMesh.visible = true;
          this.interactRingMesh.position.set(nearest.x, 0.12, nearest.z);
        } else {
          this.interactRingMesh.visible = false;
        }
      }
    },

    animate() {
      requestAnimationFrame(() => this.animate());
      if (!this.renderer || !this.scene || !this.camera) return;

      const dt = Math.min(0.05, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();

      // 1. Rotate 3D Fans
      this.fans.forEach((f) => {
        f.bladesGroup.rotation.y += dt * 11.0;
      });

      // 2. Animate 3D Shutter
      if (this.shutterMesh) {
        this.shutterMesh.position.y += (this.shutterTargetY - this.shutterMesh.position.y) * Math.min(1, dt * 6);
      }

      // 3. Update Third-Person Jashan Movement & Proximity Detection
      this.updateThirdPersonMovement(dt);

      // 4. Smoothly interpolate ungrabbed 3D Scooters
      Object.values(this.scooters3D).forEach((sc) => {
        if (this.grabbedScooterNum === sc.num) return;
        sc.group.position.x += (sc.targetPos.x - sc.group.position.x) * Math.min(1, dt * 6.5);
        sc.group.position.y += (sc.targetPos.y - sc.group.position.y) * Math.min(1, dt * 6.5);
        sc.group.position.z += (sc.targetPos.z - sc.group.position.z) * Math.min(1, dt * 6.5);
        sc.group.rotation.y += (sc.targetRotY - sc.group.rotation.y) * Math.min(1, dt * 6.5);
      });

      // 5. Walk-in animation for 3D Customers approaching the brown waiting chairs
      this.customers3D.forEach((custGroup) => {
        if (!custGroup) return;
        const targetZ = custGroup.userData.targetSitZ || 5.9;
        if (Math.abs(custGroup.position.z - targetZ) > 0.05) {
          custGroup.position.z += (targetZ - custGroup.position.z) * Math.min(1, dt * 4.5);
        }
      });

      // 6. Pulse drop-off zones based on current phase
      const phase = global.GameState ? global.GameState.data.phase : 'HUB';
      if (this.dropZoneOutsideMesh) {
        this.dropZoneOutsideMesh.visible = phase === 'MORNING_DISPLAY';
        this.dropZoneOutsideMesh.material.opacity = 0.2 + Math.sin(elapsed * 4) * 0.1;
      }
      if (this.dropZoneInsideMesh) {
        this.dropZoneInsideMesh.visible = phase === 'EVENING_PACKUP';
        this.dropZoneInsideMesh.material.opacity = 0.2 + Math.sin(elapsed * 4) * 0.1;
      }

      // 7. Camera Update: THIRD_PERSON follow camera vs Fixed Presets
      if (this.cameraMode === 'THIRD_PERSON') {
        const horizDist = Math.cos(this.tpCamPitch) * this.tpCamDistance;
        const vertDist = Math.sin(this.tpCamPitch) * this.tpCamDistance + 1.6;
        const desiredCamX = this.playerPos.x + Math.sin(this.tpCamYaw) * horizDist;
        const desiredCamZ = this.playerPos.z + Math.cos(this.tpCamYaw) * horizDist;
        const desiredCamY = vertDist;

        this.camera.position.x += (desiredCamX - this.camera.position.x) * Math.min(1, dt * 8);
        this.camera.position.y += (desiredCamY - this.camera.position.y) * Math.min(1, dt * 8);
        this.camera.position.z += (desiredCamZ - this.camera.position.z) * Math.min(1, dt * 8);

        this.currentLookAt.x += (this.playerPos.x - this.currentLookAt.x) * Math.min(1, dt * 10);
        this.currentLookAt.y += (1.35 - this.currentLookAt.y) * Math.min(1, dt * 10);
        this.currentLookAt.z += (this.playerPos.z - this.currentLookAt.z) * Math.min(1, dt * 10);
        this.camera.lookAt(this.currentLookAt.x, this.currentLookAt.y, this.currentLookAt.z);
      } else {
        this.camera.position.x += (this.camTargetPos.x - this.camera.position.x) * Math.min(1, dt * 5);
        this.camera.position.y += (this.camTargetPos.y - this.camera.position.y) * Math.min(1, dt * 5);
        this.camera.position.z += (this.camTargetPos.z - this.camera.position.z) * Math.min(1, dt * 5);

        this.currentLookAt.x += (this.camLookAt.x - this.currentLookAt.x) * Math.min(1, dt * 6);
        this.currentLookAt.y += (this.camLookAt.y - this.currentLookAt.y) * Math.min(1, dt * 6);
        this.currentLookAt.z += (this.camLookAt.z - this.currentLookAt.z) * Math.min(1, dt * 6);
        this.camera.lookAt(this.currentLookAt.x, this.currentLookAt.y, this.currentLookAt.z);
      }

      this.projectFloatingPatienceMeters();
      this.renderer.render(this.scene, this.camera);
    }
  };

  global.Scene3D = Scene3D;
})(window);
