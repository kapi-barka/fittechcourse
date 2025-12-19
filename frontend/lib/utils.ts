/**
 * Helper functions
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDayName(dayNumber: number): string {
  const days = [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье'
  ]
  // dayNumber 1-7
  if (dayNumber >= 1 && dayNumber <= 7) {
    return days[dayNumber - 1]
  }
  return `День ${dayNumber}`
}

export function round(value: number | undefined | null, decimals: number = 0): number {
  if (value === undefined || value === null) return 0
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function formatDate(dateString: string): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
