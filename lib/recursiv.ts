import { Recursiv } from '@recursiv/sdk';

export const BASE_URL =
  process.env.EXPO_PUBLIC_RECURSIV_BASE_URL || 'https://api.recursiv.io/api/v1';
export const BASE_ORIGIN = BASE_URL.replace(/\/api\/v1$/, '');

export const ORG_ID =
  process.env.EXPO_PUBLIC_RECURSIV_ORG_ID || '019e3d06-e4d6-7183-9ec4-0396410b1825';

export const PROJECT_ID =
  process.env.EXPO_PUBLIC_RECURSIV_PROJECT_ID || '019e3d06-e90c-729e-a3b8-22b7990c6e9c';

export const DEFAULT_AGENT_ID =
  process.env.EXPO_PUBLIC_RECURSIV_AGENT_ID || 'e260c5ff-b21e-4af2-a488-40da4c4fc61d';

export const DATABASE_NAME =
  process.env.EXPO_PUBLIC_INVERTED_WORLD_DATABASE || 'inverted_world_research';

export const anonSdk = new Recursiv({
  baseUrl: BASE_URL,
  anonymous: true,
});

export function createAuthedSdk(apiKey: string): Recursiv {
  return new Recursiv({
    apiKey,
    baseUrl: BASE_URL,
    timeout: 300_000,
  });
}
