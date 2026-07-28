# Real-Time Collaborative Drawing Canvas 🎨

A high-performance, multi-user collaborative drawing application built with **Vanilla TypeScript + HTML5 Canvas** on the frontend and **Node.js + WebSockets (`ws`)** on the backend.

---

## 🚀 Setup & Quickstart Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (v9 or higher)

### 1. Installation
Clone the repository and install dependencies:
```bash
cd collaborative-canvas
npm install
```

### 2. Build the Project
Compile TypeScript for both server and client:
```bash
npm run build
```

### 3. Start the Server
Start the Express + WebSocket server:
```bash
npm start
```
The server will start at `http://localhost:3000`.

---

## 🌐 Live Deployment Guide

Since this application uses persistent, bi-directional WebSockets (`ws`), it requires a host supporting Node.js stateful web services:

### Option 1: Render (Recommended - Free Tier)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `ghemasrii/collaborative-canvas`.
3. Configure settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Click **Create Web Service**. Your live URL will be generated (e.g., `https://collaborative-canvas-xxx.onrender.com`).

### Option 2: Railway
1. Go to [Railway.app](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select `ghemasrii/collaborative-canvas`. Railway auto-detects Node.js and deploys both Express and WebSocket servers automatically.

---

## 👥 How to Test with Multiple Users

1. Open your application URL in your primary browser.
2. Open a **second browser window** (or Incognito tab).
3. Alternatively, share your live app URL with friends/colleagues.

### Multi-User Features to Test:
- **Live Real-Time Drawing**: Draw on Window A — notice how strokes render live on Window B in real-time as your mouse moves.
- **Floating Remote Cursors**: Move your cursor in Window A — Window B displays a dynamic floating cursor labeled with your assigned username and color avatar.
- **Global Undo/Redo**:
  1. User A draws a stroke.
  2. User B draws a stroke.
  3. User A presses `Undo` (or `Ctrl+Z`) — User A's stroke disappears while User B's stroke stays intact.
  4. User A presses `Redo` (or `Ctrl+Y`) — User A's stroke reappears in exact chronological depth order.
- **Room Isolation**: Change the room input from `default` to `room-2` and click **Join**. Notice that drawing events in `room-2` do not leak into `default`.
- **Keyboard Shortcuts**:
  - `B`: Brush tool
  - `E`: Eraser tool
  - `R`: Rectangle tool
  - `C`: Circle tool
  - `L`: Line tool
  - `T`: Text tool
  - `Ctrl + Z`: Undo
  - `Ctrl + Y` or `Ctrl + Shift + Z`: Redo

---

## ⏱️ Time Spent on Project
- **Architecture & System Design**: 4 hours
- **Canvas Engine & Curve Smoothing**: 5 hours
- **WebSocket Protocol & Real-time Synchronization**: 4 hours
- **Global Undo/Redo & Conflict Resolution**: 5 hours
- **UI Design (Glassmorphic Theme, Avatars, Metrics)**: 3 hours
- **Documentation & Testing**: 3 hours
- **Total Time**: ~24 hours over 3 days

---

## ⚠️ Known Limitations

1. **Memory Bounds**: Drawing history is maintained in server memory per room. For production scaling with millions of operations, room snapshots could be persisted to Redis or MongoDB.
2. **Text Editing**: Text elements are committed on placement; editing existing text shapes on canvas requires vector object selection.
3. **High Latency Networks**: Under extreme network latency (>500ms), remote live cursor updates are smoothed via CSS transforms, but stroke completion waits for `DRAW_END` packet.

---

## 📜 License
MIT License.
