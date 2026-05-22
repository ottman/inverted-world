export const YOUTUBE_API_KEY_ENV_NAMES = ["YOUTUBE_API_KEY", "YOUTUBE_DATA_API_KEY", "GOOGLE_YOUTUBE_API_KEY", "GOOGLE_API_KEY"]

export function getYouTubeApiKey() {
  return YOUTUBE_API_KEY_ENV_NAMES.map((name) => process.env[name]).find(Boolean)
}
