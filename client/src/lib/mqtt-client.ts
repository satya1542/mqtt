import mqtt from 'mqtt';
import { MQTTConnectOptions } from '../types/mqtt';
import { MQTTMessage } from '@shared/schema';

class MQTTClient {
  private client: mqtt.MqttClient | null = null;
  private listeners: { [key: string]: ((message: MQTTMessage) => void)[] } = {};
  private statusListeners: ((status: 'disconnected' | 'connecting' | 'connected' | 'error', error?: Error) => void)[] = [];
  private topicSubscriptions: Set<string> = new Set();

  async connect(options: MQTTConnectOptions): Promise<boolean> {
    try {
      this.notifyStatusListeners('connecting');
      
      // Close any existing connection
      if (this.client && this.client.connected) {
        await this.disconnect();
      }

      // Make sure we don't have protocol prefixes in the URL
      let cleanUrl = options.url;
      if (cleanUrl.startsWith('mqtt://') || cleanUrl.startsWith('ws://') || 
          cleanUrl.startsWith('mqtts://') || cleanUrl.startsWith('wss://')) {
        // Extract the hostname part
        cleanUrl = cleanUrl.split('://')[1];
      }
      
      // Allow the user to explicitly choose ws:// or wss:// protocol
      // NOTE: Using ws:// from an HTTPS page will cause Mixed Content errors in browsers
      const protocol = options.useSecureWebSockets === false ? 'ws://' : 'wss://';
      
      const url = `${protocol}${cleanUrl}:${options.port}`;
      console.log(`MQTT Client connecting to: ${url}`);
      
      // Create connection options
      const mqttOptions: mqtt.IClientOptions = {
        clientId: options.clientId || `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
        clean: true, 
        reconnectPeriod: 5000,
        // Explicitly set protocol version for better compatibility
        protocolVersion: 4
      };

      // Add credentials if provided
      if (options.username && options.password) {
        mqttOptions.username = options.username;
        mqttOptions.password = options.password;
      }

      // Create the client
      this.client = mqtt.connect(url, mqttOptions);

      // Set up event handlers
      this.client.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.notifyStatusListeners('connected');
        
        // Resubscribe to topics if reconnecting
        this.topicSubscriptions.forEach(topic => {
          this.subscribe(topic);
        });
      });

      this.client.on('error', (err) => {
        console.error('MQTT connection error:', err);
        this.notifyStatusListeners('error', err);
      });

      this.client.on('offline', () => {
        console.log('MQTT client offline');
        this.notifyStatusListeners('disconnected');
      });

      this.client.on('message', (topic, payload) => {
        try {
          // Try to parse as JSON
          let parsedPayload;
          try {
            parsedPayload = JSON.parse(payload.toString());
          } catch (e) {
            // If not JSON, use raw string
            parsedPayload = payload.toString();
          }

          const message: MQTTMessage = {
            topic,
            payload: parsedPayload,
            timestamp: new Date()
          };

          // Dispatch to topic listeners
          if (this.listeners[topic]) {
            this.listeners[topic].forEach(listener => listener(message));
          }
          
          // Dispatch to wildcard listeners (e.g., '#', '+')
          Object.keys(this.listeners).forEach(pattern => {
            if (pattern !== topic && this.matchTopic(pattern, topic)) {
              this.listeners[pattern].forEach(listener => listener(message));
            }
          });
        } catch (error) {
          console.error('Error processing MQTT message:', error);
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error);
      this.notifyStatusListeners('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        this.notifyStatusListeners('disconnected');
        resolve();
        return;
      }

      this.client.end(false, {}, () => {
        this.client = null;
        this.notifyStatusListeners('disconnected');
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }

  subscribe(topic: string): boolean {
    if (!this.client || !this.client.connected) {
      console.error('Cannot subscribe, MQTT client not connected');
      return false;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Error subscribing to topic ${topic}:`, err);
      } else {
        console.log(`Subscribed to topic: ${topic}`);
        this.topicSubscriptions.add(topic);
      }
    });

    return true;
  }

  unsubscribe(topic: string): boolean {
    if (!this.client || !this.client.connected) {
      console.error('Cannot unsubscribe, MQTT client not connected');
      return false;
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Error unsubscribing from topic ${topic}:`, err);
      } else {
        console.log(`Unsubscribed from topic: ${topic}`);
        this.topicSubscriptions.delete(topic);
      }
    });

    return true;
  }

  addMessageListener(topic: string, listener: (message: MQTTMessage) => void): void {
    if (!this.listeners[topic]) {
      this.listeners[topic] = [];
    }
    this.listeners[topic].push(listener);
  }

  removeMessageListener(topic: string, listener: (message: MQTTMessage) => void): void {
    if (this.listeners[topic]) {
      this.listeners[topic] = this.listeners[topic].filter(l => l !== listener);
      if (this.listeners[topic].length === 0) {
        delete this.listeners[topic];
      }
    }
  }

  addStatusListener(listener: (status: 'disconnected' | 'connecting' | 'connected' | 'error', error?: Error) => void): void {
    this.statusListeners.push(listener);
  }

  removeStatusListener(listener: (status: 'disconnected' | 'connecting' | 'connected' | 'error', error?: Error) => void): void {
    this.statusListeners = this.statusListeners.filter(l => l !== listener);
  }

  private notifyStatusListeners(status: 'disconnected' | 'connecting' | 'connected' | 'error', error?: Error): void {
    this.statusListeners.forEach(listener => listener(status, error));
  }

  private matchTopic(pattern: string, topic: string): boolean {
    // Convert MQTT wildcards to regex
    if (pattern === '#') {
      return true;
    }
    
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/\/#$/g, '(/.*)?')
      .replace(/#/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }
}

// Export a singleton instance
export const mqttClient = new MQTTClient();
