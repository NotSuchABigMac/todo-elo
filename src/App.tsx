import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Play, ChevronLeft, Award, FileText, Clock, List, Target, AlertCircle, XCircle } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Task, Comparison } from './types';
import { calculateElo, getNextPair, addBusinessDays } from './utils/elo';
import './App.css';

function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('todo-elo-tasks', []);
  const [comparisons, setComparisons] = useLocalStorage<Comparison[]>('todo-elo-comparisons', []);
  const [view, setView] = useState<'focus' | 'list' | 'arena' | 'checkin'>('focus');
  const [newTaskText, setNewTaskText] = useState('');
  const [lastPrioritizedGlobal, setLastPrioritizedGlobal] = useLocalStorage<number>('last-prioritized-time', Date.now());
  
  const [currentPair, setCurrentPair] = useState<[Task, Task] | null>(null);
  const [checkinTask, setCheckinTask] = useState<Task | null>(null);
  const [questionsInSession, setQuestionsInSession] = useState(0);

  const now = Date.now();

  const formatSnoozeDate = (days: number) => {
    return new Date(addBusinessDays(new Date(), days)).toLocaleDateString(undefined, { weekday: 'short' });
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.score - a.score);
  }, [tasks]);

  const activeAndAvailableTasks = useMemo(() => {
    return sortedTasks.filter(t => t.active && (!t.snoozedUntil || t.snoozedUntil <= now) && !t.removedAt);
  }, [sortedTasks, now]);

  const snoozedTasks = useMemo(() => {
    return sortedTasks.filter(t => t.active && t.snoozedUntil && t.snoozedUntil > now && !t.removedAt);
  }, [sortedTasks, now]);

  const completedTasks = useMemo(() => {
    return sortedTasks.filter(t => !t.active && !t.removedAt);
  }, [sortedTasks]);

  const removedTasks = useMemo(() => {
    return sortedTasks.filter(t => !!t.removedAt);
  }, [sortedTasks]);

  const topTask = activeAndAvailableTasks[0];

  const unprioritizedCount = useMemo(() => {
    return activeAndAvailableTasks.filter(t => !t.lastPrioritizedAt).length;
  }, [activeAndAvailableTasks]);

  const needsPrioritization = (unprioritizedCount > 0 && activeAndAvailableTasks.length >= 2) || (now - lastPrioritizedGlobal > 60 * 60 * 1000 && activeAndAvailableTasks.length >= 2);

  const staleTask = useMemo(() => {
    // A task is stale if it hasn't been checked/prioritized in 3 business days
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); 
    return activeAndAvailableTasks.find(t => (t.lastCheckedAt || t.createdAt) < threeDaysAgo);
  }, [activeAndAvailableTasks]);

  useEffect(() => {
    if (staleTask && view === 'focus') {
      setCheckinTask(staleTask);
      setView('checkin');
    }
  }, [staleTask, view]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      score: 1000,
      createdAt: Date.now(),
      active: true,
    };
    
    setTasks([...tasks, newTask]);
    setNewTaskText('');
  };

  const toggleComplete = (id: string) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, active: !t.active, completedAt: !t.active ? Date.now() : undefined, lastCheckedAt: Date.now() } : t);
    setTasks(updatedTasks);
    
    if (view === 'focus' || view === 'checkin') {
      setLastPrioritizedGlobal(0); // Trigger prompt to prioritize after finishing a task
      if (view === 'checkin') setView('focus');
    }

    if (view === 'arena') {
      const nextPair = getNextPair(updatedTasks, comparisons);
      if (nextPair) setCurrentPair(nextPair);
      else setView('focus');
    }
  };

  const removeTask = (id: string) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, removedAt: Date.now(), active: false } : t);
    setTasks(updatedTasks);
    
    if (view === 'checkin') setView('focus');
    
    if (view === 'arena') {
      const nextPair = getNextPair(updatedTasks, comparisons);
      if (nextPair) setCurrentPair(nextPair);
      else setView('focus');
    }
  };

  const hardDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    setComparisons(comparisons.filter(c => c.winnerId !== id && c.loserId !== id));
  };

  const snoozeTask = (id: string, days: number) => {
    const until = addBusinessDays(new Date(), days);
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, snoozedUntil: until, lastCheckedAt: Date.now() } : t);
    setTasks(updatedTasks);
    
    if (view === 'arena') {
      const nextPair = getNextPair(updatedTasks, comparisons);
      if (nextPair) setCurrentPair(nextPair);
      else setView('focus');
    } else if (view === 'checkin') {
      setView('focus');
    }
  };

  const handleWin = (winnerId: string, loserId: string) => {
    const winner = tasks.find(t => t.id === winnerId)!;
    const loser = tasks.find(t => t.id === loserId)!;
    
    const { newWinnerScore, newLoserScore } = calculateElo(winner.score, loser.score);
    
    const updatedTasks = tasks.map(t => {
      if (t.id === winnerId) return { ...t, score: newWinnerScore, lastPrioritizedAt: Date.now(), lastCheckedAt: Date.now() };
      if (t.id === loserId) return { ...t, score: newLoserScore, lastPrioritizedAt: Date.now(), lastCheckedAt: Date.now() };
      return t;
    });
    
    const newComparisons = [...comparisons, { winnerId, loserId, timestamp: Date.now() }];
    const newQuestionsCount = questionsInSession + 1;
    
    setTasks(updatedTasks);
    setComparisons(newComparisons);
    setLastPrioritizedGlobal(Date.now());
    setQuestionsInSession(newQuestionsCount);
    
    const nextPair = getNextPair(updatedTasks, newComparisons);
    
    // Logic: 
    // 1. If no more pairs, exit.
    // 2. If < 3 questions, keep going.
    // 3. If >= 3 questions, check if we've found the King (the #1 spot is stable).
    if (!nextPair) {
      setView('focus');
      return;
    }

    const currentKingId = [...updatedTasks].sort((a,b) => b.score - a.score)[0].id;
    const isStillHuntingKing = nextPair[0].id === currentKingId;

    if (newQuestionsCount < 3 || isStillHuntingKing) {
      setCurrentPair(nextPair);
    } else {
      setView('focus');
    }
  };

  const startArena = () => {
    const pair = getNextPair(tasks, comparisons);
    if (pair) {
      setQuestionsInSession(0);
      setCurrentPair(pair);
      setView('arena');
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/);
      
      const newTasks: Task[] = lines
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('task,score'))
        .map(text => ({
          id: crypto.randomUUID(),
          text: text.replace(/^"|"$/g, ''),
          score: 1000,
          createdAt: Date.now(),
          active: true,
        }));

      if (newTasks.length > 0) setTasks(prev => [...prev, ...newTasks]);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className={`container ${(view === 'arena' || view === 'checkin') ? 'wide' : ''}`}>
      <nav className="main-nav">
        <div className="nav-group">
          <button className={view === 'focus' ? 'active' : ''} onClick={() => setView('focus')}><Target size={20}/> Focus</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={20}/> All Tasks</button>
        </div>
        {needsPrioritization && (
          <button className="nav-alert" onClick={startArena}>
            <AlertCircle size={18} /> Prioritize Needed
          </button>
        )}
      </nav>

      <form onSubmit={addTask} className="global-task-input">
        <input 
          type="text" 
          placeholder="New task..." 
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
        />
        <button type="submit"><Plus size={20}/></button>
      </form>

      {view === 'focus' && (
        <main className="focus-view animate-in">
          {topTask ? (
            <div className="focus-card">
              <span className="focus-label">Current Priority</span>
              <h2 className="focus-task-text">{topTask.text}</h2>
              <div className="focus-actions">
                <button className="btn-done-large" onClick={() => toggleComplete(topTask.id)}>
                  <CheckCircle2 size={24} /> Mark as Done
                </button>
                <div className="focus-secondary-actions">
                   <button onClick={() => snoozeTask(topTask.id, 1)}>Snooze {formatSnoozeDate(1)}</button>
                   <button className="btn-text-danger" onClick={() => removeTask(topTask.id)}>Remove</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-focus">
              <Award size={48} />
              <h2>All caught up!</h2>
              <p>Add a new task or enjoy your free time.</p>
            </div>
          )}
        </main>
      )}

      {view === 'checkin' && checkinTask && (
        <main className="arena animate-in">
          <div className="arena-header">
            <Clock size={32} />
            <h2>Task Check-in</h2>
            <p>You haven't touched this in a while. What's the status?</p>
          </div>
          <div className="battleground">
            <div className="choice-card single-card">
               <div className="card-main-action">{checkinTask.text}</div>
               <div className="card-footer">
                  <div className="card-snooze-options">
                    <button onClick={() => snoozeTask(checkinTask.id, 3)}>Snooze {formatSnoozeDate(3)}</button>
                    <button onClick={() => snoozeTask(checkinTask.id, 5)}>Snooze {formatSnoozeDate(5)}</button>
                    <button className="btn-text-danger" onClick={() => removeTask(checkinTask.id)}>Remove</button>
                  </div>
                  <button className="card-done-action" onClick={() => {
                    setTasks(tasks.map(t => t.id === checkinTask.id ? { ...t, lastCheckedAt: Date.now() } : t));
                    setView('focus');
                  }}>
                    <CheckCircle2 size={20} /> Still Important
                  </button>
               </div>
            </div>
          </div>
        </main>
      )}

      {view === 'arena' && (
        <main className="arena animate-in">
          <button className="btn-back" onClick={() => setView('focus')}>
            <ChevronLeft size={20} /> Exit Arena
          </button>
          
          <div className="arena-header">
            <Award size={32} />
            <h2>Which is more important?</h2>
            <div className="session-progress">
              {questionsInSession < 3 ? (
                <span>Step {questionsInSession + 1} of 3</span>
              ) : (
                <span>Refining further...</span>
              )}
            </div>
          </div>

          <div className="battleground">
            {currentPair && (
              <>
                <div className="choice-card">
                  <button className="card-main-action" onClick={() => handleWin(currentPair[0].id, currentPair[1].id)}>
                    {currentPair[0].text}
                  </button>
                  <div className="card-footer">
                    <div className="card-snooze-options">
                      <span>Snooze</span>
                      <button onClick={() => snoozeTask(currentPair[0].id, 1)}>{formatSnoozeDate(1)}</button>
                      <button onClick={() => snoozeTask(currentPair[0].id, 3)}>{formatSnoozeDate(3)}</button>
                      <button onClick={() => snoozeTask(currentPair[0].id, 5)}>{formatSnoozeDate(5)}</button>
                      <button className="btn-text-danger" onClick={() => removeTask(currentPair[0].id)} title="Remove Task">X</button>
                    </div>
                    <button className="card-done-action" onClick={() => toggleComplete(currentPair[0].id)}>
                      <CheckCircle2 size={20} /> Done
                    </button>
                  </div>
                </div>
                <div className="vs">VS</div>
                <div className="choice-card">
                  <button className="card-main-action" onClick={() => handleWin(currentPair[1].id, currentPair[0].id)}>
                    {currentPair[1].text}
                  </button>
                  <div className="card-footer">
                    <div className="card-snooze-options">
                      <span>Snooze</span>
                      <button onClick={() => snoozeTask(currentPair[1].id, 1)}>{formatSnoozeDate(1)}</button>
                      <button onClick={() => snoozeTask(currentPair[1].id, 3)}>{formatSnoozeDate(3)}</button>
                      <button onClick={() => snoozeTask(currentPair[1].id, 5)}>{formatSnoozeDate(5)}</button>
                      <button className="btn-text-danger" onClick={() => removeTask(currentPair[1].id)} title="Remove Task">X</button>
                    </div>
                    <button className="card-done-action" onClick={() => toggleComplete(currentPair[1].id)}>
                      <CheckCircle2 size={20} /> Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {view === 'list' && (
        <main className="dashboard animate-in">
          <header>
            <h1>All Tasks</h1>
            <div className="header-actions">
              <label className="btn-secondary">
                <FileText size={18} /> Import CSV
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={handleImportCSV} 
                  style={{ display: 'none' }} 
                />
              </label>
              <button className="btn-primary" onClick={startArena}>
                <Play size={18} /> Prioritize
              </button>
            </div>
          </header>

          <div className="task-list">
            {activeAndAvailableTasks.length > 0 && (
              <section className="task-section">
                <h3>Active</h3>
                {activeAndAvailableTasks.map((task, index) => (
                  <div key={task.id} className="task-item">
                    <div className="task-rank">{index + 1}</div>
                    <button className="task-check" onClick={() => toggleComplete(task.id)}>
                      <CheckCircle2 size={20} className="icon-hollow" />
                    </button>
                    <div className="task-content">
                      <span className="task-text">{task.text}</span>
                      <span className="task-score">{task.score} ELO</span>
                    </div>
                    <div className="task-actions">
                      <div className="snooze-options">
                        <button onClick={() => snoozeTask(task.id, 1)} title="Snooze 1d">{formatSnoozeDate(1)}</button>
                        <button onClick={() => snoozeTask(task.id, 3)} title="Snooze 3d">{formatSnoozeDate(3)}</button>
                        <button onClick={() => snoozeTask(task.id, 5)} title="Snooze 5d">{formatSnoozeDate(5)}</button>
                      </div>
                      <button className="task-delete" onClick={() => removeTask(task.id)} title="Remove task">
                        <XCircle size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {snoozedTasks.length > 0 && (
              <section className="task-section snoozed-section">
                <h3>Snoozed</h3>
                {snoozedTasks.map((task) => (
                  <div key={task.id} className="task-item snoozed">
                    <div className="task-icon"><Clock size={16} /></div>
                    <div className="task-content">
                      <span className="task-text">{task.text}</span>
                      <span className="task-meta">Until {new Date(task.snoozedUntil!).toLocaleDateString()}</span>
                    </div>
                    <div className="task-actions">
                      <button className="task-unsnooze" onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, snoozedUntil: undefined } : t))}>
                        Wake
                      </button>
                      <button className="task-delete" onClick={() => removeTask(task.id)} title="Remove task">
                        <XCircle size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {completedTasks.length > 0 && (
              <section className="task-section completed-section">
                <h3>Completed</h3>
                {completedTasks.map((task) => (
                  <div key={task.id} className="task-item completed">
                    <button className="task-check" onClick={() => toggleComplete(task.id)}>
                      <CheckCircle2 size={20} className="icon-filled" />
                    </button>
                    <div className="task-content">
                      <span className="task-text">{task.text}</span>
                    </div>
                    <button className="task-delete" onClick={() => removeTask(task.id)} title="Remove task">
                      <XCircle size={18} />
                    </button>
                  </div>
                ))}
              </section>
            )}

            {removedTasks.length > 0 && (
              <section className="task-section removed-section">
                <h3>No longer required</h3>
                {removedTasks.map((task) => (
                  <div key={task.id} className="task-item removed">
                    <div className="task-content">
                      <span className="task-text">{task.text}</span>
                      <span className="task-meta">Removed on {new Date(task.removedAt!).toLocaleDateString()}</span>
                    </div>
                    <div className="task-actions">
                      <button className="task-unsnooze" onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, removedAt: undefined, active: true } : t))}>
                        Restore
                      </button>
                      <button className="task-delete" onClick={() => hardDeleteTask(task.id)} title="Delete permanently">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tasks.length === 0 && (
              <div className="empty-state">
                <p>No tasks yet. Add something to get started!</p>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
