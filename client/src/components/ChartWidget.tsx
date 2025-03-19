import { useState } from 'react';
import { WidgetData } from '../types/mqtt';
import { TimeRange } from '@shared/schema';
import { 
  LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie
} from 'recharts';
import { 
  Settings, BarChart2, LineChart as LineChartIcon 
} from 'lucide-react';
import { getTimeFormat } from '../lib/chartUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ChartWidgetProps {
  widget: WidgetData;
  timeRange: TimeRange;
  onRemove: () => void;
}

export default function ChartWidget({ widget, timeRange, onRemove }: ChartWidgetProps) {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'gauge'>(
    widget.chartType as 'line' | 'bar' | 'gauge' || 'line'
  );

  const timeFormat = getTimeFormat(timeRange);

  // Format the timestamp for display in the chart
  const formatXAxis = (tickItem: any) => {
    if (!tickItem) return '';
    const date = new Date(tickItem);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Prepare data for the chart
  const chartData = widget.chartData?.map(point => ({
    timestamp: point.timestamp,
    value: point.value
  })) || [];

  // Render the appropriate chart based on type
  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No data available</p>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis} 
              scale="time" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleString();
              }}
              formatter={(value) => [`${value}${widget.unit || ''}`, '']}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis} 
              scale="time" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleString();
              }}
              formatter={(value) => [`${value}${widget.unit || ''}`, '']}
            />
            <Bar 
              dataKey="value" 
              fill="#8B5CF6" 
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    
    if (chartType === 'gauge') {
      // For gauge chart, use the most recent value
      const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
      const normalizedValue = Math.min(Math.max(latestValue, 0), 100); // Ensure value is between 0-100
      
      // Create gauge data
      const gaugeData = [
        { name: 'Value', value: normalizedValue },
        { name: 'Remaining', value: 100 - normalizedValue }
      ];
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={0}
              dataKey="value"
              isAnimationActive={false}
            >
              {gaugeData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === 0 ? '#10B981' : '#f3f4f6'} 
                />
              ))}
            </Pie>
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-2xl font-semibold"
              fill="#374151"
            >
              {normalizedValue.toFixed(1)}{widget.unit}
            </text>
          </PieChart>
        </ResponsiveContainer>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold dark:text-gray-100">{widget.title}</h2>
          <div className="flex space-x-2">
            <select
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-gray-300"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'line' | 'bar' | 'gauge')}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="gauge">Gauge</option>
            </select>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <Settings className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Remove Widget
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Widget</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove the "{widget.title}" widget? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{widget.topic}</div>
      </div>
      
      <div className="p-4">
        <div className="h-[250px]">
          {renderChart()}
        </div>
      </div>
      
      <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center">
        <div>
          <span className="font-medium">Current: </span>
          <span className="font-mono">{widget.currentValue || 'N/A'}</span>
        </div>
        <div>
          <span className="font-medium">Avg: </span>
          <span className="font-mono">{widget.avgValue || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

// Cell component for the gauge chart
function Cell({ key, fill, children }: any) {
  return (
    <path
      key={key}
      fill={fill}
      stroke="none"
      {...children}
    />
  );
}
