# 🐾 Co-op Pixel Pet Studio

A two-player cooperative desktop pet application that lives on your computer screen. Two people on separate computers can customize, draw pixel art animations, create custom speech quotes, and care for their pet together in real-time over Peer-to-Peer (WebRTC).

---

## ✨ Features

- **🐾 Transparent Desktop Pet Mode**:
  - Floats directly over your desktop wallpaper and apps.
  - Sits hidden in your **Windows Hidden Icons (System Tray)** — leaves your taskbar clean!
  - 100% click-through for empty space: won't interfere with gaming, typing, or watching movies.
  - Interactive Care: Feed strawberries (🍓), Pet (💖), Send love nudges (✨), or Sleep (🌙).
  - **Quick Hotkey:** Press **`Ctrl+Shift+H`** (or `Ctrl+H`) on your desktop anytime to hide/show the pet status bar!

- **🏃 Border Walking & "Scared of Center" AI**:
  - The pet **only walks along the borders** of your screen (bottom, top, left, right).
  - If dropped in the open center of the screen, the pet gets scared (`"Eep! Too open! 🏃💨"`), panics, and **sprints back to the nearest border** where it feels safe!
  - Active, comfortable walking pace with corner turning.

- **🦘 Multi-Monitor Support & Ledge Jumping**:
  - Accounts for different monitor resolutions (e.g. 1440p + 1080p) and vertical offsets.
  - **Dead-Space Protection:** Prevents the pet from getting lost in invisible empty gaps.
  - **Ledge Jumping:** When walking along the bottom edge from one monitor to another with a different height alignment, the pet leaps in a graceful arc down or up to land safely on the other monitor!

- **💬 Customizable Pet Quotes & Speech Personality**:
  - Dedicated **"💬 Pet Quotes"** tab in the studio.
  - Customize what your pet says for each moment:
    - 🏃 *Scared of Center* (e.g. "Eep! Too open!", "Heading to the wall!")
    - 🛡️ *Safe on Border* (e.g. "Phew! Safe!", "Cozy border acquired!")
    - 🦘 *Ledge Jump* (e.g. "Hup!", "Look out below!", "Leap!")
    - 🍓 *Eating Treats*
    - 💖 *Being Petted*
    - ✨ *Love Nudges*
    - 🌙 *Sleep Time*
    - ☀️ *Waking Up*
  - Add unlimited quotes per category, delete quotes, or restore defaults with 1 click!

- **🎨 Pixel Animation Studio**:
  - **Onion Skinning**: See the previous frame in translucent red ghosting and next frame in blue ghosting so you can animate smooth motion effortlessly.
  - **Animation States**: Clips for `Idle`, `Walk`, `Happy`, `Eat`, and `Sleep`.
  - **Drawing Tools**: Pixel pencil, eraser, flood-fill bucket, color eyedropper, symmetry mirror (🪞), and curated retro palettes.
  - **Timeline Strip**: Add, duplicate, delete frames, and adjust playback speed (1–12 FPS).

- **🔗 Real-Time Peer-to-Peer (P2P) Sync**:
  - Direct computer-to-computer connection via WebRTC (PeerJS) using simple room codes (e.g. `PET-7492`).
  - Live collaborative drawing, cursor presence, shared pet care, and synced quotes!

---

## 🚀 How to Run

### Run as Windows Desktop Pet (Electron)
In your terminal in `e:\Pet Project`:
```powershell
npm start
```
*Automatically builds all new updates and launches the app!*

### Run in Web Browser
```powershell
npm run dev
```

---

## ⌨️ Desktop Shortcuts

| Action | Shortcut |
| :--- | :--- |
| **Hide / Show Pet Status Bar** | `Ctrl + Shift + H` (or `Ctrl + H`) |
| **System Tray Icon** | Click paw icon in hidden icons area to toggle Studio / Pet |
