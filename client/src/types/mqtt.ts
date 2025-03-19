import { z } from "zod";
import { ConnectionStatus, MQTTMessage, TimeRange, Widget } from "@shared/schema";

export interface MQTTConnectOptions {
  url: string;
  port: number;
  username?: string;
  password?: string;
  clientId?: string;
  useSecureWebSockets?: boolean; // Set to false to use ws:// instead of wss://
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
}

export interface TopicDataState {
  [topic: string]: {
    messages: MQTTMessage[];
    lastMessage?: MQTTMessage;
  };
}

export interface WidgetData extends Widget {
  currentValue?: number | string;
  avgValue?: number | string;
  chartData?: ChartDataPoint[];
}

export type ChartType = 'line' | 'bar' | 'gauge';

export const widgetFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  jsonKeyPath: z.string().optional(),
  chartType: z.enum(["line", "bar", "gauge"]),
  unit: z.string().optional(),
});

export type WidgetFormValues = z.infer<typeof widgetFormSchema>;
