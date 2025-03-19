import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import { wsClient } from "./lib/websocket";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Add dark mode support based on theme.json
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { toast } = useToast();
  
  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
    
    // Update the document with the theme class
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    // Initialize WebSocket connection
    try {
      wsClient.connect();
      
      // Add WebSocket status listener
      const handleStatus = (status: 'connected' | 'disconnected' | 'error', error?: Error) => {
        if (status === 'error') {
          console.error('WebSocket connection error:', error);
          toast({
            title: "Connection Error",
            description: "Failed to connect to the server. Will retry automatically.",
            variant: "destructive",
          });
        }
      };
      
      wsClient.addStatusListener(handleStatus);
      
      return () => {
        wsClient.removeStatusListener(handleStatus);
        wsClient.disconnect();
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
    }
  }, [toast]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
