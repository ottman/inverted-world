export const INVERTED_WORLD_RELEASE = {
  name: "inverted-world",
  release: "worldwire-persistence-v2",
  features: {
    recursivHosted: true,
    worldwireJsonbPayloads: "dollar-quoted-sql-literals",
    publicDataFallback: "recursiv-snapshot",
    dnsCutoverRequiresCustomDomainProof: true,
  },
} as const

