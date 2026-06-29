import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Dashboard Store Types & Interfaces
// ============================================================================

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface Stats {
  totalChecks: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  criticalCount: number;
  averageScore: number;
  lastUpdated: string | null;
}

interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  lastMessage: string | null;
}

interface DashboardState {
  // Stats
  stats: Stats;
  updateStats: (partial: Partial<Stats>) => void;
  incrementCheck: (riskLevel: 'low' | 'medium' | 'high' | 'critical', score: number) => void;
  
  // Alerts
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => void;
  clearAlert: (id: string) => void;
  clearAllAlerts: () => void;
  markAlertRead: (id: string) => void;
  
  // WebSocket
  wsState: WebSocketState;
  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;
  setWsError: (error: string | null) => void;
  setWsLastMessage: (message: string | null) => void;
  resetWsState: () => void;
}

// ============================================================================
// Dashboard Store Implementation
// ============================================================================

const initialStats: Stats = {
  totalChecks: 0,
  highRiskCount: 0,
  mediumRiskCount: 0,
  lowRiskCount: 0,
  criticalCount: 0,
  averageScore: 0,
  lastUpdated: null,
};

const initialWsState: WebSocketState = {
  connected: false,
  reconnecting: false,
  error: null,
  lastMessage: null,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      stats: { ...initialStats },
      alerts: [],
      wsState: { ...initialWsState },

      updateStats: (partial) =>
        set((state) => ({
          stats: {
            ...state.stats,
            ...partial,
            lastUpdated: new Date().toISOString(),
          },
        })),

  incrementCheck: (riskLevel, score) =>
        set((state) => {
          const newTotal = state.stats.totalChecks + 1;
          const currentSum = state.stats.averageScore * state.stats.totalChecks;
          const newAverage = (currentSum + score) / newTotal;
          const countKey = riskLevel === 'critical' ? 'criticalCount' : `${riskLevel}RiskCount`;

          return {
            stats: {
              ...state.stats,
              totalChecks: newTotal,
              [countKey]: (state.stats[countKey as keyof Stats] as number) + 1,
              averageScore: Math.round(newAverage * 100) / 100,
              lastUpdated: new Date().toISOString(),
            },
          };
        }),

      addAlert: (alert) =>
        set((state) => ({
          alerts: [
            {
              ...alert,
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              read: false,
            },
            ...state.alerts,
          ].slice(0, 100), // Keep max 100 alerts
        })),

      clearAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),

      clearAllAlerts: () => set({ alerts: [] }),

      markAlertRead: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, read: true } : a
          ),
        })),

      setWsConnected: (connected) =>
        set((state) => ({
          wsState: { ...state.wsState, connected, error: connected ? null : state.wsState.error },
        })),

      setWsReconnecting: (reconnecting) =>
        set((state) => ({
          wsState: { ...state.wsState, reconnecting },
        })),

      setWsError: (error) =>
        set((state) => ({
          wsState: { ...state.wsState, error, connected: error ? false : state.wsState.connected },
        })),

      setWsLastMessage: (message) =>
        set((state) => ({
          wsState: { ...state.wsState, lastMessage: message },
        })),

      resetWsState: () => set({ wsState: { ...initialWsState } }),
    }),
    {
      name: 'dashboard-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ stats: state.stats, alerts: state.alerts }),
    }
  )
);

// ============================================================================
// Tests
// ============================================================================

