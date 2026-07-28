export type MessageHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: MessageHandler[] = [];
  private pingInterval: any = null;
  private lastPingTime = 0;
  private onPingUpdate?: (rtt: number) => void;

  constructor(onPingUpdate?: (rtt: number) => void) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;
    this.onPingUpdate = onPingUpdate;
  }

  public connect(roomId: string, userName?: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to WebSocket server');
        this.send({
          type: 'JOIN_ROOM',
          roomId,
          userName
        });
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PONG') {
            const rtt = performance.now() - this.lastPingTime;
            if (this.onPingUpdate) {
              this.onPingUpdate(rtt);
            }
            return;
          }

          this.messageHandlers.forEach((handler) => handler(data));
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('WebSocket connection closed. Reconnecting in 2s...');
        this.stopHeartbeat();
        setTimeout(() => this.connect(roomId, userName), 2000);
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    });
  }

  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = performance.now();
        this.send({ type: 'PING', timestamp: this.lastPingTime });
      }
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
