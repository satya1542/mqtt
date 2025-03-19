import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const brokers = pgTable("brokers", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  port: integer("port").notNull(),
  username: text("username"),
  password: text("password"),
  clientId: text("client_id"),
  useSecureWebSockets: boolean("use_secure_websockets"),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  brokerId: integer("broker_id").notNull(),
});

export const widgets = pgTable("widgets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  jsonKeyPath: text("json_key_path"),
  chartType: text("chart_type").notNull(),
  unit: text("unit"),
});

export const messageData = pgTable("message_data", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Insert schemas
export const insertBrokerSchema = createInsertSchema(brokers).pick({
  url: true,
  port: true,
  username: true,
  password: true,
  clientId: true,
  useSecureWebSockets: true,
});

export const insertTopicSchema = createInsertSchema(topics).pick({
  path: true,
  brokerId: true,
});

export const insertWidgetSchema = createInsertSchema(widgets).pick({
  title: true,
  topic: true,
  jsonKeyPath: true,
  chartType: true,
  unit: true,
});

export const insertMessageDataSchema = createInsertSchema(messageData).pick({
  topic: true,
  payload: true,
});

// Types
export type InsertBroker = z.infer<typeof insertBrokerSchema>;
export type Broker = typeof brokers.$inferSelect;

export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect;

export type InsertWidget = z.infer<typeof insertWidgetSchema>;
export type Widget = typeof widgets.$inferSelect;

export type InsertMessageData = z.infer<typeof insertMessageDataSchema>;
export type MessageData = typeof messageData.$inferSelect;

// Connection status type
export const ConnectionStatus = z.enum(['disconnected', 'connecting', 'connected', 'error']);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

// Create a type for MQTT message
export const MQTTMessageSchema = z.object({
  topic: z.string(),
  payload: z.any(),
  timestamp: z.date().optional(),
});
export type MQTTMessage = z.infer<typeof MQTTMessageSchema>;

// Create a timerange enum for chart data
export const TimeRange = z.enum(['1h', '6h', '24h', '7d']);
export type TimeRange = z.infer<typeof TimeRange>;
