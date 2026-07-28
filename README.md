# Real-Time Collaborative Drawing Canvas 🎨

A high-performance, multi-user collaborative drawing application built with **Vanilla TypeScript + HTML5 Canvas** on the frontend and **Node.js + WebSockets (`ws`)** on the backend.

Live Demo Repository: [https://github.com/ghemasrii/collaborative-canvas](https://github.com/ghemasrii/collaborative-canvas)

---

## 📋 Table of Contents
- [✨ Key Features](#-key-features)
- [📁 Project Architecture & File Structure](#-project-architecture--file-structure)
- [🚀 Setup & Quickstart Instructions](#-setup--quickstart-instructions)
- [🌐 Live Deployment Guide](#-live-deployment-guide)
- [👥 How to Test with Multiple Users](#-how-to-test-with-multiple-users)
- [🛠️ Tech Stack & Technical Challenges](#️-tech-stack--technical-challenges)
- [⏱️ Time Spent on Project](#️-time-spent-on-project)
- [⚠️ Known Limitations](#️-known-limitations)
- [📜 License](#-license)

---

## ✨ Key Features

- **🎨 Multi-Tool Vector Canvas Engine**:
  - **Brush**: Smooth vector drawing with custom colors, size slider, and alpha.
  - **Eraser**: Precise composite operation (`destination-out`) erasing.
  - **Shapes**: Rectangle, Circle, and Line drawing with real-time drag preview on an overlay canvas layer.
  - **Text**: Click-to-place text entry tool.
- **📈 Path Smoothing**: Uses Quadratic Bézier curve interpolation (`quadraticCurveTo`) across midpoints for smooth vector curves at 60 FPS.
- **⚡ Real-Time WebSocket Synchronization**:
  - Streams stroke points as users draw in real-time (~16ms/60fps throttle).
  - Floating remote cursor pointers with custom user avatars, name tags, and assigned colors.
  - Online user presence list and active room indicator.
- **🔄 Global Undo / Redo Engine**:
  - Server acts as the canonical source of truth for drawing history.
  - Global undo invalidates a specific user's action while preserving all other users' overlapping or subsequent drawing actions.
  - Deterministic client-side re-rendering guarantees canvas consistency across all connected devices.
- **🏠 Multi-Room System**:
  - Isolated canvas rooms support URL sharing (`?room=room-name`) or manual room joining.
- **📊 Real-Time Metrics & Controls**:
  - Real-time FPS monitor & WebSocket round-trip time (RTT) latency display.
  - Export drawing as PNG (`Save PNG`).
  - Mobile touch support (`touchstart`, `touchmove`, `touchend`).
  - Keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`, `B`, `E`, `R`, `C`, `L`, `T`).

---

## 📁 Project Architecture & File Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # HTML5 shell & dark glassmorphism layout
│   ├── style.css           # UI design, floating toolbars, user avatars & badges
│   ├── canvas.ts           # 2D Canvas engine, path smoothing & shape rendering
│   ├── websocket.ts        # Client WebSocket sync manager & latency ping
│   ├── history.ts          # Client-side action state history manager
│   ├── cursors.ts          # Floating remote user cursor renderer
│   ├── metrics.ts          # Real-time FPS & ping display monitor
│   └── main.ts             # App bootstrap, mouse/touch events & keyboard shortcuts
├── server/
│   ├── server.ts           # Express HTTP server & WebSocket router
│   ├── rooms.ts            # Multi-room session management & user avatars
│   └── drawing-state.ts    # Canonical operation history & global undo/redo engine
├── dist/                   # Compiled JavaScript distribution output
├── package.json            # Dependencies & npm build scripts
├── tsconfig.json           # Root TypeScript configuration
├── tsconfig.server.json    # Server TypeScript build configuration
├── tsconfig.client.json    # Client ESNext TypeScript build configuration
├── render.yaml             # Render 1-click deployment configuration
├── README.md               # Quickstart, setup, testing guide & project details
└── ARCHITECTURE.md          # Technical documentation & protocol specifications
```

---

## 🚀 Setup & Quickstart Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (v9 or higher)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/ghemasrii/collaborative-canvas.git
cd collaborative-canvas
npm install
```

### 2. Build the Project
Compile TypeScript for both server and client:
```bash
npm run build
```

### 3. Start the Application
Start the server:
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🌐 Live Deployment Guide

Since this application uses persistent, bi-directional WebSockets (`ws`), it requires a stateful Node.js host:

### Deploying on Render (Free Tier):
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `ghemasrii/collaborative-canvas`.
3. Render automatically detects settings via `render.yaml`:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Click **Create Web Service**. Your live URL will be generated (e.g., `https://collaborative-canvas-xxx.onrender.com`).

---

## 👥 How to Test with Multiple Users

1. Open your local or deployed application URL in your primary browser window.
2. Open a **second browser window** (or Incognito tab).
3. Draw or move your mouse in Window 1 and observe real-time synchronization in Window 2.

### Multi-User Verification Scenarios:
- **Live Stroke Synchronization**: Strokes stream live as your mouse/finger moves.
- **Floating Remote Cursors**: Dynamic cursor pointers follow remote user mouse coordinates with name tags and color badges.
- **Global Undo/Redo Test**:
  1. User A draws stroke A1.
  2. User B draws stroke B1.
  3. User A presses `Undo` (or `Ctrl+Z`) — Stroke A1 is undone while Stroke B1 remains intact.
  4. User A presses `Redo` (or `Ctrl+Y`) — Stroke A1 reappears in exact depth order.
- **Room Isolation**: Switch room name to `room-2` and click **Join**. Verify strokes in `room-2` do not leak into `default`.

---

## 🛠️ Tech Stack & Technical Challenges

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Vanilla TypeScript + HTML5 Canvas API | Raw 2D rendering, path math, custom UI (No React/Vue, No Canvas libraries). |
| **Backend** | Node.js + Express + `ws` | Stateful WebSocket server, room router, operation log. |
| **Styling** | Vanilla CSS3 | Dark-mode Glassmorphism UI, CSS custom properties, responsive layout. |
| **Build Tools** | TypeScript Compiler (`tsc`) | Clean separation of server (`CommonJS`) and client (`ESNext`) build outputs. |

---

## ⏱️ Time Spent on Project

| Task / Component | Hours Spent |
| :--- | :--- |
| **Architecture & System Design** | 4 hours |
| **Canvas Engine & Curve Smoothing** | 5 hours |
| **WebSocket Protocol & Real-time Synchronization** | 4 hours |
| **Global Undo/Redo Engine & Conflict Resolution** | 5 hours |
| **UI/UX Design (Glassmorphic Theme, Avatars, Metrics)** | 3 hours |
| **Documentation & Testing** | 3 hours |
| **Total Time** | **~24 hours over 3 days** |

---

## ⚠️ Known Limitations

1. **In-Memory History**: Operation logs are maintained in server memory per room. For enterprise scaling, room snapshots could be persisted to Redis or MongoDB.
2. **Vector Selection**: Text and shape objects are committed on placement; editing existing shapes after placement requires vector object selection controls.
3. **High Latency Networks**: Under extreme network latency (>500ms), remote live cursor updates are smoothed via CSS transforms, but stroke completion waits for `DRAW_END` packet.

---

## 📜 License
MIT License.
