import React from 'react';
import { Cpu, Bell, Database } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  activeTab: 'workspace' | 'analytics';
  onTabChange: (tab: 'workspace' | 'analytics') => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between z-10 sticky top-0 shadow-sm">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2 text-cyan-600 font-bold text-xl tracking-tight">
          <Cpu className="w-6 h-6" />
          <span>ArchReactor</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => onTabChange('workspace')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all relative ${
              activeTab === 'workspace' ? 'text-cyan-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {activeTab === 'workspace' && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-white border border-gray-200 rounded-md shadow-sm -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            Workspace
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all relative ${
              activeTab === 'analytics' ? 'text-cyan-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-white border border-gray-200 rounded-md shadow-sm -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            Analytics & AI Form
          </button>
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
          <Database className="w-4 h-4 text-emerald-500" />
          <span>Simulation Ready</span>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100">
          <Bell className="w-5 h-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white font-medium shadow-md shadow-cyan-500/20 cursor-pointer hover:opacity-90 transition-opacity">
          S
        </div>
      </div>
    </header>
  );
};

export default Header;
