import { CanvasManager, ToolType, Point, InProgressStroke, DrawingAction } from './canvas.js';
import { WebSocketClient } from './websocket.js';
import { CursorManager } from './cursors.js';
import { MetricsManager } from './metrics.js';
import { HistoryManager } from './history.js';

class App {
  private canvasManager: CanvasManager;
  private wsClient: WebSocketClient;
  private cursorManager: CursorManager;
  private metricsManager: MetricsManager;
  private historyManager: HistoryManager;

  private currentTool: ToolType = 'brush';
  private currentColor = '#3B82F6';
  private currentSize = 5;

  private isDrawing = false;
  private currentActionId: string | null = null;
  private currentPoints: Point[] = [];

  private currentUser: { id: string; name: string; color: string } | null = null;
  private currentRoom = 'default';

  private lastCursorSend = 0;

  constructor() {
    this.metricsManager = new MetricsManager();
    this.cursorManager = new CursorManager();
    this.historyManager = new HistoryManager();
    this.canvasManager = new CanvasManager('main-canvas', 'overlay-canvas');

    this.wsClient = new WebSocketClient((rtt) => {
      this.metricsManager.updatePing(rtt);
    });

    this.initUI();
    this.initWebSocket();
    this.initCanvasEvents();
    this.initKeyboardShortcuts();
    this.startRenderLoop();
  }

