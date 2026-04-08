import React, { useState } from 'react';
import { FileCode2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CodeEditor: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'c_code' | 'assembly'>('c_code');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* File Tabs */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50 p-2 gap-2">
        <button
          onClick={() => setActiveFile('c_code')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
            activeFile === 'c_code' ? 'bg-white shadow-sm border border-gray-200 text-cyan-600' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          main.c
        </button>
        <button
          onClick={() => setActiveFile('assembly')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
            activeFile === 'assembly' ? 'bg-white shadow-sm border border-gray-200 text-amber-600' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          output.S
        </button>
        
        <div className="ml-auto">
            <button className="bg-emerald-100 peer hover:bg-emerald-200 text-emerald-600 p-1.5 rounded-md transition-colors flex items-center justify-center">
                <Play className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto p-4 bg-white font-mono text-sm leading-relaxed relative xl:text-[15px]">
        <AnimatePresence mode="wait">
          <motion.pre
            key={activeFile}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="text-gray-700"
          >
            <code>
              {activeFile === 'c_code' ? (
                <>
                  <span className="text-pink-600">int</span> <span className="text-blue-600">main</span>() {'{\n'}
                  {'    '}<span className="text-pink-600">int</span> a = <span className="text-emerald-600">5</span>;{'\n'}
                  {'    '}<span className="text-pink-600">int</span> b = <span className="text-emerald-600">10</span>;{'\n'}
                  {'    '}<span className="text-pink-600">int</span> c = a + b;{'\n'}
                  {'    '}<span className="text-pink-600">return</span> c;{'\n'}
                  {'}'}
                </>
              ) : (
                <>
                  <span className="text-blue-600">main:</span>{'\n'}
                  {'    '}<span className="text-pink-600">addi</span> sp, sp, <span className="text-emerald-600">-16</span>{'\n'}
                  {'    '}<span className="text-pink-600">sw</span>{'   '}ra, <span className="text-emerald-600">12</span>(sp){'\n'}
                  {'    '}<span className="text-pink-600">li</span>{'   '}t0, <span className="text-emerald-600">5</span>{'\n'}
                  {'    '}<span className="text-pink-600">sw</span>{'   '}t0, <span className="text-emerald-600">8</span>(sp){'\n'}
                  {'    '}<span className="text-pink-600">li</span>{'   '}t1, <span className="text-emerald-600">10</span>{'\n'}
                  {'    '}<span className="text-pink-600">sw</span>{'   '}t1, <span className="text-emerald-600">4</span>(sp){'\n'}
                  {'    '}<span className="text-pink-600">lw</span>{'   '}t0, <span className="text-emerald-600">8</span>(sp) <span className="text-rose-500 bg-rose-50 px-1 rounded"># Hazard!</span>{'\n'}
                  {'    '}<span className="text-cyan-600 font-bold">add</span>{'  '}t2, t0, t1{'\n'}
                  {'    '}<span className="text-pink-600">sw</span>{'   '}t2, <span className="text-emerald-600">0</span>(sp){'\n'}
                  {'    '}<span className="text-pink-600">mv</span>{'   '}a0, t2{'\n'}
                  {'    '}<span className="text-pink-600">lw</span>{'   '}ra, <span className="text-emerald-600">12</span>(sp){'\n'}
                  {'    '}<span className="text-pink-600">addi</span> sp, sp, <span className="text-emerald-600">16</span>{'\n'}
                  {'    '}<span className="text-pink-600">ret</span>
                </>
              )}
            </code>
          </motion.pre>
        </AnimatePresence>
        
        {/* Active Line Highlight Mockup */}
        {activeFile === 'assembly' && (
             <div className="absolute top-[170px] xl:top-[182px] left-0 right-0 h-6 border-l-4 border-cyan-400 bg-cyan-50/50 pointer-events-none" />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
