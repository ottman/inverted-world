import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recursiv } from '@recursiv/sdk';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { BASE_ORIGIN, createAuthedSdk, ORG_ID } from '@/lib/recursiv';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  sdk: Recursiv | null;
  orgId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const secureStorage = {
  getItemAsync: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItemAsync: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

const KEYS = {
  apiKey: 'inverted_world_api_key',
  user: 'inverted_world_user',
  orgId: 'inverted_world_org_id',
  version: 'inverted_world_auth_version',
};

const AUTH_VERSION = '1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sdk, setSdk] = useState<Recursiv | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearStorage = useCallback(async () => {
    await Promise.all([
      secureStorage.deleteItemAsync(KEYS.apiKey),
      secureStorage.deleteItemAsync(KEYS.user),
      secureStorage.deleteItemAsync(KEYS.orgId),
      AsyncStorage.removeItem('@inverted_world_research_desk'),
    ]);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const storedVersion = await secureStorage.getItemAsync(KEYS.version);
      if (storedVersion !== AUTH_VERSION) {
        await clearStorage();
        await secureStorage.setItemAsync(KEYS.version, AUTH_VERSION);
        return;
      }

      const [storedApiKey, storedUser, storedOrgId] = await Promise.all([
        secureStorage.getItemAsync(KEYS.apiKey),
        secureStorage.getItemAsync(KEYS.user),
        secureStorage.getItemAsync(KEYS.orgId),
      ]);

      if (storedApiKey && storedUser) {
        const authedSdk = createAuthedSdk(storedApiKey);
        try {
          await authedSdk.users.me();
          setSdk(authedSdk);
          setUser(JSON.parse(storedUser) as AuthUser);
          setOrgId(storedOrgId || ORG_ID);
        } catch {
          await clearStorage();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearStorage]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const persistSession = useCallback(async (apiKey: string, authUser: AuthUser) => {
    const authedSdk = createAuthedSdk(apiKey);
    await Promise.all([
      secureStorage.setItemAsync(KEYS.apiKey, apiKey),
      secureStorage.setItemAsync(KEYS.user, JSON.stringify(authUser)),
      secureStorage.setItemAsync(KEYS.version, AUTH_VERSION),
      secureStorage.setItemAsync(KEYS.orgId, ORG_ID),
    ]);
    setSdk(authedSdk);
    setUser(authUser);
    setOrgId(ORG_ID);
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const body = await authFetch('/api/auth/sign-up/email', { name, email, password });
      const sessionToken = body?.session?.token || body?.token;
      if (!sessionToken) throw new Error('No session token returned from sign up');
      const apiKey = await createApiKeyWithSession(sessionToken);
      if (!apiKey) throw new Error('Failed to create Recursiv API key');
      await persistSession(apiKey, {
        id: body.user?.id || body.id,
        name: body.user?.name || name,
        email: body.user?.email || email,
        image: body.user?.image ?? null,
      });
    },
    [persistSession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const body = await authFetch('/api/auth/sign-in/email', { email, password });
      const sessionToken = body?.session?.token || body?.token;
      if (!sessionToken) throw new Error('No session token returned from sign in');
      const apiKey = await createApiKeyWithSession(sessionToken);
      if (!apiKey) throw new Error('Failed to create Recursiv API key');
      await persistSession(apiKey, {
        id: body.user?.id || body.id,
        name: body.user?.name || email.split('@')[0],
        email: body.user?.email || email,
        image: body.user?.image ?? null,
      });
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    fetch(`${BASE_ORIGIN}/api/auth/sign-out`, { method: 'POST', credentials: 'include' }).catch(
      () => {},
    );
    await clearStorage();
    setSdk(null);
    setUser(null);
    setOrgId(null);
  }, [clearStorage]);

  const value = useMemo(
    () => ({
      user,
      sdk,
      orgId,
      isLoading,
      isAuthenticated: Boolean(user && sdk),
      signUp,
      signIn,
      signOut,
    }),
    [user, sdk, orgId, isLoading, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function authFetch(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${BASE_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_ORIGIN,
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const rawText = await response.text();
  if (!response.ok) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {}
    throw new Error(parsed.message || parsed.code || `Auth failed (${response.status})`);
  }
  return JSON.parse(rawText);
}

async function createApiKeyWithSession(sessionToken: string): Promise<string | null> {
  const response = await fetch(`${BASE_ORIGIN}/api/v1/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      name: `inverted-world-${Date.now()}`,
      organizationId: ORG_ID,
      scopes: [
        'users:read',
        'chat:read',
        'chat:write',
        'projects:read',
        'projects:write',
        'agents:read',
        'agents:write',
        'storage:read',
        'storage:write',
        'organizations:read',
        'databases:read',
        'databases:write',
        'commands:read',
        'commands:write',
      ],
    }),
  });

  if (!response.ok) return null;
  const { data } = await response.json();
  return data?.key || null;
}
