import { Recursiv } from "@recursiv/sdk"
import { requireRecursivRuntimeConfig } from "@/lib/recursiv/config"

type ClientOptions = {
  allowDeveloperApiKey?: boolean
  timeout?: number
}

export function createRecursivServerClient(options: ClientOptions = {}) {
  const config = requireRecursivRuntimeConfig({ allowDeveloperApiKey: options.allowDeveloperApiKey })

  return {
    sdk: new Recursiv({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: options.timeout ?? 30000,
      maxRetries: 2,
    }),
    config,
  }
}
