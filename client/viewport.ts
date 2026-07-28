export interface Point {
  x: number;
  y: number;
}

export class ViewportManager {
  private zoomLevel = 1.0;
  private panX = 0;
  private panY = 0;

  private minZoom = 0.1;
  private maxZoom = 5.0;

  private onViewportChange?: () => void;

  constructor(onChange?: () => void) {
    this.onViewportChange = onChange;
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  public getPan(): Point {
    return { x: this.panX, y: this.panY };
  }

  public setZoom(zoom: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (this.onViewportChange) this.onViewportChange();
  }

  public resetView(): void {
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    if (this.onViewportChange) this.onViewportChange();
  }

  public panBy(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
    if (this.onViewportChange) this.onViewportChange();
  }

  public zoomAtPoint(screenX: number, screenY: number, factor: number): void {
    const oldZoom = this.zoomLevel;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));

    if (oldZoom === newZoom) return;

    // Zoom focal point adjustment
    this.panX = screenX - (screenX - this.panX) * (newZoom / oldZoom);
    this.panY = screenY - (screenY - this.panY) * (newZoom / oldZoom);
    this.zoomLevel = newZoom;

    if (this.onViewportChange) this.onViewportChange();
  }

  public screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.panX) / this.zoomLevel,
      y: (screenY - this.panY) / this.zoomLevel
    };
  }

  public worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.zoomLevel + this.panX,
      y: worldY * this.zoomLevel + this.panY
    };
  }

  public applyToContext(ctx: CanvasRenderingContext2D, dpr: number = 1): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoomLevel, this.zoomLevel);
  }
}
