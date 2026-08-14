// X (Twitter) publisher. Media upload is v1.1 (OAuth 1.0a); the tweet itself
// is v2 /tweets, also authorized with the same OAuth 1.0a user context. The
// free API tier (500 posts/month) covers 4/day comfortably.
//
// Env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const pct = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Build an OAuth 1.0a HMAC-SHA1 Authorization header. */
function oauthHeader({ method, url, extraParams = {} }) {
    const key = process.env.X_API_KEY;
    const secret = process.env.X_API_SECRET;
    const token = process.env.X_ACCESS_TOKEN;
    const tokenSecret = process.env.X_ACCESS_SECRET;
    if (!key || !secret || !token || !tokenSecret) throw new Error('X_* secrets not set');

    const oauth = {
        oauth_consumer_key: key,
        oauth_nonce: randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: token,
        oauth_version: '1.0',
    };

    const all = { ...oauth, ...extraParams };
    const paramString = Object.keys(all).sort()
        .map((k) => `${pct(k)}=${pct(all[k])}`).join('&');
    const base = [method.toUpperCase(), pct(url), pct(paramString)].join('&');
    const signingKey = `${pct(secret)}&${pct(tokenSecret)}`;
    oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');

    return 'OAuth ' + Object.keys(oauth).sort()
        .map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ');
}

async function uploadMedia(imagePath) {
    const url = 'https://upload.twitter.com/1.1/media/upload.json';
    // media_data goes in the multipart body, NOT the signature base string.
    const form = new FormData();
    form.append('media_data', readFileSync(imagePath).toString('base64'));

    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: oauthHeader({ method: 'POST', url }) },
        body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`X media upload failed: ${JSON.stringify(body)}`);
    return body.media_id_string;
}

export async function publish({ imagePath, caption }) {
    const mediaId = await uploadMedia(imagePath);

    const url = 'https://api.twitter.com/2/tweets';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: oauthHeader({ method: 'POST', url }),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: caption, media: { media_ids: [mediaId] } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`X tweet failed: ${JSON.stringify(body)}`);
    return { network: 'x', postId: body.data?.id };
}
