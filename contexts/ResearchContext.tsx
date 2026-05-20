import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useRecursiv } from './RecursivContext';
import { ensureDatabase, dbQuery } from '@/lib/database';
import { DEFAULT_AGENT_ID } from '@/lib/recursiv';

type ResearchDesk = {
  agentId: string;
  promptVersion: string;
};

type ResearchContextValue = {
  desk: ResearchDesk | null;
  isPreparing: boolean;
  ensureResearchDesk: () => Promise<ResearchDesk>;
};

const ResearchContext = createContext<ResearchContextValue | null>(null);
const STORAGE_KEY = '@inverted_world_research_desk';
const PROMPT_VERSION = '1';

export function ResearchProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { orgId, sdk } = useRecursiv();
  const [desk, setDesk] = useState<ResearchDesk | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const ensureResearchDesk = useCallback(async () => {
    if (!isAuthenticated || !user) throw new Error('Sign in to open a research desk.');
    if (desk?.agentId && desk.promptVersion === PROMPT_VERSION) return desk;

    setIsPreparing(true);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ResearchDesk;
        if (parsed.agentId && parsed.promptVersion === PROMPT_VERSION) {
          setDesk(parsed);
          return parsed;
        }
      }

      await ensureDatabase(sdk);
      const agent = await (sdk.agents as any).create({
        name: 'Inverted World Research Desk',
        username: `inverted_world_research_${Date.now()}`,
        model: 'anthropic/claude-sonnet-4.6',
        system_prompt: researchSystemPrompt(),
        organization_id: orgId,
      });
      const nextDesk = {
        agentId: agent?.data?.id || agent?.id || DEFAULT_AGENT_ID,
        promptVersion: PROMPT_VERSION,
      };

      await dbQuery(
        sdk,
        `INSERT INTO research_desks (user_id, agent_id, prompt_version, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id)
         DO UPDATE SET agent_id = EXCLUDED.agent_id, prompt_version = EXCLUDED.prompt_version, updated_at = now()`,
        [user.id, nextDesk.agentId, PROMPT_VERSION],
      ).catch(() => {});

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextDesk));
      setDesk(nextDesk);
      return nextDesk;
    } finally {
      setIsPreparing(false);
    }
  }, [desk, isAuthenticated, orgId, sdk, user]);

  const value = useMemo(
    () => ({ desk, isPreparing, ensureResearchDesk }),
    [desk, isPreparing, ensureResearchDesk],
  );

  return <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>;
}

export function useResearchDesk() {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error('useResearchDesk must be used within ResearchProvider');
  return ctx;
}

function researchSystemPrompt() {
  return [
    'You are the Inverted World research desk: a conspiracy, paranormal, and unexplained phenomena analyst.',
    'Your stance is critical thinking with a willingness to believe only where the record earns it.',
    'You prefer primary documents, government records, court filings, declassified archives, datasets, original media, and reputable counterarguments.',
    'You must separate confirmed facts, plausible leads, disputed claims, missing records, and speculation.',
    'You proactively ask the user sharp follow-up questions and suggest source pulls, article angles, and media packets.',
    'Never flatten mysteries into debunks. Never upgrade vibes into proof.',
  ].join('\n');
}
