export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'brush' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text';

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
  undone: boolean;
}

export interface InProgressStroke {
  actionId: string;
  userId: string;
  tool: ToolType;
  color: string;
  strokeWidth: number;
  points: Point[];
  text?: string;
}

export class CanvasManager {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  private dpr = 1;
  private width = 0;
  private height = 0;

  // Remote in-progress strokes (live streaming before DRAW_END)
  private remoteLiveStrokes = new Map<string, InProgressStroke>();

  constructor(mainCanvasId: string, overlayCanvasId: string) {
    this.mainCanvas = document.getElementById(mainCanvasId) as HTMLCanvasElement;
    this.mainCtx = this.mainCanvas.getContext('2d', { willReadFrequently: true })!;
    this.overlayCanvas = document.getElementById(overlayCanvasId) as HTMLCanvasElement;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public resizeCanvas(): void {
    const container = this.mainCanvas.parentElement;
    if (!container) return;

    this.dpr = window.devicePixelRatio || 1;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Save main canvas content before resize
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.mainCanvas.width;
    tempCanvas.height = this.mainCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && this.mainCanvas.width > 0 && this.mainCanvas.height > 0) {
      tempCtx.drawImage(this.mainCanvas, 0, 0);
    }

    // Set actual pixel resolution
    this.mainCanvas.width = this.width * this.dpr;
    this.mainCanvas.height = this.height * this.dpr;
    this.overlayCanvas.width = this.width * this.dpr;
    this.overlayCanvas.height = this.height * this.dpr;

    // Scale context to support high DPI displays
    this.mainCtx.scale(this.dpr, this.dpr);
    this.overlayCtx.scale(this.dpr, this.dpr);

    // Restore content or request redraw
    if (tempCtx && tempCanvas.width > 0 && tempCanvas.height > 0) {
      this.mainCtx.save();
      this.mainCtx.scale(1 / this.dpr, 1 / this.dpr);
      this.mainCtx.drawImage(tempCanvas, 0, 0);
      this.mainCtx.restore();
    }
  }

  public clearOverlay(): void {
    this.overlayCtx.clearRect(0, 0, this.width, this.height);
  }

  public clearMain(): void {
    this.mainCtx.clearRect(0, 0, this.width, this.height);
  }

  public drawActionOnContext(ctx: CanvasRenderingContext2D, action: DrawingAction | InProgressStroke): void {
    const { tool, color, strokeWidth, points, text } = action;
    if (!points || points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }

    switch (tool) {
      case 'brush':
      case 'eraser': {
        if (points.length === 1) {
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, strokeWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (points.length === 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.stroke();
        }
        break;
      }

      case 'line': {
        const start = points[0];
        const end = points[points.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }

      case 'rectangle': {
        const start = points[0];
        const end = points[points.length - 1];
        const rectWidth = end.x - start.x;
        const rectHeight = end.y - start.y;
        ctx.beginPath();
        ctx.strokeRect(start.x, start.y, rectWidth, rectHeight);
        break;
      }

      case 'circle': {
        const start = points[0];
        const end = points[points.length - 1];
        const radius = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'text': {
        if (text) {
          const start = points[0];
          ctx.font = `${Math.max(14, strokeWidth * 3)}px Inter, sans-serif`;
          ctx.fillText(text, start.x, start.y);
        }
        break;
      }
    }

    ctx.restore();
  }

  public renderActionOnMain(action: DrawingAction): void {
    this.drawActionOnContext(this.mainCtx, action);
  }

  public renderActions(actions: DrawingAction[]): void {
    this.clearMain();
    actions.forEach((action) => {
      if (!action.undone) {
        this.renderActionOnMain(action);
      }
    });
  }

  // Remote live streaming methods
  public startRemoteStroke(stroke: InProgressStroke): void {
    this.remoteLiveStrokes.set(stroke.actionId, stroke);
    this.redrawOverlay();
  }

  public moveRemoteStroke(actionId: string, point: Point): void {
    const stroke = this.remoteLiveStrokes.get(actionId);
    if (stroke) {
      stroke.points.push(point);
      this.redrawOverlay();
    }
  }

  public endRemoteStroke(actionId: string): void {
    this.remoteLiveStrokes.delete(actionId);
    this.redrawOverlay();
  }

  public redrawOverlay(currentLocalStroke?: InProgressStroke): void {
    this.clearOverlay();

    // Render remote in-progress live strokes
    this.remoteLiveStrokes.forEach((stroke) => {
      this.drawActionOnContext(this.overlayCtx, stroke);
    });

    // Render active local stroke
    if (currentLocalStroke) {
      this.drawActionOnContext(this.overlayCtx, currentLocalStroke);
    }
  }

  public exportPNG(): void {
    // Combine main canvas with background
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.mainCanvas.width;
    exportCanvas.height = this.mainCanvas.height;
    const ctx = exportCanvas.getContext('2d')!;

    // Fill dark canvas background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw main drawing canvas on top
    ctx.drawImage(this.mainCanvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `collab-canvas-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }
}
