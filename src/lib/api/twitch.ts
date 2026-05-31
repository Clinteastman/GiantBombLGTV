// Public Twitch GQL endpoint. Same client-id and inline-query approach as the
// Android app (see TwitchExtractor.kt and the "Twitch GQL — prefer inline
// queries" rule). Persisted query hashes rotate; inline queries don't.

const GQL_URL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const LOGIN_REGEX = /^[a-zA-Z0-9_]{4,25}$/;

// PlaybackAccessToken is the one query we can't run inline: Twitch only mints
// the signed token in response to this persisted operation. The hash here has
// been stable for years but does occasionally rotate; if live playback starts
// returning null with no other changes, this is the first place to look.
const PLAYBACK_ACCESS_TOKEN_HASH =
  'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9';

export interface LiveStatus {
  isLive: boolean;
  title: string | null;
  previewImageUrl: string | null;
}

export interface TwitchStream {
  hlsUrl: string;
  title: string;
}

/** POST a GQL body to the public Twitch endpoint with the shared client-id. */
function gqlFetch(body: unknown): Promise<Response> {
  return fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
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
    const res = await gqlFetch({
      query: `query { user(login: "${channel}") { stream { id title type } } }`,
    });
    if (res.status !== 200) return null;
    const json = await res.json();
    return parseLiveStatusResponse(channel, json, Date.now());
  } catch {
    return null;
  }
}

/**
 * Extract a playable HLS URL for a live Twitch channel. Returns null if the
 * channel isn't live, if Twitch rejects the access-token request, or if any
 * network/parse error fires. Callers should treat null as "not playable" and
 * leave the user in the upcoming list rather than navigating into a dead
 * playback screen.
 */
export async function extractTwitchHls(channel: string): Promise<TwitchStream | null> {
  if (!LOGIN_REGEX.test(channel)) return null;
  try {
    // The token mint and the title lookup are independent, so fire them
    // together — total wait is the slower of the two, not their sum.
    const [tokenRes, streamTitle] = await Promise.all([
      gqlFetch({
        operationName: 'PlaybackAccessToken',
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: PLAYBACK_ACCESS_TOKEN_HASH,
          },
        },
        variables: {
          login: channel,
          isLive: true,
          isVod: false,
          vodID: '',
          playerType: 'site',
          platform: 'web',
        },
      }),
      getStreamTitle(channel),
    ]);
    if (tokenRes.status !== 200) return null;
    const tokenJson = await tokenRes.json();
    const token = tokenJson?.data?.streamPlaybackAccessToken;
    if (!token?.value || !token?.signature) return null;

    const title = streamTitle ?? 'Giant Bomb Live';

    const params = new URLSearchParams({
      sig: token.signature,
      token: token.value,
      allow_source: 'true',
      allow_audio_only: 'true',
      fast_bread: 'true',
      p: String(Math.floor(Math.random() * 999_999)),
      player_backend: 'mediaplayer',
      playlist_include_framerate: 'true',
      reassignments_supported: 'true',
      supported_codecs: 'avc1',
      cdm: 'wv',
    });
    const hlsUrl = `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?${params.toString()}`;
    return { hlsUrl, title };
  } catch {
    return null;
  }
}

async function getStreamTitle(channel: string): Promise<string | null> {
  try {
    const res = await gqlFetch({
      query: `query { user(login: "${channel}") { stream { title } } }`,
    });
    if (res.status !== 200) return null;
    const json = await res.json();
    const t = json?.data?.user?.stream?.title;
    return typeof t === 'string' && t.trim() ? t : null;
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
