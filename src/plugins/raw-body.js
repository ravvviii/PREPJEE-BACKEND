import fp from 'fastify-plugin';

// Razorpay's webhook signature is an HMAC over the exact raw request bytes —
// re-stringifying the parsed JSON body is NOT safe (key order/whitespace/
// number formatting can differ), so the raw string must be captured before
// parsing. This overrides Fastify's default JSON parser globally (behaves
// identically for every other route — it just also stashes `request.rawBody`).
async function rawBodyPlugin(fastify) {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    request.rawBody = body;

    if (body.length === 0) {
      done(null, undefined);
      return;
    }

    try {
      done(null, JSON.parse(body));
    } catch (error) {
      error.statusCode = 400;
      done(error, undefined);
    }
  });
}

// fastify-plugin, same reasoning as multipart.js/security.js — without it,
// this would register in its own isolated branch and never override the
// default parser for routes registered elsewhere.
export default fp(rawBodyPlugin);
