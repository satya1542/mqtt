import { useState, useEffect } from 'react';
import { mqttClient } from '../lib/mqtt-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function TopicManager() {
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Fetch subscribed topics
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('/api/topics');
        if (response.ok) {
          const data = await response.json();
          setSubscribedTopics(data.map((topic: any) => topic.path));
        }
      } catch (error) {
        console.error('Error fetching topics:', error);
      }
    };

    fetchTopics();
  }, []);

  // Update connection status
  useEffect(() => {
    const handleStatusChange = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => {
      setIsConnected(status === 'connected');
      
      // Subscribe to topics when connected
      if (status === 'connected') {
        subscribedTopics.forEach(topic => {
          mqttClient.subscribe(topic);
        });
      }
    };
    
    mqttClient.addStatusListener(handleStatusChange);
    setIsConnected(mqttClient.isConnected());
    
    return () => {
      mqttClient.removeStatusListener(handleStatusChange);
    };
  }, [subscribedTopics]);

  const handleAddTopic = () => {
    setIsAddingTopic(true);
  };

  const handleCancelTopic = () => {
    setIsAddingTopic(false);
    setNewTopic('');
  };

  const handleSubscribe = async () => {
    if (!newTopic.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a topic path',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Add topic to server
      const response = await apiRequest('POST', '/api/topics', { path: newTopic });
      
      if (response.ok) {
        // Subscribe to topic if connected
        if (isConnected) {
          mqttClient.subscribe(newTopic);
        }
        
        // Update state
        setSubscribedTopics(prev => [...prev, newTopic]);
        setNewTopic('');
        setIsAddingTopic(false);
        
        toast({
          title: 'Subscribed',
          description: `Successfully subscribed to topic: ${newTopic}`,
        });
      }
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      toast({
        title: 'Subscription Failed',
        description: error instanceof Error ? error.message : 'Failed to subscribe to topic',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTopic = async (topic: string) => {
    try {
      // Unsubscribe from topic on server
      const response = await apiRequest('DELETE', `/api/topics?path=${encodeURIComponent(topic)}`, undefined);
      
      if (response.ok) {
        // Unsubscribe if connected
        if (isConnected) {
          mqttClient.unsubscribe(topic);
        }
        
        // Update state
        setSubscribedTopics(prev => prev.filter(t => t !== topic));
        
        toast({
          title: 'Unsubscribed',
          description: `Successfully unsubscribed from topic: ${topic}`,
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      toast({
        title: 'Unsubscribe Failed',
        description: error instanceof Error ? error.message : 'Failed to unsubscribe from topic',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Topics</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-primary hover:text-blue-400"
          onClick={handleAddTopic}
          disabled={!isConnected}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      
      {/* Topic List */}
      <div className="space-y-2 max-h-64 overflow-y-auto flex-1">
        {subscribedTopics.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No topics subscribed</p>
        ) : (
          subscribedTopics.map((topic, index) => (
            <div key={index} className="bg-gray-700 rounded p-2 text-sm flex justify-between items-center">
              <div className="truncate flex-1">{topic}</div>
              <button 
                className="text-gray-400 hover:text-red-500"
                onClick={() => handleRemoveTopic(topic)}
                disabled={!isConnected}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
      
      {/* Add Topic Form */}
      {isAddingTopic && (
        <div className="mt-4">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); handleSubscribe(); }}>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Topic Path</label>
              <Input
                type="text"
                placeholder="sensor/#"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="bg-gray-700 text-sm rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary border-gray-600"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                type="submit"
                className="bg-primary hover:bg-blue-600 text-white rounded px-3 py-2 text-sm flex-1 transition"
              >
                Subscribe
              </Button>
              <Button
                type="button"
                className="bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-2 text-sm flex-1 transition"
                onClick={handleCancelTopic}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
      
      {/* Information when not connected */}
      {!isConnected && (
        <div className="mt-4 p-2 bg-gray-700 rounded text-sm text-gray-300">
          <p>Connect to an MQTT broker to subscribe to topics</p>
        </div>
      )}
    </div>
  );
}
