// Public Twitch GQL endpoint. Same client-id and inline-query approach as the
// Android app (see TwitchExtractor.kt and the "Twitch GQL — prefer inline
// queries" rule). Persisted query hashes rotate; inline queries don't.

const GQL_URL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const LOGIN_REGEX = /^[a-zA-Z0-9_]{4,25}$/;

export interface LiveStatus {
  isLive: boolean;
  title: string | null;
  previewImageUrl: string | null;
}

/**
 * Returns the live state of `channel`. Returns `null` if the check itself
 * failed (network/GQL error). Callers should treat `null` as "unknown" and
 * fall back to whatever the upstream feed claims.
 */
export async function getTwitchLiveStatus(channel: string): Promise<LiveStatus | null> {
  if (!LOGIN_REGEX.test(channel)) {
    throw new Error(`Invalid Twitch login: ${channel}`);
  }
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: {
        'Client-ID': CLIENT_ID,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: `query { user(login: "${channel}") { stream { id title type } } }`,
      }),
    });
    if (res.status !== 200) return null;
    const json = await res.json();
    return parseLiveStatusResponse(channel, json, Date.now());
  } catch {
    return null;
  }
}

// Exported for unit testing. Pure transform; no network, no clock.
export function parseLiveStatusResponse(
  channel: string,
  json: any,
  nowMs: number
): LiveStatus | null {
  if (json?.errors) return null;
  const stream = json?.data?.user?.stream;
  if (!stream) {
    return { isLive: false, title: null, previewImageUrl: null };
  }
  const title = typeof stream.title === 'string' && stream.title.trim()
    ? stream.title
    : null;
  const minuteBucket = Math.floor(nowMs / 60_000);
  const previewImageUrl =
    `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-1280x720.jpg?t=${minuteBucket}`;
  return { isLive: true, title, previewImageUrl };
}
