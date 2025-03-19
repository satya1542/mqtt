import { useState, useEffect } from 'react';
import { mqttClient } from '../lib/mqtt-client';
import { MQTTConnectOptions } from '../types/mqtt';
import { useToast } from '@/hooks/use-toast';
import { ConnectionStatus } from '@shared/schema';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ConnectionPanel() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [brokerUrl, setBrokerUrl] = useState('mqtt.thynxai.cloud');
  const [port, setPort] = useState('9006');  // WebSocket port for your broker
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [useSecureWebSockets, setUseSecureWebSockets] = useState(false); // Default to using ws:// (non-secure)
  const [isConnectionInProgress, setIsConnectionInProgress] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Listen for MQTT connection status changes
    const handleStatusChange = (status: 'disconnected' | 'connecting' | 'connected' | 'error', error?: Error) => {
      setConnectionStatus(status);
      setIsConnectionInProgress(status === 'connecting');
      
      if (status === 'error' && error) {
        toast({
          title: 'Connection Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    };
    
    mqttClient.addStatusListener(handleStatusChange);
    
    return () => {
      mqttClient.removeStatusListener(handleStatusChange);
    };
  }, [toast]);

  const handleConnect = async () => {
    if (isConnectionInProgress) return;
    
    setIsConnectionInProgress(true);
    
    // Validate inputs
    if (!brokerUrl) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a broker URL',
        variant: 'destructive',
      });
      setIsConnectionInProgress(false);
      return;
    }
    
    if (!port || isNaN(Number(port))) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid port number',
        variant: 'destructive',
      });
      setIsConnectionInProgress(false);
      return;
    }
    
    // Connect to MQTT broker
    const options: MQTTConnectOptions = {
      url: brokerUrl,
      port: Number(port),
      username: username || undefined,
      password: password || undefined,
      clientId: clientId || undefined,
      useSecureWebSockets: useSecureWebSockets
    };
    
    try {
      console.log(`Attempting to connect to MQTT broker at ${options.url}:${options.port}...`);
      
      const success = await mqttClient.connect(options);
      
      if (success) {
        console.log(`Successfully connected to MQTT broker at ${options.url}:${options.port}`);
        toast({
          title: 'Connected',
          description: `Successfully connected to ${brokerUrl}:${port}`,
        });
      } else {
        console.error(`Failed to connect to MQTT broker`);
        toast({
          title: 'Connection Failed',
          description: 'Could not connect to MQTT broker. Check the console for details.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to MQTT broker',
        variant: 'destructive',
      });
    } finally {
      setIsConnectionInProgress(false);
    }
  };

  const handleDisconnect = async () => {
    if (isConnectionInProgress) return;
    
    try {
      await mqttClient.disconnect();
      toast({
        title: 'Disconnected',
        description: 'Successfully disconnected from MQTT broker',
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect from MQTT broker',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 border-b border-gray-700">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Connection</h2>
      
      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Status:</span>
          <span className="flex items-center text-sm">
            <span 
              className={`h-2 w-2 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 
                connectionStatus === 'error' ? 'bg-red-500' : 
                'bg-gray-500'
              }`}
            />
            <span>
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'error' ? 'Error' :
               'Disconnected'}
            </span>
          </span>
        </div>
      </div>
      
      {/* Connection Form */}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
        <div>
          <Label htmlFor="broker-url" className="block text-sm text-gray-400 mb-1">Broker URL</Label>
          <Input
            id="broker-url"
            type="text"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            className="bg-gray-700 text-sm rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary border-gray-600"
          />
        </div>
        
        <div>
          <Label htmlFor="port" className="block text-sm text-gray-400 mb-1">Port</Label>
          <Input
            id="port"
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="bg-gray-700 text-sm rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary border-gray-600"
          />
        </div>
        
        <div>
          <Label htmlFor="username" className="block text-sm text-gray-400 mb-1">Username (optional)</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-gray-700 text-sm rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary border-gray-600"
          />
        </div>
        
        <div>
          <Label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password (optional)</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-700 text-sm rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-primary border-gray-600"
          />
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <input 
            type="checkbox" 
            id="use-secure-websockets"
            checked={useSecureWebSockets}
            onChange={(e) => setUseSecureWebSockets(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <Label htmlFor="use-secure-websockets" className="text-sm text-gray-400">Use Secure WebSockets (wss://)</Label>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Note: Browser security may require wss:// for pages loaded over HTTPS
        </div>
        
        <div className="flex space-x-2">
          <Button
            type="submit"
            className="bg-primary hover:bg-blue-600 text-white rounded px-3 py-2 text-sm flex-1 transition"
            disabled={isConnectionInProgress || connectionStatus === 'connected'}
          >
            Connect
          </Button>
          <Button
            type="button"
            className="bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-2 text-sm flex-1 transition"
            onClick={handleDisconnect}
            disabled={isConnectionInProgress || connectionStatus !== 'connected'}
            variant="outline"
          >
            Disconnect
          </Button>
        </div>
      </form>
    </div>
  );
}
