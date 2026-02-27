export interface Task {
  id: string;
  text: string;
  score: number;
  createdAt: number;
  completedAt?: number;
  snoozedUntil?: number;
  lastPrioritizedAt?: number;
  lastCheckedAt?: number;
  removedAt?: number;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  active: boolean;
}

export type RecurringInterval = 'daily' | 'weekly' | 'monthly';

export interface Comparison {
  winnerId: string;
  loserId: string;
  timestamp: number;
}

export type Theme = 'light' | 'dark' | 'system';
