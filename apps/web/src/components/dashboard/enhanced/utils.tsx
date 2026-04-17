'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

export const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

export interface BadgeProps {
  children: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'indigo';
}

export function Badge({ children, color = 'blue' }: BadgeProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-700',
    indigo: 'bg-indigo-100 text-indigo-800',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded-full text-xs font-medium leading-tight ${colors[color]}`}>
      {children}
    </span>
  );
}

export interface RiskBadgeProps {
  level: string;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const map: Record<string, BadgeProps['color']> = {
    Low: 'green',
    'Low-Moderate': 'blue',
    Moderate: 'yellow',
    High: 'red',
  };
  return <Badge color={map[level] || 'gray'}>{level}</Badge>;
}

export function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: ReactNode;
}

export function Modal({ open, onClose, title, wide = false, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative bg-white rounded-xl shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-2xl'} w-full max-h-[90vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

