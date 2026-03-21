import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RiskLevel } from '@coverguard/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function riskLevelClasses(level: RiskLevel): string {
  return {
    LOW:       'bg-green-100 text-green-800 border-green-200',
    MODERATE:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    HIGH:      'bg-orange-100 text-orange-800 border-orange-200',
    VERY_HIGH: 'bg-red-100 text-red-800 border-red-200',
    EXTREME:   'bg-red-900 text-red-100 border-red-800',
  }[level]
}

export function riskScoreColor(score: number): string {
  if (score <= 25) return 'text-green-600'
  if (score <= 50) return 'text-yellow-600'
  if (score <= 70) return 'text-orange-600'
  if (score <= 85) return 'text-red-600'
  return 'text-red-900'
}
