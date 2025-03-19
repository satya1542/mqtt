import { 
  InsertBroker, Broker, 
  InsertTopic, Topic, 
  InsertWidget, Widget, 
  MQTTMessage, TimeRange 
} from "@shared/schema";

// Interface for MQTT storage operations
export interface IStorage {
  // Broker operations
  getBroker(id: number): Promise<Broker | undefined>;
  createBroker(broker: InsertBroker): Promise<Broker>;
  
  // Topic operations
  getTopics(): Promise<Topic[]>;
  createTopic(topic: InsertTopic): Promise<Topic>;
  deleteTopic(path: string): Promise<boolean>;
  
  // Widget operations
  getWidgets(): Promise<Widget[]>;
  getWidget(id: number): Promise<Widget | undefined>;
  createWidget(widget: InsertWidget): Promise<Widget>;
  deleteWidget(id: number): Promise<boolean>;
  
  // Message operations
  storeMessage(message: MQTTMessage): Promise<void>;
  getMessageHistory(topic: string, timeRange: TimeRange): Promise<MQTTMessage[]>;
}

// In-memory implementation of the storage interface
export class MemStorage implements IStorage {
  private brokers: Map<number, Broker>;
  private topics: Map<number, Topic>;
  private widgets: Map<number, Widget>;
  private messages: MQTTMessage[];
  private maxHistorySize: number = 10000; // Max number of messages to keep in memory
  
  private brokerId: number = 1;
  private topicId: number = 1;
  private widgetId: number = 1;

  constructor() {
    this.brokers = new Map();
    this.topics = new Map();
    this.widgets = new Map();
    this.messages = [];
  }

  // Broker operations
  async getBroker(id: number): Promise<Broker | undefined> {
    return this.brokers.get(id);
  }

  async createBroker(broker: InsertBroker): Promise<Broker> {
    const id = this.brokerId++;
    const newBroker: Broker = { 
      id,
      url: broker.url,
      port: broker.port,
      username: broker.username || null,
      password: broker.password || null,
      clientId: broker.clientId || null,
      useSecureWebSockets: broker.useSecureWebSockets || null
    };
    this.brokers.set(id, newBroker);
    return newBroker;
  }

  // Topic operations
  async getTopics(): Promise<Topic[]> {
    return Array.from(this.topics.values());
  }

  async createTopic(topic: InsertTopic): Promise<Topic> {
    // Check if topic already exists
    const existingTopic = Array.from(this.topics.values()).find(t => t.path === topic.path);
    if (existingTopic) {
      return existingTopic;
    }
    
    const id = this.topicId++;
    const newTopic: Topic = { ...topic, id };
    this.topics.set(id, newTopic);
    return newTopic;
  }

  async deleteTopic(path: string): Promise<boolean> {
    const topicToDelete = Array.from(this.topics.values()).find(t => t.path === path);
    if (topicToDelete) {
      return this.topics.delete(topicToDelete.id);
    }
    return false;
  }

  // Widget operations
  async getWidgets(): Promise<Widget[]> {
    return Array.from(this.widgets.values());
  }

  async getWidget(id: number): Promise<Widget | undefined> {
    return this.widgets.get(id);
  }

  async createWidget(widget: InsertWidget): Promise<Widget> {
    const id = this.widgetId++;
    const newWidget: Widget = { 
      id,
      title: widget.title,
      topic: widget.topic,
      chartType: widget.chartType,
      jsonKeyPath: widget.jsonKeyPath || null,
      unit: widget.unit || null
    };
    this.widgets.set(id, newWidget);
    return newWidget;
  }

  async deleteWidget(id: number): Promise<boolean> {
    return this.widgets.delete(id);
  }

  // Message operations
  async storeMessage(message: MQTTMessage): Promise<void> {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date();
    }
    
    // Add to messages array
    this.messages.push(message);
    
    // Trim if exceeding max size
    if (this.messages.length > this.maxHistorySize) {
      this.messages = this.messages.slice(-this.maxHistorySize);
    }
  }

  async getMessageHistory(topic: string, timeRange: TimeRange): Promise<MQTTMessage[]> {
    const now = new Date();
    let startTime: Date;
    
    // Set the start time based on time range
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
    }
    
    // Filter messages by topic and time range
    return this.messages.filter(msg => 
      msg.topic === topic && 
      msg.timestamp && 
      msg.timestamp >= startTime
    );
  }
}

// Export an instance of MemStorage
export const storage = new MemStorage();
