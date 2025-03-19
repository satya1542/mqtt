class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageListeners: ((data: any) => void)[] = [];
  private statusListeners: ((status: 'connected' | 'disconnected' | 'error', error?: Error) => void)[] = [];
  private reconnectTimer: number | null = null;
  private isConnecting: boolean = false;

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Use the specific WebSocket path to avoid conflicts with Vite's WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.notifyStatusListeners('connected');
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.notifyStatusListeners('disconnected');
        this.socket = null;
        
        // Auto-reconnect after 3 seconds
        this.reconnectTimer = window.setTimeout(() => {
          this.connect();
        }, 3000);
      };

      this.socket.onerror = (event) => {
        console.error('WebSocket error:', event);
        this.isConnecting = false;
        this.notifyStatusListeners('error', new Error('WebSocket connection error'));
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyMessageListeners(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.notifyStatusListeners('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  disconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendMessage(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.error('Cannot send message, WebSocket not connected');
    }
  }

  addMessageListener(listener: (data: any) => void) {
    this.messageListeners.push(listener);
  }

  removeMessageListener(listener: (data: any) => void) {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  addStatusListener(listener: (status: 'connected' | 'disconnected' | 'error', error?: Error) => void) {
    this.statusListeners.push(listener);
  }

  removeStatusListener(listener: (status: 'connected' | 'disconnected' | 'error', error?: Error) => void) {
    this.statusListeners = this.statusListeners.filter(l => l !== listener);
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private notifyMessageListeners(data: any) {
    this.messageListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }

  private notifyStatusListeners(status: 'connected' | 'disconnected' | 'error', error?: Error) {
    this.statusListeners.forEach(listener => {
      try {
        listener(status, error);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }
}

// Export a singleton instance
export const wsClient = new WebSocketClient();