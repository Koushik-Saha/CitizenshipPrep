import { loadSession, nextStep, type SessionState } from '@oathly/api';
import { meSchema } from '@oathly/api/me';
import { queryKeys } from '@oathly/api/queries';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api, getToken, signOut as authSignOut } from './auth';
import { purchases } from './purchases';
import { queryClient } from './query';
import { kv } from './storage';

type State = SessionState | { status: 'loading' } | { status: 'error'; message: string };

type Session = State & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

/** The learner as last seen online, so the app opens without a connection. */
const ME_KEY = 'oathly.me.v1';

/** What the learner held when last asked, to notice when it changes. */
let lastPlan: string | null = null;

async function load(): Promise<State> {
  try {
    const live = await loadSession({ getToken }, api);
    if (live.status === 'signed-in') {
      void kv.set(ME_KEY, JSON.stringify(live.me));
      // A plan bought or ended, here or on another device, changes what the
      // dashboard should show: have it asked for again.
      const plan = JSON.stringify(live.me.entitlements);
      if (lastPlan !== null && plan !== lastPlan) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      }
      lastPlan = plan;
    } else {
      void kv.remove(ME_KEY);
      lastPlan = null;
    }
    return live;
  } catch (error) {
    // No connection, or the server is down: carry on as whoever last signed
    // in on this phone. Nothing they do offline reaches the server until the
    // session is checked again.
    const saved = await kv.get(ME_KEY);
    if (saved) {
      try {
        const me = meSchema.parse(JSON.parse(saved));
        return { status: 'signed-in', me, step: nextStep(me) };
      } catch {
        // An unreadable snapshot is no snapshot.
      }
    }
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState(await load());
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    // The store should not credit the next person's purchases to this one.
    await purchases.forget();
    await kv.remove(ME_KEY);
    queryClient.clear();
    setState({ status: 'signed-out' });
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  // Coming back to the app, ask again who this is and what they hold: a plan
  // bought on the web, or cancelled there, should not wait for a restart.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      void load().then((next) => {
        // A check that could not be made is no reason to drop a working session.
        setState((current) =>
          next.status === 'error' && current.status === 'signed-in' ? current : next,
        );
      });
    });
    return () => subscription.remove();
  }, []);

  return (
    <SessionContext.Provider value={{ ...state, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
