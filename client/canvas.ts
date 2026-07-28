import {
  SketchRenderer,
  SloppinessLevel,
  FillStyleOption,
  DashStyleOption
} from './sketch-renderer.js';
import { ViewportManager } from './viewport.js';

export interface Point {
  x: number;
  y: number;
}

export type ToolType =
  | 'brush'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'select'
  | 'hand'
  | 'image';

export interface DrawingAction {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  tool: ToolType;
  color: string;
  fillColor?: string;
  fillStyle?: FillStyleOption;
  dashStyle?: DashStyleOption;
  sloppiness?: SloppinessLevel;
  strokeWidth: number;
  points: Point[];
  text?: string;
  noteColor?: string;
  imageUrl?: string;
  timestamp: number;
  undone: boolean;
}

export interface InProgressStroke {
  actionId: string;
  userId: string;
  tool: ToolType;
  color: string;
  fillColor?: string;
  fillStyle?: FillStyleOption;
  dashStyle?: DashStyleOption;
  sloppiness?: SloppinessLevel;
  strokeWidth: number;
  points: Point[];
  text?: string;
  noteColor?: string;
  imageUrl?: string;
}

export class CanvasManager {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  private viewport: ViewportManager;
  private dpr = 1;
  private width = 0;
  private height = 0;

  private gridStyle: 'dots' | 'mesh' | 'none' = 'dots';
  private theme: 'light' | 'dark' = 'dark';
  private canvasBgColor = '#121212';

  private remoteLiveStrokes = new Map<string, InProgressStroke>();
  private imageCache = new Map<string, HTMLImageElement>();

