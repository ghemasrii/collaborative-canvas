export class MetricsManager {
  private fpsDisplay: HTMLElement | null;
  private pingDisplay: HTMLElement | null;

  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 60;
  private pingTime = 0;

  constructor() {
    this.fpsDisplay = document.getElementById('fps-display');
    this.pingDisplay = document.getElementById('ping-display');
  }

  public recordFrame(): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.updateUI();
    }
  }

  public updatePing(rttMs: number): void {
    this.pingTime = Math.round(rttMs);
    this.updateUI();
  }

  private updateUI(): void {
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = `${this.currentFps} FPS`;
    }
    if (this.pingDisplay) {
      this.pingDisplay.textContent = `${this.pingTime} ms`;
    }
  }
}
