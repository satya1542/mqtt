import { TimeRange } from "@shared/schema";
import { ChartDataPoint, WidgetData } from "../types/mqtt";

// Function to filter data points based on time range
export function filterDataByTimeRange(data: ChartDataPoint[], timeRange: TimeRange): ChartDataPoint[] {
  const now = new Date();
  let startTime: Date;

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

  return data.filter(point => point.timestamp >= startTime);
}

// Function to extract value from a JSON object using a key path
export function extractValueByPath(obj: any, path?: string): any {
  if (!path) return obj;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = value[key];
  }
  
  return value;
}

// Function to calculate average value from chart data
export function calculateAverage(data: ChartDataPoint[]): number | undefined {
  if (!data.length) return undefined;
  
  const sum = data.reduce((acc, point) => acc + point.value, 0);
  return Number((sum / data.length).toFixed(2));
}

// Function to format value with unit
export function formatValue(value: number | undefined, unit?: string): string {
  if (value === undefined) return 'N/A';
  return `${value}${unit || ''}`;
}

// Function to normalize chart data for visualization
export function normalizeChartData(widgetData: WidgetData, timeRange: TimeRange): WidgetData {
  const chartData = widgetData.chartData || [];
  const filteredData = filterDataByTimeRange(chartData, timeRange);
  
  // Calculate current and average values
  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : undefined;
  const avgValue = calculateAverage(filteredData);
  
  return {
    ...widgetData,
    chartData: filteredData,
    currentValue: formatValue(currentValue, widgetData.unit),
    avgValue: formatValue(avgValue, widgetData.unit)
  };
}

// Function to get appropriate time format based on time range
export function getTimeFormat(timeRange: TimeRange): string {
  switch (timeRange) {
    case '1h':
    case '6h':
      return 'HH:mm';
    case '24h':
      return 'HH:mm';
    case '7d':
      return 'MM/DD HH:mm';
    default:
      return 'HH:mm';
  }
}

// Generate empty chart data for initial state
export function generateEmptyChartData(timeRange: TimeRange): ChartDataPoint[] {
  const now = new Date();
  const data: ChartDataPoint[] = [];
  let interval: number;
  let count: number;
  
  switch (timeRange) {
    case '1h':
      interval = 5 * 60 * 1000; // 5 minutes
      count = 12;
      break;
    case '6h':
      interval = 30 * 60 * 1000; // 30 minutes
      count = 12;
      break;
    case '24h':
      interval = 2 * 60 * 60 * 1000; // 2 hours
      count = 12;
      break;
    case '7d':
      interval = 12 * 60 * 60 * 1000; // 12 hours
      count = 14;
      break;
    default:
      interval = 5 * 60 * 1000;
      count = 12;
  }
  
  for (let i = count - 1; i >= 0; i--) {
    data.push({
      timestamp: new Date(now.getTime() - i * interval),
      value: 0
    });
  }
  
  return data;
}