  constructor(mainCanvasId: string, overlayCanvasId: string, viewport: ViewportManager) {
    this.mainCanvas = document.getElementById(mainCanvasId) as HTMLCanvasElement;
    this.mainCtx = this.mainCanvas.getContext('2d')!;
    this.overlayCanvas = document.getElementById(overlayCanvasId) as HTMLCanvasElement;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.viewport = viewport;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public setGridStyle(style: 'dots' | 'mesh' | 'none'): void {
    this.gridStyle = style;
  }

  public setCanvasBgColor(color: string): void {
    this.canvasBgColor = color;
    const container = this.mainCanvas.parentElement;
    if (container) {
      container.style.backgroundColor = color;
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    const color = theme === 'light' ? '#ffffff' : '#121212';
    this.setCanvasBgColor(color);
  }

  public resizeCanvas(): void {
    const container = this.mainCanvas.parentElement;
    if (!container) return;

    this.dpr = window.devicePixelRatio || 1;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.mainCanvas.width = this.width * this.dpr;
    this.mainCanvas.height = this.height * this.dpr;
    this.overlayCanvas.width = this.width * this.dpr;
    this.overlayCanvas.height = this.height * this.dpr;
  }

  public drawGrid(ctx: CanvasRenderingContext2D): void {
    if (this.gridStyle === 'none') return;

    ctx.save();
    const zoom = this.viewport.getZoom();
    const pan = this.viewport.getPan();
    const step = 30 * zoom;

    const startX = pan.x % step;
    const startY = pan.y % step;

    ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    ctx.fillStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';

    if (this.gridStyle === 'dots') {
      for (let x = startX; x < this.width; x += step) {
        for (let y = startY; y < this.height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (this.gridStyle === 'mesh') {
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x < this.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
      }
      for (let y = startY; y < this.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  public clearOverlay(): void {
    this.overlayCtx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
    this.drawGrid(this.overlayCtx);
  }

  public clearMain(): void {
    this.mainCtx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
  }

  public drawActionOnContext(ctx: CanvasRenderingContext2D, action: DrawingAction | InProgressStroke): void {
    const {
      tool,
      color,
      fillColor = 'transparent',
      fillStyle = 'none',
      dashStyle = 'solid',
      sloppiness = 'artist',
      strokeWidth,
      points,
      text,
      noteColor,
      imageUrl
    } = action;

    if (!points || points.length === 0) return;

    const start = points[0];
    const end = points[points.length - 1];

    switch (tool) {
      case 'brush': {
        this.drawFreehand(ctx, points, color, strokeWidth);
        break;
      }

      case 'eraser': {
        this.drawFreehand(ctx, points, this.canvasBgColor, strokeWidth * 2, true);
        break;
      }

      case 'line': {
        SketchRenderer.drawSketchyLine(
          ctx,
          start.x,
          start.y,
          end.x,
          end.y,
          color,
          strokeWidth,
          sloppiness,
          dashStyle
        );
        break;
      }

      case 'arrow': {
        SketchRenderer.drawSketchyArrow(
          ctx,
          start.x,
          start.y,
          end.x,
          end.y,
          color,
          strokeWidth,
          sloppiness
        );
        break;
      }

      case 'rectangle': {
        const w = end.x - start.x;
        const h = end.y - start.y;
        SketchRenderer.drawSketchyRect(
          ctx,
          start.x,
          start.y,
          w,
          h,
          color,
          fillColor,
          strokeWidth,
          fillStyle,
          sloppiness,
          dashStyle
        );
        break;
      }

      case 'diamond': {
        const w = end.x - start.x;
        const h = end.y - start.y;
        SketchRenderer.drawSketchyDiamond(
          ctx,
          start.x,
          start.y,
          w,
          h,
          color,
          fillColor,
          strokeWidth,
          fillStyle,
          sloppiness,
          dashStyle
        );
        break;
      }

      case 'circle': {
        const radius = Math.hypot(end.x - start.x, end.y - start.y);
        SketchRenderer.drawSketchyCircle(
          ctx,
          start.x,
          start.y,
          radius,
          color,
          fillColor,
          strokeWidth,
          fillStyle,
          sloppiness,
          dashStyle
        );
        break;
      }

      case 'sticky': {
        const w = Math.max(160, end.x - start.x);
        const h = Math.max(160, end.y - start.y);
        SketchRenderer.drawStickyNote(
          ctx,
          start.x,
          start.y,
          w,
          h,
          noteColor || '#fef08a',
          text || ''
        );
        break;
      }

      case 'image': {
        if (imageUrl) {
          const w = end.x - start.x;
          const h = end.y - start.y;
          this.drawImageAction(ctx, imageUrl, start.x, start.y, w, h);
        }
        break;
      }

      case 'text': {
        if (text) {
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = `600 ${Math.max(16, strokeWidth * 4)}px Inter, sans-serif`;
          ctx.fillText(text, start.x, start.y);
          ctx.restore();
        }
        break;
      }
    }
  }

  private drawImageAction(
    ctx: CanvasRenderingContext2D,
    url: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const rx = Math.min(x, x + w);
    const ry = Math.min(y, y + h);
    const rw = Math.max(40, Math.abs(w));
    const rh = Math.max(40, Math.abs(h));

    let img = this.imageCache.get(url);
    if (img && img.complete) {
      ctx.drawImage(img, rx, ry, rw, rh);
    } else if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.redrawOverlay();
      };
      img.src = url;
      this.imageCache.set(url, img);
    }
  }

  private drawFreehand(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    width: number,
    isEraser: boolean = false
  ): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.beginPath();
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : color;
      ctx.fill();
    } else if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  public renderActions(actions: DrawingAction[], selectedActionId?: string | null): void {
    this.clearMain();
    this.mainCtx.save();
    this.viewport.applyToContext(this.mainCtx, this.dpr);

    actions.forEach((action) => {
      if (!action.undone) {
        this.drawActionOnContext(this.mainCtx, action);

        if (selectedActionId === action.id && action.points.length > 0) {
          this.drawSelectionBox(this.mainCtx, action);
        }
      }
    });

    this.mainCtx.restore();
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D, action: DrawingAction): void {
    const bbox = this.getActionBoundingBox(action);
    if (!bbox) return;

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / this.viewport.getZoom();
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bbox.x - 6, bbox.y - 6, bbox.w + 12, bbox.h + 12);

    // Render handle dots
    ctx.fillStyle = '#60a5fa';
    const handleSize = 6 / this.viewport.getZoom();
    ctx.fillRect(bbox.x - 6 - handleSize / 2, bbox.y - 6 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bbox.x + bbox.w + 6 - handleSize / 2, bbox.y - 6 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bbox.x - 6 - handleSize / 2, bbox.y + bbox.h + 6 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bbox.x + bbox.w + 6 - handleSize / 2, bbox.y + bbox.h + 6 - handleSize / 2, handleSize, handleSize);
    ctx.restore();
  }

  public getActionBoundingBox(action: DrawingAction): { x: number; y: number; w: number; h: number } | null {
    if (!action.points || action.points.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    action.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    return {
      x: minX,
      y: minY,
      w: Math.max(30, maxX - minX),
      h: Math.max(30, maxY - minY)
    };
  }

  public findActionAtPoint(actions: DrawingAction[], worldPoint: Point): DrawingAction | null {
    const active = actions.filter((a) => !a.undone);
    for (let i = active.length - 1; i >= 0; i--) {
      const action = active[i];
      const bbox = this.getActionBoundingBox(action);
      if (bbox) {
        if (
          worldPoint.x >= bbox.x - 8 &&
          worldPoint.x <= bbox.x + bbox.w + 8 &&
          worldPoint.y >= bbox.y - 8 &&
          worldPoint.y <= bbox.y + bbox.h + 8
        ) {
          return action;
        }
      }
    }
    return null;
  }

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

    this.overlayCtx.save();
    this.viewport.applyToContext(this.overlayCtx, this.dpr);

    this.remoteLiveStrokes.forEach((stroke) => {
      this.drawActionOnContext(this.overlayCtx, stroke);
    });

    if (currentLocalStroke) {
      this.drawActionOnContext(this.overlayCtx, currentLocalStroke);
    }

    this.overlayCtx.restore();
  }

  public exportPNG(): void {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.mainCanvas.width;
    exportCanvas.height = this.mainCanvas.height;
    const ctx = exportCanvas.getContext('2d')!;

    ctx.fillStyle = this.canvasBgColor;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(this.mainCanvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `excalidraw-collab-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }
}
