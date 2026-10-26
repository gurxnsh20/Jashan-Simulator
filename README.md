# Jashan’s Simulator (AM) — 3D Third-Person Dealership RPG (Three.js + Capacitor)

**Jashan’s Simulator (AM)** is a 100% complete, zero-placeholder 3D third-person simulation and time-management mobile RPG based on the daily operations of **Aulakh Motors**, an electric scooter dealership and service center.

---

## 📁 Repository & Capacitor Project Architecture

```text
jashans-simulator-am/
├── .github/
│   └── workflows/
│       └── build.yml          # GitHub Actions CI/CD pipeline compiling debug Android APK
├── capacitor.config.json      # Capacitor Android configuration (com.aulakhmotors.jashansim)
├── package.json               # Node & Capacitor CLI/Android dependencies & build scripts
├── README.md                  # Full technical documentation & gameplay guide
└── www/                       # Web assets bundled into Capacitor Android WebView
    ├── index.html             # 3D Three.js Third-Person Viewport, Virtual Joystick, Camera Pad & 2D Overlays
    ├── css/
    │   └── style.css          # Virtual Joystick, Interact Button, 3D HUD & Mini-Game Styling
    └── js/
        ├── state.js           # 90-Day Calendar, LocalStorage persistence, Stamina, Web Audio
        ├── joystick.js        # On-screen Virtual Joystick (Left), Camera Look Pad (Right) & Proximity Interact Button
        ├── scene.js           # Three.js Third-Person Controller, 3D Dealership, Physical Scooter Grabbing & Trucks
        ├── otp.js             # Morning OTP Phone Popup (5s) & 3-Try Shutter Keypad (2D Overlay)
        ├── slider.js          # Big Truck Boss Event (Days 15, 45, 75) Timing Slider over 3D Truck
        ├── tetris.js          # Small Truck Mini-Boss (Every 6th Day) 3D + 2D 9-Scooter Spatial Puzzle
        ├── minigames.js       # 3D/2D Customer Queue + Wiring, Battery & Hardware Repair Mini-Games
        └── main.js            # Phase orchestrator, 10-Scooter 3D/2D Drag & Tap, Tiffin, Crew Upgrades
```

---

## 🕹️ Third-Person Character Controller & Virtual Joystick (`www/js/joystick.js` & `www/js/scene.js`)

1. **Left On-Screen Virtual Joystick (`#virtual-joystick-zone` + `WASD`/Arrow Keys)**:
   - Walk and run **Jashan** freely around the 3D dealership interior, entrance threshold, outdoor veranda, and freight yard.
2. **Right-Screen Camera Rotation (`#camera-look-zone`)**:
   - Drag anywhere on the right side of the 3D screen to smoothly orbit the third-person camera yaw and pitch around Jashan (or switch between `3rd-Person Follow`, `Full Dealership`, `3D Interior`, `3D Veranda`, and `3D Truck Yard` camera presets).
3. **Proximity Context-Sensitive "INTERACT" Button (`#btn-3d-interact` + `[E]` / `[F]`)**:
   - Automatically appears with a golden highlight ring whenever Jashan walks near an interactive 3D object:
     - **Shutter OTP Lock**: Walk to the shutter keypad in the morning and press **Interact** to launch the 4-digit OTP phone popup & keypad.
     - **10 3D Display Scooters**: Walk up to any 3D scooter inside the shop, press **Interact** to grab the handlebars, physically drive/push it outside with the joystick into the green display zone (Morning) or back inside into the blue showroom zone (Evening), and press **Interact** to park it.
     - **3D Waiting Customers on Brown Chairs**: Walk up to a seated customer with a floating Patience Meter above their head and press **Interact** to launch their repair mini-game (**Wiring Fix**, **Battery Setup**, or **Hardware Fastening**).
     - **3D Tiffin Box on Counter**: Walk to the counter desk and press **Interact** to eat Jashan's home tiffin and restore Stamina to **100%**.
     - **3D Big Truck (Days 15, 45, 75) & 3D Small Truck (Every 6th Day)**: Walk out to the freight truck in the yard and press **Interact** to unload the 8 heavy crates or load the 9 scooters into the 3D Small Truck (3 on Top Rack, 3 Inside Bottom, 3 Half-Inside/Half-Outside).

---

## 🚀 Building the Android APK (Local & GitHub Actions)

### Automated GitHub Actions APK Build (`.github/workflows/build.yml`)
1. Push this repository to GitHub (`main` or `master` branch).
2. GitHub Actions provisions **Node.js 20**, **Java 17 (Temurin)**, and the **Android SDK**, runs `npm install`, syncs Capacitor Android (`npx cap add android && npx cap sync android`), and executes `./gradlew assembleDebug`.
3. Download `app-debug.apk` from the workflow run's **Artifacts** (`Jashans-Simulator-AM-debug-apk`).
