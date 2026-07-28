export type SloppinessLevel = 'architect' | 'artist' | 'cartoon';
export type FillStyleOption = 'none' | 'solid' | 'hatch' | 'cross-hatch';
export type DashStyleOption = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export class SketchRenderer {
  private static getJitterMultiplier(sloppiness: SloppinessLevel): number {
    switch (sloppiness) {
      case 'architect': return 0.3;
      case 'artist': return 1.2;
      case 'cartoon': return 2.5;
      default: return 1.2;
    }
  }

  private static applyDashStyle(ctx: CanvasRenderingContext2D, dashStyle: DashStyleOption, width: number): void {
    if (dashStyle === 'dashed') {
      ctx.setLineDash([width * 3, width * 2]);
    } else if (dashStyle === 'dotted') {
      ctx.setLineDash([width, width * 1.5]);
    } else {
      ctx.setLineDash([]);
    }
  }

  public static drawSketchyLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number,
    sloppiness: SloppinessLevel = 'artist',
    dashStyle: DashStyleOption = 'solid'
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.applyDashStyle(ctx, dashStyle, width);

    const mult = this.getJitterMultiplier(sloppiness);
    const passes = sloppiness === 'architect' ? 1 : 2;

    for (let p = 0; p < passes; p++) {
      const offsetX1 = (Math.random() - 0.5) * mult * 2;
      const offsetY1 = (Math.random() - 0.5) * mult * 2;
      const offsetX2 = (Math.random() - 0.5) * mult * 2;
      const offsetY2 = (Math.random() - 0.5) * mult * 2;

      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * mult * 3;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * mult * 3;

      ctx.beginPath();
      ctx.moveTo(x1 + offsetX1, y1 + offsetY1);
      ctx.quadraticCurveTo(midX, midY, x2 + offsetX2, y2 + offsetY2);
      ctx.stroke();
    }

    ctx.restore();
  }

  public static drawSketchyRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    fillColor: string,
    width: number,
    fillStyle: FillStyleOption = 'none',
    sloppiness: SloppinessLevel = 'artist',
    dashStyle: DashStyleOption = 'solid'
  ): void {
    const rx = Math.min(x, x + w);
    const ry = Math.min(y, y + h);
    const rw = Math.abs(w);
    const rh = Math.abs(h);

    ctx.save();

    if (fillStyle !== 'none' && fillColor && fillColor !== 'transparent') {
      this.drawFillPattern(ctx, rx, ry, rw, rh, fillColor, fillStyle);
    }

    this.drawSketchyLine(ctx, rx, ry, rx + rw, ry, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, rx + rw, ry, rx + rw, ry + rh, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, rx + rw, ry + rh, rx, ry + rh, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, rx, ry + rh, rx, ry, color, width, sloppiness, dashStyle);

    ctx.restore();
  }

  public static drawSketchyCircle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    color: string,
    fillColor: string,
    width: number,
    fillStyle: FillStyleOption = 'none',
    sloppiness: SloppinessLevel = 'artist',
    dashStyle: DashStyleOption = 'solid'
  ): void {
    ctx.save();

    if (fillStyle !== 'none' && fillColor && fillColor !== 'transparent') {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      if (fillStyle === 'hatch' || fillStyle === 'cross-hatch') {
        ctx.clip();
        this.drawFillPattern(ctx, cx - radius, cy - radius, radius * 2, radius * 2, fillColor, fillStyle);
      }
      ctx.restore();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    this.applyDashStyle(ctx, dashStyle, width);

    const mult = this.getJitterMultiplier(sloppiness);
    const passes = sloppiness === 'architect' ? 1 : 2;

    for (let p = 0; p < passes; p++) {
      ctx.beginPath();
      const points = 16;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const rJitter = radius + (Math.random() - 0.5) * mult * 2.5;
        const px = cx + Math.cos(angle) * rJitter;
        const py = cy + Math.sin(angle) * rJitter;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  public static drawSketchyDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    fillColor: string,
    width: number,
    fillStyle: FillStyleOption = 'none',
    sloppiness: SloppinessLevel = 'artist',
    dashStyle: DashStyleOption = 'solid'
  ): void {
    const rx = Math.min(x, x + w);
    const ry = Math.min(y, y + h);
    const rw = Math.abs(w);
    const rh = Math.abs(h);

    const top = { x: rx + rw / 2, y: ry };
    const right = { x: rx + rw, y: ry + rh / 2 };
    const bottom = { x: rx + rw / 2, y: ry + rh };
    const left = { x: rx, y: ry + rh / 2 };

    if (fillStyle !== 'none' && fillColor && fillColor !== 'transparent') {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(left.x, left.y);
      ctx.closePath();
      ctx.fill();

      if (fillStyle === 'hatch' || fillStyle === 'cross-hatch') {
        ctx.clip();
        this.drawFillPattern(ctx, rx, ry, rw, rh, fillColor, fillStyle);
      }
      ctx.restore();
    }

    this.drawSketchyLine(ctx, top.x, top.y, right.x, right.y, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, right.x, right.y, bottom.x, bottom.y, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, bottom.x, bottom.y, left.x, left.y, color, width, sloppiness, dashStyle);
    this.drawSketchyLine(ctx, left.x, left.y, top.x, top.y, color, width, sloppiness, dashStyle);
  }

  public static drawSketchyArrow(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number,
    sloppiness: SloppinessLevel = 'artist'
  ): void {
    this.drawSketchyLine(ctx, x1, y1, x2, y2, color, width, sloppiness);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = Math.max(12, width * 3);

    const wing1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const wing1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);

    const wing2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const wing2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);

    this.drawSketchyLine(ctx, x2, y2, wing1X, wing1Y, color, width, sloppiness);
    this.drawSketchyLine(ctx, x2, y2, wing2X, wing2Y, color, width, sloppiness);
  }

  public static drawStickyNote(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
    text: string
  ): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 4, y + 4, w, h);

    ctx.fillStyle = bgColor || '#fef08a';
    ctx.fillRect(x, y, w, h);

    this.drawSketchyRect(ctx, x, y, w, h, 'rgba(0,0,0,0.2)', 'transparent', 2, 'none', 'architect');

    if (text) {
      ctx.fillStyle = '#1e293b';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.textAlign = 'start';
      ctx.textBaseline = 'top';

      const padding = 12;
      const maxWidth = w - padding * 2;
      const words = text.split(' ');
      let line = '';
      let lineY = y + padding;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, x + padding, lineY);
          line = words[n] + ' ';
          lineY += 18;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x + padding, lineY);
    }

    ctx.restore();
  }

  private static drawFillPattern(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    fillStyle: FillStyleOption
  ): void {
    ctx.save();

    if (fillStyle === 'solid') {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    } else if (fillStyle === 'hatch' || fillStyle === 'cross-hatch') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;

      const spacing = 12;
      ctx.beginPath();
      for (let i = -h; i < w + h; i += spacing) {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
      }
      ctx.stroke();

      if (fillStyle === 'cross-hatch') {
        ctx.beginPath();
        for (let i = -h; i < w + h; i += spacing) {
          ctx.moveTo(x + i, y + h);
          ctx.lineTo(x + i + h, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
