import { loadSession, nextStep, type SessionState } from '@oathly/api';
import { meSchema } from '@oathly/api/me';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, getToken, signOut as authSignOut } from './auth';
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

async function load(): Promise<State> {
  try {
    const live = await loadSession({ getToken }, api);
    if (live.status === 'signed-in') void kv.set(ME_KEY, JSON.stringify(live.me));
    else void kv.remove(ME_KEY);
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
