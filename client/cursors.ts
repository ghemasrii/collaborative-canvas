import { ViewportManager } from './viewport';

export interface RemoteCursorData {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
}

export class CursorManager {
  private container: HTMLElement;
  private cursors = new Map<string, HTMLElement>();
  private lastCursorData = new Map<string, RemoteCursorData>();
  private viewport?: ViewportManager;

  constructor(viewport?: ViewportManager) {
    this.container = document.getElementById('cursors-layer') || document.body;
    this.viewport = viewport;
  }

  public setViewport(viewport: ViewportManager): void {
    this.viewport = viewport;
    this.refreshAll();
  }

  public updateCursor(data: RemoteCursorData): void {
    this.lastCursorData.set(data.userId, data);

    let cursorEl = this.cursors.get(data.userId);

    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.className = 'remote-cursor';
      cursorEl.innerHTML = `
        <svg class="cursor-pointer" viewBox="0 0 24 24" fill="${data.userColor}" stroke="#ffffff" stroke-width="1.5">
          <path d="M5.5 3.21l10.8 15.6a1 1 0 01-1.51 1.25l-3.37-2.73a1 1 0 00-1.12-.07l-4.5 2.5a1 1 0 01-1.47-.98V4.1a1 1 0 011.17-.89z"/>
        </svg>
        <span class="cursor-label" style="background-color: ${data.userColor};">${data.userName}</span>
      `;
      this.container.appendChild(cursorEl);
      this.cursors.set(data.userId, cursorEl);
    }

    let screenPos = { x: data.x, y: data.y };
    if (this.viewport) {
      screenPos = this.viewport.worldToScreen(data.x, data.y);
    }

    cursorEl.style.transform = `translate3d(${screenPos.x}px, ${screenPos.y}px, 0)`;
  }

  public refreshAll(): void {
    this.lastCursorData.forEach((data) => {
      this.updateCursor(data);
    });
  }

  public removeCursor(userId: string): void {
    const cursorEl = this.cursors.get(userId);
    if (cursorEl) {
      cursorEl.remove();
      this.cursors.delete(userId);
      this.lastCursorData.delete(userId);
    }
  }

  public clearAll(): void {
    this.cursors.forEach((el) => el.remove());
    this.cursors.clear();
    this.lastCursorData.clear();
  }
}
