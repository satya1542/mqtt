import { useState, useEffect } from 'react';
import ConnectionPanel from './ConnectionPanel';
import TopicManager from './TopicManager';
import { BarChart2 } from 'lucide-react';
import { X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  // Apply conditional classes for mobile sidebar
  const sidebarClasses = `bg-gray-800 text-white w-64 flex-shrink-0 flex flex-col h-full ${
    isOpen ? 'fixed inset-y-0 left-0 z-40' : 'hidden md:block'
  }`;

  return (
    <aside className={sidebarClasses}>
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <BarChart2 className="h-6 w-6 text-primary mr-2" />
          <h1 className="text-xl font-semibold">MQTT Visualizer</h1>
        </div>
        <button 
          className="md:hidden text-gray-400 hover:text-white" 
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Connection Panel */}
      <ConnectionPanel />
      
      {/* Topic Manager */}
      <TopicManager />
    </aside>
  );
}
