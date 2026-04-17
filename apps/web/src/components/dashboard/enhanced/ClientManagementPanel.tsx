'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CLIENTS } from './mockData';
import type { Client } from './types';
import { Badge, BadgeProps, fmt } from './utils';

export function ClientManagementPanel() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const statusColors: Record<string, BadgeProps['color']> = { Active: 'green', 'At Risk': 'red', Prospect: 'yellow' };

  return (
    <div className="space-y-2">
      {CLIENTS.map((client) => (
        <div
          key={client.id}
          className="border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all bg-white cursor-pointer"
          onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-600">{client.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-xs text-gray-900">{client.name}</p>
                  <Badge color={statusColors[client.status]}>{client.status}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {client.contact} · {client.properties} property · {fmt(client.totalValue)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400">{client.lastContact}</span>
              {selectedClient?.id === client.id ? (
                <ChevronUp size={12} className="text-gray-400" />
              ) : (
                <ChevronDown size={12} className="text-gray-400" />
              )}
            </div>
          </div>
          {selectedClient?.id === client.id && (
            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{client.email}</span>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{client.phone}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Notes:</span> <span className="font-medium text-gray-900">{client.notes}</span>
              </div>
              <div className="col-span-2 flex gap-1.5 mt-1">
                <button className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                  Send Message
                </button>
                <button className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
                  View Properties
                </button>
                <button className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
                  Schedule Call
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
