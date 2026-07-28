import { CanvasManager, ToolType, Point, InProgressStroke, DrawingAction } from './canvas.js';
import { ViewportManager } from './viewport.js';
import { WebSocketClient } from './websocket.js';
import { CursorManager } from './cursors.js';
import { MetricsManager } from './metrics.js';
import { HistoryManager } from './history.js';
import { FillStyleOption, DashStyleOption, SloppinessLevel } from './sketch-renderer.js';

class App {
  private canvasManager: CanvasManager;
  private viewportManager: ViewportManager;
  private wsClient: WebSocketClient;
  private cursorManager: CursorManager;
  private metricsManager: MetricsManager;
  private historyManager: HistoryManager;

  private currentTool: ToolType = 'brush';
  private currentColor = '#f8fafc';
  private currentFillColor = 'transparent';
  private currentFillStyle: FillStyleOption = 'none';
  private currentDashStyle: DashStyleOption = 'solid';
  private currentSloppiness: SloppinessLevel = 'artist';
  private currentSize = 3;

  private isDrawing = false;
  private isPanning = false;
  private isMovingAction = false;

  private lastPanPoint: Point = { x: 0, y: 0 };
  private selectedAction: DrawingAction | null = null;
  private moveStartPoint: Point = { x: 0, y: 0 };

  private currentActionId: string | null = null;
  private currentPoints: Point[] = [];

  private currentUser: { id: string; name: string; color: string } | null = null;
  private currentRoom = 'default';
  private currentGridStyle: 'dots' | 'mesh' | 'none' = 'dots';
  private currentTheme: 'dark' | 'light' = 'dark';

  private lastCursorSend = 0;
  private isSpacePressed = false;

  constructor() {
    this.metricsManager = new MetricsManager();
    this.historyManager = new HistoryManager();

    this.viewportManager = new ViewportManager(() => {
      this.updateZoomDisplay();
      if (this.canvasManager) {
        this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
        this.canvasManager.redrawOverlay();
      }
      if (this.cursorManager) {
        this.cursorManager.refreshAll();
      }
    });

    this.cursorManager = new CursorManager(this.viewportManager);
    this.canvasManager = new CanvasManager('main-canvas', 'overlay-canvas', this.viewportManager);

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
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.currentRoom = roomParam;
    }
    const roomInput = document.getElementById('room-input') as HTMLInputElement;
    if (roomInput) {
      roomInput.value = this.currentRoom;
    }

    document.getElementById('join-room-btn')?.addEventListener('click', () => {
      const newRoom = roomInput.value.trim() || 'default';
      this.switchRoom(newRoom);
    });

