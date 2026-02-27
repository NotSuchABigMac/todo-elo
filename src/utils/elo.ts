import { Task, Comparison } from '../types';

const K = 32;

export const calculateElo = (winnerScore: number, loserScore: number) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerScore - loserScore) / 400));

  const newWinnerScore = Math.round(winnerScore + K * (1 - expectedWinner));
  const newLoserScore = Math.round(loserScore + K * (0 - expectedLoser));

  return { newWinnerScore, newLoserScore };
};

export const getNextPair = (tasks: Task[], comparisons: Comparison[]): [Task, Task] | null => {
  const now = Date.now();
  const activeTasks = tasks.filter(t => t.active && (!t.snoozedUntil || t.snoozedUntil <= now) && !t.removedAt);
  if (activeTasks.length < 2) return null;
  
  // Build adjacency list for transitive inference (Directed Graph: Winner -> Loser)
  const adj = new Map<string, Set<string>>();
  comparisons.forEach(c => {
    if (!adj.has(c.winnerId)) adj.set(c.winnerId, new Set());
    adj.get(c.winnerId)!.add(c.loserId);
  });

  // Function to check if there's a path from start to end (Is start > end already inferred?)
  const hasPath = (start: string, end: string): boolean => {
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === end) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adj.get(curr);
        if (neighbors) queue.push(...Array.from(neighbors));
      }
    }
    return false;
  };

  // Find the 'King' (highest Elo task) and ensure it has actually earned its spot
  // by comparing it against others it hasn't defeated yet.
  const sortedByElo = [...activeTasks].sort((a, b) => b.score - a.score);

  for (const king of sortedByElo) {
    // Find contenders: tasks that this 'king' hasn't beaten yet (and hasn't been beaten by)
    const contenders = activeTasks
      .filter(t => t.id !== king.id)
      .filter(t => {
        // We only care if there is NO known relationship
        return !hasPath(king.id, t.id) && !hasPath(t.id, king.id);
      })
      .sort((a, b) => {
        // Prioritize comparing against other high-ELO tasks or new tasks (1000)
        return b.score - a.score;
      });

    if (contenders.length > 0) {
      // Pick the strongest contender to challenge the current king
      return [king, contenders[0]];
    }
    // If this king has defeated or is superior to everyone else, 
    // we are 100% sure about the #1 spot. Move to #2.
  }

  return null; // The entire list is perfectly ordered (rarely happens with many tasks)
};

export const addBusinessDays = (date: Date, days: number): number => {
  let count = 0;
  let current = new Date(date);
  while (count < days) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sat/Sun
      count++;
    }
  }
  return current.getTime();
};
