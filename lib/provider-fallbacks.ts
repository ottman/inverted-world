export type ProviderFallbackOptions = {
  allowProviderFallbacks?: boolean
}

export function allowProviderFallbacks(options: ProviderFallbackOptions = {}) {
  if (typeof options.allowProviderFallbacks === "boolean") return options.allowProviderFallbacks
  if (process.env.ALLOW_PUBLIC_PROVIDER_FALLBACKS === "1") return true

  return process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_PROVIDER_FALLBACKS !== "0"
}
