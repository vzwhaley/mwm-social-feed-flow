// Facebook Page publisher (Meta Graph API). Posting to a Page you admin with a
// long-lived Page token requires no App Review.
//
// Env: FB_PAGE_ID, FB_PAGE_TOKEN
import { readFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function graphFetch(url, options) {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
        throw new Error(`Graph API error: ${JSON.stringify(body.error ?? body)}`);
    }
    return body;
}

/** Photo post with caption. Returns { postId, photoId }. */
export async function postPhoto({ imagePath, caption }) {
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.FB_PAGE_TOKEN;
    if (!pageId || !token) throw new Error('FB_PAGE_ID / FB_PAGE_TOKEN not set');

    const form = new FormData();
    form.append('source', new Blob([readFileSync(imagePath)], { type: 'image/png' }), 'question.png');
    form.append('caption', caption);
    form.append('access_token', token);

    const body = await graphFetch(`${GRAPH}/${pageId}/photos`, { method: 'POST', body: form });
    return { photoId: body.id, postId: body.post_id ?? body.id };
}

/** First comment under the post (the answer link lives here). */
export async function comment({ postId, message }) {
    const token = process.env.FB_PAGE_TOKEN;
    const form = new FormData();
    form.append('message', message);
    form.append('access_token', token);

    const body = await graphFetch(`${GRAPH}/${postId}/comments`, { method: 'POST', body: form });
    return body.id;
}

export async function publish({ imagePath, caption, commentMessage }) {
    const { postId } = await postPhoto({ imagePath, caption });
    const commentId = await comment({ postId, message: commentMessage });
    return { network: 'facebook', postId, commentId };
}
