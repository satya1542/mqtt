import * as mqtt from 'mqtt';
import { MQTTMessage } from '@shared/schema';
import { storage } from './storage';
import { log } from './vite';

class MQTTServerClient {
  private client: mqtt.MqttClient | null = null;
  private messageListeners: ((message: MQTTMessage) => void)[] = [];
  private subscribedTopics: Set<string> = new Set();
  private brokerUrl: string | null = null;
  private clientId: string | null = null;

  async connect(url: string, port: number, username?: string, password?: string, clientId?: string, secureWebSockets?: boolean): Promise<boolean> {
    try {
      // Close any existing connection
      if (this.client && this.client.connected) {
        await this.disconnect();
      }

      // Make sure we don't have protocol prefixes in the URL
      let cleanUrl = url;
      if (cleanUrl.startsWith('mqtt://') || cleanUrl.startsWith('ws://') || 
          cleanUrl.startsWith('mqtts://') || cleanUrl.startsWith('wss://')) {
        // Extract the hostname part
        cleanUrl = cleanUrl.split('://')[1];
      }
      
      // Allow explicit control over which protocol to use
      // Default to ws:// for server-side connections unless useSecureWebSockets is true
      const useSecure = !!secureWebSockets;
      let protocol = useSecure ? 'wss://' : 'ws://';
      
      const fullUrl = `${protocol}${cleanUrl}:${port}`;
      log(`MQTT Server connecting to: ${fullUrl}`, 'mqtt');
      
      // Create connection options
      const options: mqtt.IClientOptions = {
        clientId: clientId || `mqtt-server-${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        reconnectPeriod: 5000,
        // Explicitly set protocol version for better compatibility
        protocolVersion: 4
      };

      // Add credentials if provided
      if (username && password) {
        options.username = username;
        options.password = password;
      }

      // Create the client
      this.client = mqtt.connect(fullUrl, options);
      this.brokerUrl = fullUrl;
      this.clientId = options.clientId || null;

      // Set up event handlers
      this.client.on('connect', () => {
        log(`Server connected to MQTT broker: ${fullUrl}`, 'mqtt');
        
        // Resubscribe to topics
        this.subscribedTopics.forEach(topic => {
          this.subscribe(topic);
        });
      });

      this.client.on('error', (err) => {
        log(`MQTT connection error: ${err.message}`, 'mqtt');
      });

      this.client.on('offline', () => {
        log('MQTT server client offline', 'mqtt');
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

          // Store message in database
          storage.storeMessage(message).catch(err => {
            log(`Error storing message: ${err.message}`, 'mqtt');
          });

          // Notify listeners
          this.messageListeners.forEach(listener => {
            try {
              listener(message);
            } catch (err) {
              log(`Error in message listener: ${err}`, 'mqtt');
            }
          });
        } catch (error) {
          log(`Error processing MQTT message: ${error}`, 'mqtt');
        }
      });

      return new Promise<boolean>((resolve) => {
        if (!this.client) {
          resolve(false);
          return;
        }

        // Handle the initial connection
        this.client.once('connect', () => {
          resolve(true);
        });

        this.client.once('error', () => {
          resolve(false);
        });

        // Set a timeout in case connection hangs
        setTimeout(() => {
          if (this.client && !this.client.connected) {
            resolve(false);
          }
        }, 10000);
      });
    } catch (error) {
      log(`Failed to connect to MQTT broker: ${error}`, 'mqtt');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, () => {
        this.client = null;
        this.brokerUrl = null;
        log('Disconnected from MQTT broker', 'mqtt');
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }

  getConnectionInfo(): { url: string | null, clientId: string | null, useSecureWebSockets?: boolean } {
    return {
      url: this.brokerUrl,
      clientId: this.clientId,
      useSecureWebSockets: this.brokerUrl?.startsWith('wss://') ? true : false
    };
  }

  subscribe(topic: string): boolean {
    if (!this.client || !this.client.connected) {
      log(`Cannot subscribe, MQTT client not connected`, 'mqtt');
      return false;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        log(`Error subscribing to topic ${topic}: ${err.message}`, 'mqtt');
      } else {
        log(`Subscribed to topic: ${topic}`, 'mqtt');
        this.subscribedTopics.add(topic);
      }
    });

    return true;
  }

  unsubscribe(topic: string): boolean {
    if (!this.client || !this.client.connected) {
      log(`Cannot unsubscribe, MQTT client not connected`, 'mqtt');
      return false;
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        log(`Error unsubscribing from topic ${topic}: ${err.message}`, 'mqtt');
      } else {
        log(`Unsubscribed from topic: ${topic}`, 'mqtt');
        this.subscribedTopics.delete(topic);
      }
    });

    return true;
  }

  addMessageListener(listener: (message: MQTTMessage) => void): void {
    this.messageListeners.push(listener);
  }

  removeMessageListener(listener: (message: MQTTMessage) => void): void {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }
}

// Export a singleton instance
export const mqttServerClient = new MQTTServerClient();