  private initUI(): void {
    // Room selection & URL param sync
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.currentRoom = roomParam;
    }
    const roomInput = document.getElementById('room-input') as HTMLInputElement;
    if (roomInput) {
      roomInput.value = this.currentRoom;
    }

    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => {
        const newRoom = roomInput.value.trim() || 'default';
        this.switchRoom(newRoom);
      });
    }

    const shareBtn = document.getElementById('share-room-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(this.currentRoom)}`;
        navigator.clipboard.writeText(shareUrl);
        alert(`Room link copied to clipboard:\n${shareUrl}`);
      });
    }

    // Tool selectors
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.currentTool = (target.dataset.tool as ToolType) || 'brush';
      });
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.currentColor = (e.target as HTMLInputElement).value;
        this.updateActiveSwatch(this.currentColor);
      });
    }

    // Color swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const color = target.dataset.color || '#3B82F6';
        this.currentColor = color;
        if (colorPicker) colorPicker.value = color;
        this.updateActiveSwatch(color);
      });
    });

    // Size slider
    const sizeSlider = document.getElementById('size-slider') as HTMLInputElement;
    const sizeValue = document.getElementById('size-value');
    if (sizeSlider && sizeValue) {
      sizeSlider.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        this.currentSize = val;
        sizeValue.textContent = `${val}px`;
      });
    }

    // Action buttons
    document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());
    document.getElementById('clear-btn')?.addEventListener('click', () => this.clearCanvas());
    document.getElementById('save-btn')?.addEventListener('click', () => this.canvasManager.exportPNG());
  }

  private updateActiveSwatch(color: string): void {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach((swatch) => {
      const el = swatch as HTMLElement;
      if (el.dataset.color?.toLowerCase() === color.toLowerCase()) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  private switchRoom(newRoom: string): void {
    this.currentRoom = newRoom;
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(newRoom)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    this.cursorManager.clearAll();
    this.historyManager.clear();
    this.canvasManager.clearMain();
    this.canvasManager.clearOverlay();

    this.wsClient.connect(this.currentRoom);
  }

  private initWebSocket(): void {
    this.wsClient.connect(this.currentRoom);

    this.wsClient.onMessage((data) => {
      switch (data.type) {
        case 'INIT_STATE':
          this.currentUser = data.user;
          this.updateUserBadge(data.user);
          this.updateOnlineUsers(data.onlineUsers);
          this.historyManager.setActions(data.actions);
          this.canvasManager.renderActions(this.historyManager.getActiveActions());
          break;

        case 'USER_JOINED':
          this.updateOnlineUsers(data.onlineUsers);
          break;

        case 'USER_LEFT':
          this.updateOnlineUsers(data.onlineUsers);
          this.cursorManager.removeCursor(data.userId);
          break;

        case 'CURSOR_MOVE':
          this.cursorManager.updateCursor({
            userId: data.userId,
            userName: data.userName,
            userColor: data.userColor,
            x: data.x,
            y: data.y
          });
          break;

        case 'DRAW_START':
          this.canvasManager.startRemoteStroke({
            actionId: data.actionId,
            userId: data.userId,
            tool: data.tool,
            color: data.color,
            strokeWidth: data.strokeWidth,
            points: [data.point]
          });
          break;

        case 'DRAW_MOVE':
          this.canvasManager.moveRemoteStroke(data.actionId, data.point);
          break;

        case 'DRAW_END':
          this.canvasManager.endRemoteStroke(data.action.id);
          this.historyManager.addAction(data.action);
          this.canvasManager.renderActionOnMain(data.action);
          break;

        case 'STATE_MUTATED':
          this.historyManager.setActions(data.actions);
          this.canvasManager.renderActions(this.historyManager.getActiveActions());
          break;
      }
    });
  }

  private updateUserBadge(user: { name: string; color: string }): void {
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = `${user.name} (You)`;
    if (avatarEl) avatarEl.style.backgroundColor = user.color;
  }

  private updateOnlineUsers(users: Array<{ id: string; name: string; color: string }>): void {
    const listEl = document.getElementById('online-users-list');
    const countEl = document.getElementById('online-count');

    if (countEl) countEl.textContent = `${users.length} online`;

    if (listEl) {
      listEl.innerHTML = '';
      users.slice(0, 5).forEach((u) => {
        const badge = document.createElement('div');
        badge.className = 'online-avatar-badge';
        badge.style.backgroundColor = u.color;
        badge.textContent = u.name.charAt(0).toUpperCase();
        badge.title = u.name;
        listEl.appendChild(badge);
      });

      if (users.length > 5) {
        const extra = document.createElement('div');
        extra.className = 'online-avatar-badge';
        extra.style.backgroundColor = '#475569';
        extra.textContent = `+${users.length - 5}`;
        listEl.appendChild(extra);
      }
    }
  }

  private getCanvasPoint(e: MouseEvent | Touch): Point {
    const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private initCanvasEvents(): void {
    const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;

    // Mouse events
    overlay.addEventListener('mousedown', (e) => this.handleStart(this.getCanvasPoint(e)));
    overlay.addEventListener('mousemove', (e) => {
      const point = this.getCanvasPoint(e);
      this.handleMove(point);
      this.sendCursorPosition(point);
    });
    overlay.addEventListener('mouseup', () => this.handleEnd());
    overlay.addEventListener('mouseleave', () => this.handleEnd());

    // Touch events for mobile support
    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        this.handleStart(this.getCanvasPoint(e.touches[0]));
      }
    });
    overlay.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        const point = this.getCanvasPoint(e.touches[0]);
        this.handleMove(point);
        this.sendCursorPosition(point);
      }
    });
    overlay.addEventListener('touchend', () => this.handleEnd());
  }

  private sendCursorPosition(point: Point): void {
    const now = performance.now();
    if (now - this.lastCursorSend > 30) {
      this.wsClient.send({
        type: 'CURSOR_MOVE',
        x: Math.round(point.x),
        y: Math.round(point.y)
      });
      this.lastCursorSend = now;
    }
  }

  private handleStart(point: Point): void {
    if (this.currentTool === 'text') {
      const text = prompt('Enter text to place on canvas:');
      if (text) {
        const actionId = 'act_' + Math.random().toString(36).substring(2, 9);
        const action: DrawingAction = {
          id: actionId,
          userId: this.currentUser?.id || 'local',
          userName: this.currentUser?.name || 'Local',
          userColor: this.currentUser?.color || '#3B82F6',
          tool: 'text',
          color: this.currentColor,
          strokeWidth: this.currentSize,
          points: [point],
          text,
          timestamp: Date.now(),
          undone: false
        };

        this.wsClient.send({
          type: 'DRAW_END',
          actionId,
          tool: 'text',
          color: this.currentColor,
          strokeWidth: this.currentSize,
          points: [point],
          text
        });

        this.canvasManager.renderActionOnMain(action);
      }
      return;
    }

    this.isDrawing = true;
    this.currentActionId = 'act_' + Math.random().toString(36).substring(2, 9);
    this.currentPoints = [point];

    this.wsClient.send({
      type: 'DRAW_START',
      actionId: this.currentActionId,
      tool: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.currentSize,
      point
    });

    this.updateOverlay();
  }

  private handleMove(point: Point): void {
    if (!this.isDrawing || !this.currentActionId) return;

    this.currentPoints.push(point);

    this.wsClient.send({
      type: 'DRAW_MOVE',
      actionId: this.currentActionId,
      point
    });

    this.updateOverlay();
  }

  private handleEnd(): void {
    if (!this.isDrawing || !this.currentActionId) return;

    this.wsClient.send({
      type: 'DRAW_END',
      actionId: this.currentActionId,
      tool: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.currentSize,
      points: this.currentPoints
    });

    this.isDrawing = false;
    this.currentActionId = null;
    this.currentPoints = [];
    this.canvasManager.clearOverlay();
  }

  private updateOverlay(): void {
    if (this.isDrawing && this.currentActionId) {
      const localStroke: InProgressStroke = {
        actionId: this.currentActionId,
        userId: this.currentUser?.id || 'local',
        tool: this.currentTool,
        color: this.currentColor,
        strokeWidth: this.currentSize,
        points: this.currentPoints
      };
      this.canvasManager.redrawOverlay(localStroke);
    } else {
      this.canvasManager.redrawOverlay();
    }
  }

  private undo(): void {
    this.wsClient.send({ type: 'UNDO' });
  }

  private redo(): void {
    this.wsClient.send({ type: 'REDO' });
  }

  private clearCanvas(): void {
    if (confirm('Are you sure you want to clear the canvas for everyone in this room?')) {
      this.wsClient.send({ type: 'CLEAR_CANVAS' });
    }
  }

  private initKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.key.toLowerCase() === 'b') {
        this.selectTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        this.selectTool('eraser');
      } else if (e.key.toLowerCase() === 'r') {
        this.selectTool('rectangle');
      } else if (e.key.toLowerCase() === 'c') {
        this.selectTool('circle');
      } else if (e.key.toLowerCase() === 'l') {
        this.selectTool('line');
      } else if (e.key.toLowerCase() === 't') {
        this.selectTool('text');
      }
    });
  }

  private selectTool(tool: ToolType): void {
    this.currentTool = tool;
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.tool === tool) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.metricsManager.recordFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
