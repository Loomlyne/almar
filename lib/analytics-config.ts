// Cloudflare Web Analytics (plan 06-04, SITE-07). The token is a public site token, not a secret: it is printed in every page
// that loads the beacon. Null until the owner's step (Cloudflare dashboard, manual JS snippet, never automatic injection, which
// would load the beacon before consent); the controller sets it here then. With null there is no banner, no Cookie settings
// link and no beacon at all.

export const CF_WEB_ANALYTICS_TOKEN: string | null = null;

/** The only hosts the beacon may load on: never preview, the dashboard or localhost. */
export const ANALYTICS_HOSTS: readonly string[] = ["almarprivatejourney.com", "www.almarprivatejourney.com"];
