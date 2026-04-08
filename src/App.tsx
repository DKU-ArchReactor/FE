import { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';

function App() {
  const [activeTab, setActiveTab] = useState<'workspace' | 'analytics'>('workspace');

  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900 flex flex-col font-sans overflow-hidden">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'workspace' && <Dashboard />}
        {activeTab === 'analytics' && <Analytics />}
      </main>
    </div>
  );
}

export default App;
