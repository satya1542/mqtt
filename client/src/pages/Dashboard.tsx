import { useState, useEffect } from 'react';
import { TimeRange, MQTTMessage, InsertWidget, Widget } from '@shared/schema';
import Sidebar from '../components/Sidebar';
import ChartWidget from '../components/ChartWidget';
import AddWidgetModal from '../components/AddWidgetModal';
import { WidgetData } from '../types/mqtt';
import { normalizeChartData } from '../lib/chartUtils';
import { BarChartIcon } from 'lucide-react';
import { mqttClient } from '../lib/mqtt-client';
import { useToast } from '@/hooks/use-toast';
import { extractValueByPath } from '../lib/chartUtils';
import { apiRequest } from '@/lib/queryClient';
import { wsClient } from '../lib/websocket';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [widgets, setWidgets] = useState<WidgetData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();

  // Fetch widgets on component mount and handle WebSocket messages
  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const response = await fetch('/api/widgets');
        if (response.ok) {
          const data = await response.json();
          setWidgets(data);
        }
      } catch (error) {
        console.error('Error fetching widgets:', error);
        toast({
          title: 'Failed to load widgets',
          description: 'There was an error loading your dashboard widgets.',
          variant: 'destructive',
        });
      }
    };

    fetchWidgets();

    // Connect to WebSocket
    wsClient.connect();

    return () => {
      // Cleanup
    };
  }, [toast]);
  
  // Handle WebSocket messages separately to access the latest widgets
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      if (data.type === 'mqttMessage' && data.message) {
        // Pass MQTT messages from the server to our local processor
        const message = data.message as MQTTMessage;
        widgets.forEach(widget => {
          if (widget.topic === message.topic) {
            handleMessageReceived(message, widget.id);
          }
        });
      } else if (data.type === 'connectionStatus') {
        // Update MQTT connection status if needed
        console.log('MQTT connection status from server:', data.status);
      }
    };
    
    wsClient.addMessageListener(handleWebSocketMessage);

    return () => {
      wsClient.removeMessageListener(handleWebSocketMessage);
    };
  }, [widgets]);

  // Update widget data when a new message arrives
  const handleMessageReceived = (message: MQTTMessage, widgetId: number) => {
    setWidgets(prevWidgets => {
      return prevWidgets.map(widget => {
        if (widget.id === widgetId && widget.topic === message.topic) {
          try {
            // Extract value from message payload using the jsonKeyPath
            const value = extractValueByPath(message.payload, widget.jsonKeyPath || undefined);
            
            // Only process numeric values
            if (typeof value === 'number' || !isNaN(Number(value))) {
              const numericValue = typeof value === 'number' ? value : Number(value);
              
              // Add new data point
              const chartData = [
                ...(widget.chartData || []),
                {
                  timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(),
                  value: numericValue
                }
              ];
              
              // Keep only the last 1000 data points to avoid memory issues
              const limitedData = chartData.slice(-1000);
              
              return {
                ...widget,
                chartData: limitedData,
                currentValue: numericValue.toFixed(2) + (widget.unit || '')
              };
            }
          } catch (error) {
            console.error('Error processing message for widget:', error);
          }
        }
        return widget;
      });
    });
  };

  // Subscribe to topics for widgets
  useEffect(() => {
    // Set up message listeners for each widget
    widgets.forEach(widget => {
      mqttClient.addMessageListener(widget.topic, (message) => 
        handleMessageReceived(message, widget.id)
      );
      
      // Subscribe to topic if client is connected
      if (mqttClient.isConnected()) {
        mqttClient.subscribe(widget.topic);
      }
    });

    // Cleanup
    return () => {
      widgets.forEach(widget => {
        mqttClient.removeMessageListener(widget.topic, (message) => 
          handleMessageReceived(message, widget.id)
        );
      });
    };
  }, [widgets]);

  // Add a new widget
  const handleAddWidget = async (widget: InsertWidget) => {
    try {
      const response = await apiRequest('POST', '/api/widgets', widget);
      if (response.ok) {
        const newWidget = await response.json();
        // Convert the returned widget to a WidgetData type with empty chart data
        const widgetData: WidgetData = {
          ...newWidget,
          chartData: [],
          currentValue: undefined,
          avgValue: undefined
        };
        setWidgets(prev => [...prev, widgetData]);
        
        // Subscribe to the new topic
        if (mqttClient.isConnected()) {
          mqttClient.subscribe(newWidget.topic);
        }
        
        setIsModalOpen(false);
        toast({
          title: 'Widget added',
          description: `The widget "${newWidget.title}" has been added to your dashboard.`,
        });
      }
    } catch (error) {
      console.error('Error adding widget:', error);
      toast({
        title: 'Failed to add widget',
        description: 'There was an error adding the widget.',
        variant: 'destructive',
      });
    }
  };

  // Remove a widget
  const handleRemoveWidget = async (widgetId: number) => {
    try {
      const widget = widgets.find(w => w.id === widgetId);
      if (!widget) return;
      
      const response = await apiRequest('DELETE', `/api/widgets/${widgetId}`, undefined);
      if (response.ok) {
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
        toast({
          title: 'Widget removed',
          description: `The widget "${widget.title}" has been removed from your dashboard.`,
        });
      }
    } catch (error) {
      console.error('Error removing widget:', error);
      toast({
        title: 'Failed to remove widget',
        description: 'There was an error removing the widget.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />
      
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden fixed top-0 left-0 z-30 m-3">
        <button 
          className="p-2 rounded-md bg-gray-800 text-white"
          onClick={() => setIsMobileSidebarOpen(true)}
        >
          <BarChartIcon className="h-5 w-5" />
        </button>
      </div>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
        <div className="p-4 md:p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">MQTT Dashboard</h1>
            
            {/* Time Range Selection */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Time Range:</span>
              <select 
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </div>
          </div>
          
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Map widgets */}
            {widgets.map(widget => (
              <ChartWidget 
                key={widget.id}
                widget={normalizeChartData(widget, timeRange)}
                timeRange={timeRange}
                onRemove={() => handleRemoveWidget(widget.id)}
              />
            ))}
            
            {/* Add New Widget Card */}
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center h-64 cursor-pointer hover:border-primary transition-colors duration-200"
              onClick={() => setIsModalOpen(true)}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChartIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Add New Chart</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Add Widget Modal */}
      <AddWidgetModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddWidget={(values) => {
          // The values from the form are already compatible with InsertWidget
          // which is what the API expects
          handleAddWidget({
            ...values,
            // Convert empty strings to null for backend compatibility
            jsonKeyPath: values.jsonKeyPath || null,
            unit: values.unit || null
          });
        }}
      />
    </div>
  );
}