describe('Dashboard Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDashboardStore.setState({
      stats: { ...initialStats },
      alerts: [],
      wsState: { ...initialWsState },
    });
    // Clear localStorage mock
    window.localStorage.clear();
  });

  describe('stats', () => {
    it('should have initial stats', () => {
      const state = useDashboardStore.getState();
      expect(state.stats.totalChecks).toBe(0);
      expect(state.stats.averageScore).toBe(0);
      expect(state.stats.lastUpdated).toBeNull();
    });

    it('should update stats', () => {
      const { updateStats } = useDashboardStore.getState();
      updateStats({ totalChecks: 10, highRiskCount: 3 });
      
      const state = useDashboardStore.getState();
      expect(state.stats.totalChecks).toBe(10);
      expect(state.stats.highRiskCount).toBe(3);
      expect(state.stats.lastUpdated).not.toBeNull();
    });

    it('should increment check and update average score', () => {
      const { incrementCheck } = useDashboardStore.getState();
      
      incrementCheck('high', 85);
      let state = useDashboardStore.getState();
      expect(state.stats.totalChecks).toBe(1);
      expect(state.stats.highRiskCount).toBe(1);
      expect(state.stats.averageScore).toBe(85);

      incrementCheck('low', 15);
      state = useDashboardStore.getState();
      expect(state.stats.totalChecks).toBe(2);
      expect(state.stats.lowRiskCount).toBe(1);
      expect(state.stats.averageScore).toBe(50);
    });

    it('should handle multiple increments correctly', () => {
      const { incrementCheck } = useDashboardStore.getState();
      
      incrementCheck('critical', 95);
      incrementCheck('critical', 90);
      incrementCheck('high', 75);
      
      const state = useDashboardStore.getState();
      expect(state.stats.totalChecks).toBe(3);
      expect(state.stats.criticalCount).toBe(2);
      expect(state.stats.highRiskCount).toBe(1);
      expect(state.stats.averageScore).toBe(86.67);
    });

    it('should preserve other stats when updating partial', () => {
      const { updateStats } = useDashboardStore.getState();
      updateStats({ totalChecks: 5, lowRiskCount: 2 });
      
      const state = useDashboardStore.getState();
      expect(state.stats.highRiskCount).toBe(0); // preserved
      expect(state.stats.mediumRiskCount).toBe(0); // preserved
    });
  });

  describe('alerts', () => {
    it('should start with empty alerts', () => {
      const state = useDashboardStore.getState();
      expect(state.alerts).toEqual([]);
    });

    it('should add an alert with generated id and timestamp', () => {
      const { addAlert } = useDashboardStore.getState();
      addAlert({ type: 'warning', title: 'Test Alert', message: 'Something happened' });
      
      const state = useDashboardStore.getState();
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].title).toBe('Test Alert');
      expect(state.alerts[0].type).toBe('warning');
      expect(state.alerts[0].id).toBeDefined();
      expect(state.alerts[0].timestamp).toBeDefined();
      expect(state.alerts[0].read).toBe(false);
    });

    it('should add multiple alerts and keep newest first', () => {
      const { addAlert } = useDashboardStore.getState();
      addAlert({ type: 'info', title: 'First', message: 'msg1' });
      addAlert({ type: 'error', title: 'Second', message: 'msg2' });
      
      const state = useDashboardStore.getState();
      expect(state.alerts).toHaveLength(2);
      expect(state.alerts[0].title).toBe('Second');
    });

    it('should clear a specific alert', () => {
      const { addAlert, clearAlert } = useDashboardStore.getState();
      addAlert({ type: 'info', title: 'Keep', message: 'keep' });
      addAlert({ type: 'warning', title: 'Remove', message: 'remove' });
      
      const idToRemove = useDashboardStore.getState().alerts[0].id;
      clearAlert(idToRemove);
      
      const state = useDashboardStore.getState();
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].title).toBe('Keep');
    });

    it('should clear all alerts', () => {
      const { addAlert, clearAllAlerts } = useDashboardStore.getState();
      addAlert({ type: 'info', title: '1', message: 'm1' });
      addAlert({ type: 'error', title: '2', message: 'm2' });
      
      clearAllAlerts();
      
      const state = useDashboardStore.getState();
      expect(state.alerts).toHaveLength(0);
    });

    it('should mark alert as read', () => {
      const { addAlert, markAlertRead } = useDashboardStore.getState();
      addAlert({ type: 'info', title: 'Unread', message: 'test' });
      
      const id = useDashboardStore.getState().alerts[0].id;
      expect(useDashboardStore.getState().alerts[0].read).toBe(false);
      
      markAlertRead(id);
      
      const state = useDashboardStore.getState();
      expect(state.alerts[0].read).toBe(true);
    });

    it('should limit alerts to 100', () => {
      const { addAlert } = useDashboardStore.getState();
      
      for (let i = 0; i < 105; i++) {
        addAlert({ type: 'info', title: `Alert ${i}`, message: 'msg' });
      }
      
      const state = useDashboardStore.getState();
      expect(state.alerts).toHaveLength(100);
    });
  });

  describe('WebSocket state', () => {
    it('should have initial disconnected state', () => {
      const state = useDashboardStore.getState();
      expect(state.wsState.connected).toBe(false);
      expect(state.wsState.reconnecting).toBe(false);
      expect(state.wsState.error).toBeNull();
    });

    it('should set connected state', () => {
      const { setWsConnected } = useDashboardStore.getState();
      setWsConnected(true);
      
      const state = useDashboardStore.getState();
      expect(state.wsState.connected).toBe(true);
      expect(state.wsState.error).toBeNull();
    });

    it('should set reconnecting state', () => {
      const { setWsReconnecting } = useDashboardStore.getState();
      setWsReconnecting(true);
      
      const state = useDashboardStore.getState();
      expect(state.wsState.reconnecting).toBe(true);
    });

    it('should set error and disconnect', () => {
      const { setWsConnected, setWsError } = useDashboardStore.getState();
      setWsConnected(true);
      setWsError('Connection lost');
      
      const state = useDashboardStore.getState();
      expect(state.wsState.error).toBe('Connection lost');
      expect(state.wsState.connected).toBe(false);
    });

    it('should set last message', () => {
      const { setWsLastMessage } = useDashboardStore.getState();
      setWsLastMessage('{"event":"risk.update"}');
      
      const state = useDashboardStore.getState();
      expect(state.wsState.lastMessage).toBe('{"event":"risk.update"}');
    });

    it('should reset WebSocket state', () => {
      const { setWsConnected, setWsError, setWsLastMessage, resetWsState } = useDashboardStore.getState();
      setWsConnected(true);
      setWsError('Some error');
      setWsLastMessage('msg');
      
      resetWsState();
      
      const state = useDashboardStore.getState();
      expect(state.wsState.connected).toBe(false);
      expect(state.wsState.error).toBeNull();
      expect(state.wsState.lastMessage).toBeNull();
      expect(state.wsState.reconnecting).toBe(false);
    });

    it('should handle full WebSocket lifecycle', () => {
      const { setWsConnected, setWsReconnecting, setWsError, setWsLastMessage } = useDashboardStore.getState();
      
      // Initial -> Connecting
      setWsReconnecting(true);
      expect(useDashboardStore.getState().wsState.reconnecting).toBe(true);
      
      // Connecting -> Connected
      setWsConnected(true);
      let state = useDashboardStore.getState();
      expect(state.wsState.connected).toBe(true);
      expect(state.wsState.reconnecting).toBe(true); // remains true until explicitly set
      
      // Receive message
      setWsLastMessage('test');
      expect(useDashboardStore.getState().wsState.lastMessage).toBe('test');
      
      // Error -> Disconnected
      setWsError('Connection failed');
      state = useDashboardStore.getState();
      expect(state.wsState.connected).toBe(false);
      expect(state.wsState.error).toBe('Connection failed');
    });
  });
});
