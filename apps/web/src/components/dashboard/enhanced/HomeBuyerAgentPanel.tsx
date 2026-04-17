'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { MESSAGES } from './mockData';
import type { Message } from './types';

export function HomeBuyerAgentPanel() {
  const [newMsg, setNewMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);

  const handleSend = () => {
    if (!newMsg.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        from: 'buyer',
        name: 'You',
        text: newMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMsg('');
  };

  return (
    <div className="flex flex-col" style={{ height: 280 }}>
      <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs rounded-lg px-2.5 py-1.5 ${
                msg.from === 'buyer' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className={`text-xs font-medium mb-0.5 ${msg.from === 'buyer' ? 'text-indigo-200' : 'text-gray-500'}`}>
                {msg.name}
              </p>
              <p className="text-xs leading-relaxed">{msg.text}</p>
              <p className={`text-xs mt-0.5 ${msg.from === 'buyer' ? 'text-indigo-300' : 'text-gray-400'}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t pt-2">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message your agent..."
          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
