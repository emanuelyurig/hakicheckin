import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';

// Detect if we should use local storage fallback (mock mode)
export const isMock = 
  !url || 
  !key || 
  url.includes('YOUR_') || 
  url.includes('MY_') || 
  key.includes('YOUR_') || 
  key.includes('MY_') || 
  url === '' || 
  key === '';

export const supabase = isMock ? null : createClient(url, key);

// Mock Realtime PubSub system for LocalStorage mode
type RealtimeCallback = (payload: { event: string; new?: any; old?: any }) => void;

class MockRealtimeHub {
  private listeners: Set<RealtimeCallback> = new Set();

  subscribe(callback: RealtimeCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  publish(event: 'INSERT' | 'UPDATE' | 'DELETE', table: 'aulas' | 'presencas', record: any, oldRecord?: any) {
    const payload = {
      event,
      new: record,
      old: oldRecord,
      table,
    };
    
    // Notify same window
    this.listeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Error in mock realtime listener:', err);
      }
    });

    // Notify other windows/tabs using BroadcastChannel (if available)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('supabase_mock_realtime');
        bc.postMessage(payload);
        bc.close();
      } catch (err) {
        // Ignore broadcast channel errors in some environments
      }
    }
  }

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('supabase_mock_realtime');
        bc.onmessage = (event) => {
          this.listeners.forEach((cb) => {
            try {
              cb(event.data);
            } catch (err) {
              console.error('Error in mock realtime broadcast listener:', err);
            }
          });
        };
      } catch (err) {
        // Ignore
      }
    }
  }
}

export const mockRealtimeHub = new MockRealtimeHub();
