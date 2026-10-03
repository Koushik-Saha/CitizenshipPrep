import { loadSession, type SessionState } from '@oathly/api';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, getToken, signOut as authSignOut } from './auth';

type State = SessionState | { status: 'loading' } | { status: 'error'; message: string };

type Session = State & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

async function load(): Promise<State> {
  try {
    return await loadSession({ getToken }, api);
  } catch (error) {
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
