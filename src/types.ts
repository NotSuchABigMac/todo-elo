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
  active: boolean;
}

export interface Comparison {
  winnerId: string;
  loserId: string;
  timestamp: number;
}
