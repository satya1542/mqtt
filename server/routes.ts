import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { log } from "./vite";
import { mqttServerClient } from "./mqtt-client";
import { WebSocket, WebSocketServer } from "ws";
import { MQTTMessage, TimeRange } from "@shared/schema";
import { 
  insertBrokerSchema, 
  insertTopicSchema, 
  insertWidgetSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws' // Specify a path to avoid conflicts with Vite's WebSocket
  });

  wss.on('connection', (ws) => {
    log('WebSocket client connected', 'ws');
    
    try {
      // Send connection status on connect
      ws.send(JSON.stringify({
        type: 'connectionStatus',
        status: mqttServerClient.isConnected() ? 'connected' : 'disconnected',
        info: mqttServerClient.getConnectionInfo()
      }));
    } catch (error) {
      log(`Error sending initial connection status: ${error}`, 'ws');
    }
    
    ws.on('error', (error) => {
      log(`WebSocket error: ${error.message}`, 'ws');
    });
    
    ws.on('close', () => {
      log('WebSocket client disconnected', 'ws');
    });
  });

  // Broadcast MQTT messages to all connected WebSocket clients
  mqttServerClient.addMessageListener((message: MQTTMessage) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'mqttMessage',
            message
          }));
        } catch (error) {
          log(`Error sending message to client: ${error}`, 'ws');
        }
      }
    });
  });

  // API routes
  // Broker connection
  app.post('/api/broker/connect', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const { url, port, username, password, clientId, useSecureWebSockets } = data;
      
      if (!url || !port) {
        return res.status(400).json({ message: 'URL and port are required' });
      }
      
      const success = await mqttServerClient.connect(url, port, username, password, clientId, useSecureWebSockets);
      
      if (success) {
        // Store broker info
        const brokerData = insertBrokerSchema.parse({
          url,
          port,
          username,
          password,
          clientId,
          useSecureWebSockets
        });
        
        await storage.createBroker(brokerData);
        
        // Broadcast connection status
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'connectionStatus',
              status: 'connected',
              info: mqttServerClient.getConnectionInfo()
            }));
          }
        });
        
        return res.json({ 
          success: true,
          message: 'Connected to MQTT broker',
          status: 'connected'
        });
      } else {
        return res.status(500).json({ 
          success: false,
          message: 'Failed to connect to MQTT broker',
          status: 'error'
        });
      }
    } catch (error) {
      log(`Error connecting to broker: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/disconnect', async (req: Request, res: Response) => {
    try {
      await mqttServerClient.disconnect();
      
      // Broadcast disconnection status
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'connectionStatus',
            status: 'disconnected'
          }));
        }
      });
      
      return res.json({ 
        success: true,
        message: 'Disconnected from MQTT broker',
        status: 'disconnected'
      });
    } catch (error) {
      log(`Error disconnecting from broker: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/broker/status', (req: Request, res: Response) => {
    const isConnected = mqttServerClient.isConnected();
    const connectionInfo = mqttServerClient.getConnectionInfo();
    
    return res.json({
      status: isConnected ? 'connected' : 'disconnected',
      info: connectionInfo
    });
  });

  // Topics
  app.get('/api/topics', async (req: Request, res: Response) => {
    try {
      const topics = await storage.getTopics();
      return res.json(topics);
    } catch (error) {
      log(`Error getting topics: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/topics', async (req: Request, res: Response) => {
    try {
      const data = insertTopicSchema.parse({
        path: req.body.path,
        brokerId: 1 // Default to first broker in this implementation
      });
      
      const topic = await storage.createTopic(data);
      
      // Subscribe to the topic if connected
      if (mqttServerClient.isConnected()) {
        mqttServerClient.subscribe(topic.path);
      }
      
      return res.status(201).json(topic);
    } catch (error) {
      log(`Error creating topic: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/topics', async (req: Request, res: Response) => {
    try {
      const path = req.query.path as string;
      
      if (!path) {
        return res.status(400).json({ message: 'Topic path is required' });
      }
      
      // Unsubscribe from the topic if connected
      if (mqttServerClient.isConnected()) {
        mqttServerClient.unsubscribe(path);
      }
      
      const success = await storage.deleteTopic(path);
      
      if (success) {
        return res.json({ success: true });
      } else {
        return res.status(404).json({ message: 'Topic not found' });
      }
    } catch (error) {
      log(`Error deleting topic: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Widgets
  app.get('/api/widgets', async (req: Request, res: Response) => {
    try {
      const widgets = await storage.getWidgets();
      return res.json(widgets);
    } catch (error) {
      log(`Error getting widgets: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/widgets/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid widget ID' });
      }
      
      const widget = await storage.getWidget(id);
      
      if (widget) {
        return res.json(widget);
      } else {
        return res.status(404).json({ message: 'Widget not found' });
      }
    } catch (error) {
      log(`Error getting widget: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/widgets', async (req: Request, res: Response) => {
    try {
      const data = insertWidgetSchema.parse(req.body);
      const widget = await storage.createWidget(data);
      
      // Make sure the topic exists
      const topics = await storage.getTopics();
      if (!topics.some(t => t.path === widget.topic)) {
        await storage.createTopic({
          path: widget.topic,
          brokerId: 1 // Default to first broker in this implementation
        });
        
        // Subscribe to the topic if connected
        if (mqttServerClient.isConnected()) {
          mqttServerClient.subscribe(widget.topic);
        }
      }
      
      return res.status(201).json(widget);
    } catch (error) {
      log(`Error creating widget: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/widgets/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid widget ID' });
      }
      
      const success = await storage.deleteWidget(id);
      
      if (success) {
        return res.json({ success: true });
      } else {
        return res.status(404).json({ message: 'Widget not found' });
      }
    } catch (error) {
      log(`Error deleting widget: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Message history
  app.get('/api/messages/:topic', async (req: Request, res: Response) => {
    try {
      const topic = req.params.topic;
      const timeRange = (req.query.timeRange as TimeRange) || '1h';
      
      // Validate time range
      if (!['1h', '6h', '24h', '7d'].includes(timeRange)) {
        return res.status(400).json({ message: 'Invalid time range' });
      }
      
      const messages = await storage.getMessageHistory(topic, timeRange);
      return res.json(messages);
    } catch (error) {
      log(`Error getting message history: ${error}`, 'api');
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}
