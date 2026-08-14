// Instagram publisher (Graph API content publishing) - STUB.
//
// IG requires the image at a PUBLIC URL (two-step: create media container
// with image_url, then publish). Wiring options, in preference order:
//   1. Upload the rendered PNG to coderstudyflow.com via a small signed
//      endpoint and pass that URL here.
//   2. Serve the PNG from a public object store (R2/S3).
// Enable in brands/<brand>/config.json only after IMAGE hosting exists and
// IG_USER_ID / IG_ACCESS_TOKEN secrets are set (IG Business account linked
// to the Facebook Page, same Meta app).
export async function publish() {
    throw new Error('Instagram publisher not wired yet: needs public image hosting (see file header).');
}