    document.getElementById('share-room-btn')?.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(this.currentRoom)}`;
      navigator.clipboard.writeText(shareUrl);
      alert(`Room share link copied to clipboard:\n${shareUrl}`);
    });

    // Tool Buttons
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectTool((target.dataset.tool as ToolType) || 'brush');
      });
    });

    // Color Swatches
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const strokePicker = document.getElementById('stroke-color-picker') as HTMLInputElement;
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        colorSwatches.forEach((s) => s.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.currentColor = target.dataset.color || '#f8fafc';
        if (strokePicker) strokePicker.value = this.currentColor;
      });
    });

    if (strokePicker) {
      strokePicker.addEventListener('input', (e) => {
        this.currentColor = (e.target as HTMLInputElement).value;
      });
    }

    // Fill Swatches
    const fillSwatches = document.querySelectorAll('.fill-swatch');
    fillSwatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        fillSwatches.forEach((s) => s.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.currentFillColor = target.dataset.fill || 'transparent';
      });
    });

    // Segmented Controls (Fill Style, Sloppiness, Dash Style)
    this.bindSegmentedControl('data-fill-style', (val) => {
      this.currentFillStyle = val as FillStyleOption;
    });

    this.bindSegmentedControl('data-sloppiness', (val) => {
      this.currentSloppiness = val as SloppinessLevel;
    });

    this.bindSegmentedControl('data-dash', (val) => {
      this.currentDashStyle = val as DashStyleOption;
    });

    // Stroke width slider
    const strokeSlider = document.getElementById('stroke-width-slider') as HTMLInputElement;
    const strokeVal = document.getElementById('stroke-width-val');
    if (strokeSlider && strokeVal) {
      strokeSlider.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        this.currentSize = val;
        strokeVal.textContent = `${val}px`;
      });
    }

    // Zoom Controls
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      this.viewportManager.zoomAtPoint(center.x, center.y, 1.2);
    });

    document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      this.viewportManager.zoomAtPoint(center.x, center.y, 0.8);
    });

    document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
      this.viewportManager.resetView();
    });

    // Grid & Theme Toggles
    const gridBtn = document.getElementById('grid-toggle-btn');
    gridBtn?.addEventListener('click', () => {
      if (this.currentGridStyle === 'dots') this.currentGridStyle = 'mesh';
      else if (this.currentGridStyle === 'mesh') this.currentGridStyle = 'none';
      else this.currentGridStyle = 'dots';

      gridBtn.textContent = `Grid: ${this.currentGridStyle.charAt(0).toUpperCase() + this.currentGridStyle.slice(1)}`;
      this.canvasManager.setGridStyle(this.currentGridStyle);
      this.canvasManager.redrawOverlay();
    });

    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn?.addEventListener('click', () => {
      this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
      document.body.className = `${this.currentTheme}-theme`;
      themeBtn.textContent = this.currentTheme === 'dark' ? '🌙 Dark' : '☀️ Light';
      this.canvasManager.setTheme(this.currentTheme);
      this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
    });

    // Action buttons
    document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());
    document.getElementById('clear-btn')?.addEventListener('click', () => this.clearCanvas());
    document.getElementById('save-btn')?.addEventListener('click', () => this.canvasManager.exportPNG());
  }

  private bindSegmentedControl(attribute: string, onChange: (val: string) => void): void {
    const buttons = document.querySelectorAll(`[${attribute}]`);
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        buttons.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const val = target.getAttribute(attribute);
        if (val) onChange(val);
      });
    });
  }

  private updateZoomDisplay(): void {
    const zoomVal = document.getElementById('zoom-val');
    if (zoomVal) {
      zoomVal.textContent = `${Math.round(this.viewportManager.getZoom() * 100)}%`;
    }
  }

  private selectTool(tool: ToolType): void {
    this.currentTool = tool;
    if (tool !== 'select') {
      this.selectedAction = null;
      this.canvasManager.renderActions(this.historyManager.getActiveActions(), null);
    }
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.tool === tool) el.classList.add('active');
      else el.classList.remove('active');
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
          this.historyManager.setActions(data.actions);
          this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
          this.updateOnlineUsers(data.onlineUsers);
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
            fillColor: data.fillColor,
            fillStyle: data.fillStyle,
            dashStyle: data.dashStyle,
            sloppiness: data.sloppiness,
            strokeWidth: data.strokeWidth,
            points: [data.point],
            text: data.text,
            noteColor: data.noteColor
          });
          break;

        case 'DRAW_MOVE':
          this.canvasManager.moveRemoteStroke(data.actionId, data.point);
          break;

        case 'DRAW_END':
          this.canvasManager.endRemoteStroke(data.action.id);
          this.historyManager.addAction(data.action);
          this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
          break;

        case 'STATE_MUTATED':
          this.historyManager.setActions(data.actions);
          this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
          break;
      }
    });
  }

  private updateOnlineUsers(users: Array<{ id: string; name: string; color: string }>): void {
    const listEl = document.getElementById('online-users-list');
    if (listEl) {
      listEl.innerHTML = '';
      users.slice(0, 5).forEach((u) => {
        const badge = document.createElement('div');
        badge.className = 'color-swatch';
        badge.style.backgroundColor = u.color;
        badge.title = u.name;
        listEl.appendChild(badge);
      });
    }
  }

  private getScreenPoint(e: MouseEvent | Touch): Point {
    const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private initCanvasEvents(): void {
    const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;

    // Zoom on Wheel
    overlay.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.viewportManager.zoomAtPoint(e.clientX, e.clientY, factor);
      },
      { passive: false }
    );

    // Pointer events for drawing & panning
    overlay.addEventListener('mousedown', (e) => {
      const screenPt = this.getScreenPoint(e);
      const worldPt = this.viewportManager.screenToWorld(screenPt.x, screenPt.y);

      // Pan canvas if Middle click, Hand tool, or Space pressed
      if (e.button === 1 || this.currentTool === 'hand' || this.isSpacePressed) {
        this.isPanning = true;
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        overlay.style.cursor = 'grabbing';
        return;
      }

      // Selection / Move tool
      if (this.currentTool === 'select') {
        const hitAction = this.canvasManager.findActionAtPoint(this.historyManager.getActiveActions(), worldPt);
        if (hitAction) {
          this.selectedAction = hitAction;
          this.isMovingAction = true;
          this.moveStartPoint = worldPt;
          this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction.id);
        } else {
          this.selectedAction = null;
          this.canvasManager.renderActions(this.historyManager.getActiveActions(), null);
        }
        return;
      }

      this.handleStart(worldPt);
    });

    overlay.addEventListener('mousemove', (e) => {
      const screenPt = this.getScreenPoint(e);
      const worldPt = this.viewportManager.screenToWorld(screenPt.x, screenPt.y);

      // Handle Viewport Pan
      if (this.isPanning) {
        const deltaX = e.clientX - this.lastPanPoint.x;
        const deltaY = e.clientY - this.lastPanPoint.y;
        this.viewportManager.panBy(deltaX, deltaY);
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        return;
      }

      // Handle Action Move
      if (this.isMovingAction && this.selectedAction) {
        const deltaX = worldPt.x - this.moveStartPoint.x;
        const deltaY = worldPt.y - this.moveStartPoint.y;
        this.moveStartPoint = worldPt;

        this.selectedAction.points = this.selectedAction.points.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }));

        this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction.id);

        this.wsClient.send({
          type: 'MOVE_ACTION',
          actionId: this.selectedAction.id,
          deltaX,
          deltaY
        });
        return;
      }

      // Send cursor position in world space
      this.sendCursorPosition(worldPt);

      if (this.isDrawing) {
        this.handleMove(worldPt);
      }
    });

    overlay.addEventListener('mouseup', () => this.handleEnd());
    overlay.addEventListener('mouseleave', () => this.handleEnd());

    // Touch support for mobile devices
    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const screenPt = this.getScreenPoint(e.touches[0]);
        const worldPt = this.viewportManager.screenToWorld(screenPt.x, screenPt.y);
        if (this.currentTool === 'hand') {
          this.isPanning = true;
          this.lastPanPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
          this.handleStart(worldPt);
        }
      }
    });

    overlay.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const screenPt = this.getScreenPoint(e.touches[0]);
        const worldPt = this.viewportManager.screenToWorld(screenPt.x, screenPt.y);
        if (this.isPanning) {
          const deltaX = e.touches[0].clientX - this.lastPanPoint.x;
          const deltaY = e.touches[0].clientY - this.lastPanPoint.y;
          this.viewportManager.panBy(deltaX, deltaY);
          this.lastPanPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (this.isDrawing) {
          this.handleMove(worldPt);
          this.sendCursorPosition(worldPt);
        }
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
      const text = prompt('Enter text for canvas:');
      if (text) {
        this.createSinglePointAction('text', point, text);
      }
      return;
    }

    if (this.currentTool === 'sticky') {
      const text = prompt('Enter sticky note text:');
      if (text !== null) {
        this.createSinglePointAction('sticky', point, text, '#fef08a');
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
      fillColor: this.currentFillColor,
      fillStyle: this.currentFillStyle,
      dashStyle: this.currentDashStyle,
      sloppiness: this.currentSloppiness,
      strokeWidth: this.currentSize,
      point
    });

    this.updateOverlay();
  }

  private createSinglePointAction(tool: ToolType, point: Point, text: string, noteColor?: string): void {
    const actionId = 'act_' + Math.random().toString(36).substring(2, 9);
    const endPoint = tool === 'sticky' ? { x: point.x + 180, y: point.y + 180 } : point;

    const action: DrawingAction = {
      id: actionId,
      userId: this.currentUser?.id || 'local',
      userName: this.currentUser?.name || 'Local',
      userColor: this.currentUser?.color || '#3b82f6',
      tool,
      color: this.currentColor,
      fillColor: this.currentFillColor,
      fillStyle: this.currentFillStyle,
      dashStyle: this.currentDashStyle,
      sloppiness: this.currentSloppiness,
      strokeWidth: this.currentSize,
      points: [point, endPoint],
      text,
      noteColor,
      timestamp: Date.now(),
      undone: false
    };

    this.wsClient.send({
      type: 'DRAW_END',
      actionId,
      tool,
      color: this.currentColor,
      fillColor: this.currentFillColor,
      fillStyle: this.currentFillStyle,
      dashStyle: this.currentDashStyle,
      sloppiness: this.currentSloppiness,
      strokeWidth: this.currentSize,
      points: [point, endPoint],
      text,
      noteColor
    });

    this.historyManager.addAction(action);
    this.canvasManager.renderActions(this.historyManager.getActiveActions(), this.selectedAction?.id);
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
    const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    overlay.style.cursor = 'default';

    this.isPanning = false;
    this.isMovingAction = false;

    if (!this.isDrawing || !this.currentActionId) return;

    this.wsClient.send({
      type: 'DRAW_END',
      actionId: this.currentActionId,
      tool: this.currentTool,
      color: this.currentColor,
      fillColor: this.currentFillColor,
      fillStyle: this.currentFillStyle,
      dashStyle: this.currentDashStyle,
      sloppiness: this.currentSloppiness,
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
        fillColor: this.currentFillColor,
        fillStyle: this.currentFillStyle,
        dashStyle: this.currentDashStyle,
        sloppiness: this.currentSloppiness,
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
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        this.isSpacePressed = true;
        const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;
        overlay.style.cursor = 'grab';
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.key.toLowerCase() === 'v') this.selectTool('select');
      else if (e.key.toLowerCase() === 'h') this.selectTool('hand');
      else if (e.key.toLowerCase() === 'b') this.selectTool('brush');
      else if (e.key.toLowerCase() === 'r') this.selectTool('rectangle');
      else if (e.key.toLowerCase() === 'd') this.selectTool('diamond');
      else if (e.key.toLowerCase() === 'c') this.selectTool('circle');
      else if (e.key.toLowerCase() === 'a') this.selectTool('arrow');
      else if (e.key.toLowerCase() === 'l') this.selectTool('line');
      else if (e.key.toLowerCase() === 't') this.selectTool('text');
      else if (e.key.toLowerCase() === 'n') this.selectTool('sticky');
      else if (e.key.toLowerCase() === 'e') this.selectTool('eraser');
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;
        overlay.style.cursor = 'default';
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

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
