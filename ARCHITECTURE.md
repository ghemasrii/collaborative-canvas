# Architecture & Technical Documentation 🏗️

This document details the architectural decisions, synchronization protocols, conflict resolution strategies, and performance optimizations implemented in the **Real-Time Collaborative Drawing Canvas**.

---

## 📊 Data Flow Diagram

```
 +------------------+                 +---------------------+                 +------------------+
 |  Client A (DOM)  |                 |  Node.js WS Server  |                 |  Client B (DOM)  |
 +--------+---------+                 +----------+----------+                 +--------+---------+
          |                                      |                                     |
          | --- 1. DRAW_START (actionId) ------> |                                     |
          | --- 2. DRAW_MOVE (point) ---------> | --- Broadcast DRAW_START/MOVE ----> | (Renders on
          | --- 3. DRAW_END (points) ---------> | --- Broadcast DRAW_END -----------> |  Overlay Canvas)
          |                                      |                                     |
          |                                      | Store Action in                     |
          |                                      | Room DrawingState                   |
          |                                      |                                     |
          | --- 4. UNDO Request --------------> |                                     |
          |                                      | Soft-delete Action (undone: true)   |
          |                                      |                                     |
          | <--- 5. STATE_MUTATED ------------- | --- Broadcast STATE_MUTATED ------> |
          |                                      |                                     |
    (Re-renders                              (Re-renders                           (Re-renders
     Main Canvas)                            Main Canvas)                           Main Canvas)
```

---

## 🌐 WebSocket Protocol Specification

All communication between client and server uses JSON messages over native WebSockets (`ws`).

### 1. Client -> Server Messages

| Event Type | Payload | Description |
| :--- | :--- | :--- |
| `JOIN_ROOM` | `{ roomId: string, userName?: string }` | Client requests to join a room. |
| `DRAW_START` | `{ actionId: string, tool: ToolType, color: string, strokeWidth: number, point: Point }` | Emitted on `mousedown` / `touchstart` when user starts drawing. |
| `DRAW_MOVE` | `{ actionId: string, point: Point }` | Emitted on `mousemove` / `touchmove` (throttled at ~16ms/60fps). |
| `DRAW_END` | `{ actionId: string, tool: ToolType, color: string, strokeWidth: number, points: Point[], text?: string }` | Emitted on `mouseup` / `touchend` with final points. |
| `CURSOR_MOVE`| `{ x: number, y: number }` | Throttled cursor coordinates (~30ms) for floating user indicators. |
| `UNDO` | `{}` | Triggers global undo for user's last active action. |
| `REDO` | `{}` | Triggers global redo for user's last undone action. |
| `CLEAR_CANVAS`| `{}` | Triggers canvas reset for current room. |
| `PING` | `{ timestamp: number }` | Heartbeat latency ping measurement packet. |

### 2. Server -> Client Messages

| Event Type | Payload | Description |
| :--- | :--- | :--- |
| `INIT_STATE` | `{ user: UserProfile, roomId: string, onlineUsers: UserProfile[], actions: DrawingAction[] }` | Sent immediately after joining room to hydrate client state. |
| `USER_JOINED` | `{ user: UserProfile, onlineUsers: UserProfile[] }` | Broadcasted when a new user enters the room. |
| `USER_LEFT` | `{ userId: string, userName: string, onlineUsers: UserProfile[] }` | Broadcasted when a user disconnects. |
| `DRAW_START` | `{ actionId, userId, userName, userColor, tool, color, strokeWidth, point }` | Broadcasted live to all room members (except sender). |
| `DRAW_MOVE` | `{ actionId, userId, point }` | Broadcasted live during stroke movement. |
| `DRAW_END` | `{ action: DrawingAction }` | Broadcasted when stroke is finalized and added to canonical state. |
| `STATE_MUTATED`| `{ actionType: 'undo'|'redo'|'clear', mutatedBy: string, actions: DrawingAction[] }` | Broadcasted on undo/redo/clear; triggers deterministic re-render. |
| `PONG` | `{ timestamp: number }` | Returns ping packet to compute round-trip time (RTT). |

---

## 🔄 Global Undo/Redo Strategy (The Hard Part!)

### The Challenge
In a multi-user collaborative environment, naive stack-based undo (`history.pop()`) fails because User A undoing their previous stroke would inadvertently delete User B's overlapping or subsequent work.

### Our Solution: Canonical Operation Log with Invalidation
1. **Server as Single Source of Truth**:
   The server maintains a chronological array of `DrawingAction` objects per room.
   ```typescript
   export interface DrawingAction {
     id: string;
     userId: string;
     userName: string;
     userColor: string;
     tool: ToolType;
     color: string;
     strokeWidth: number;
     points: Point[];
     text?: string;
     timestamp: number;
     undone: boolean; // Soft-delete flag
   }
   ```

2. **User-Scoped Soft-Delete**:
   When User A clicks **Undo**:
   - The server traverses the action array in reverse order to find the latest action created by User A where `undone === false`.
   - It sets `action.undone = true` (soft-delete).
   - If User A has no active actions, it falls back to the latest active action overall.
   - Server broadcasts `STATE_MUTATED` containing the updated list of active actions.

3. **Deterministic Canvas Re-Rendering**:
   - When clients receive `STATE_MUTATED`, they clear their main persistent canvas (`ctx.clearRect`).
   - Clients iterate through the active actions in chronological order and redraw each operation on the main canvas layer.
   - Erasing operations (`destination-out`) and shape overlays maintain complete visual fidelity and correct depth ordering!

---

## ⚔️ Conflict Resolution Strategy

When multiple users draw in overlapping areas simultaneously:
1. **Live Stroke Layer Isolation**:
   In-progress strokes stream to an **Overlay Canvas Layer**. User A and User B can draw over the exact same spot simultaneously without interrupting each other's live rendering loop.
2. **Server Depth Ordering**:
   As users finish strokes (`DRAW_END`), the server assigns a canonical timestamp and appends the stroke to the room's operation list.
3. **Composite Operation Preservation**:
   Because actions are rendered sequentially in server-determined order, erasing operations (`destination-out`) operate on the canvas state as it existed up to that point in history, avoiding visual corruptions or race conditions.

---

## ⚡ Performance Optimization Decisions

1. **Multi-Layer Canvas Double-Buffering**:
   - **Main Canvas (`#main-canvas`)**: Only redrawn when a stroke finishes or when Undo/Redo occurs.
   - **Overlay Canvas (`#overlay-canvas`)**: Redrawn on `requestAnimationFrame` during active local/remote drawing.
   - **Benefits**: Prevents expensive full-canvas clears and redraws during high-frequency mouse movements.

2. **Path Smoothing via Quadratic Bézier Curves**:
   - Instead of drawing straight segments between points (`lineTo`), we compute midpoints between consecutive coordinates and use `quadraticCurveTo`.
   - **Result**: Ultra-smooth vector lines even with fast hand gestures, eliminating pixelated corners.

3. **High-DPI Display Support**:
   - Canvas resolution is scaled by `window.devicePixelRatio` to prevent blurriness on Retina and 4K screens.

4. **Event Throttling & Batching**:
   - Mouse move & cursor events are throttled at ~16ms and ~30ms using `performance.now()`, keeping network payload overhead low while maintaining a silky smooth 60 FPS experience.
