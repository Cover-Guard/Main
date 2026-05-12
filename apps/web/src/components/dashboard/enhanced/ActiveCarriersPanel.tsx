'use client';

import { useEffect, useState } from 'react';
import { Check, Send } from 'lucide-react';
import type { DashboardActiveCarrier, DashboardActiveCarriersResponse } from '@coverguard/shared';
import { getDashboardActiveCarriers } from '@/lib/api';
import { Badge, Modal } from './utils';

export function ActiveCarriersPanel() {
  const [response, setResponse] = useState<DashboardActiveCarriersResponse | null>(null);

  // PR-B1.h: pull carriers from API. Replaces the ACTIVE_CARRIERS mock.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- B1.h2 will refactor
  useEffect(() => { getDashboardActiveCarriers().then(setResponse).catch(() => setResponse(null)); }, []);

  const carriers = response?.carriers ?? [];
  const [quoteModal, setQuoteModal] = useState<DashboardActiveCarrier | null>(null);
  const [quoteSent, setQuoteSent] = useState(new Set<number>());

  const handleSendQuote = (carrierId: number) => {
    setQuoteSent((prev) => new Set(prev).add(carrierId));
    setTimeout(() => setQuoteModal(null), 1500);
  };

  return (
    <div className="space-y-2">
      {carriers.map((carrier) => (
        <div key={carrier.id} className="border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all bg-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-xs text-gray-900">{carrier.name}</span>
                <Badge color="indigo">{carrier.rating}</Badge>
                <Badge color={carrier.appetite === 'Strong' ? 'green' : carrier.appetite === 'Moderate' ? 'yellow' : 'red'}>{carrier.appetite}</Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Properties:</span> {carrier.properties.join(', ')}</p>
                <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Clients:</span> {carrier.clients.join(', ')}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500"><span className="font-medium text-gray-700">Quote:</span> {carrier.quoteRange}</span>
                  <span className="text-xs text-gray-500"><span className="font-medium text-gray-700">Response:</span> {carrier.responseTime}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
              {carrier.bindingReady && <Badge color="green">Binding Ready</Badge>}
              <button onClick={() => setQuoteModal(carrier)} disabled={quoteSent.has(carrier.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${quoteSent.has(carrier.id) ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {quoteSent.has(carrier.id) ? (<><Check size={11} /> Sent</>) : (<><Send size={11} /> Request Quote</>)}
              </button>
            </div>
          </div>
        </div>
      ))}

      <Modal open={!!quoteModal} onClose={() => setQuoteModal(null)} title="Confirm Quote Request">
        {quoteModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-2">You are about to send a potential binding offer request to:</p>
              <p className="font-semibold text-gray-900 text-sm">{quoteModal.name}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setQuoteModal(null)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleSendQuote(quoteModal.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                <Send size={12} /> Send Binding Offer Request
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
