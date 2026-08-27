// Vercel serverless proxy for Google Gemini (free tier).
// The API key lives ONLY in the GEMINI_KEY env var (Vercel dashboard) —
// it is never committed to the repo or shipped to the browser.
//
// Client POSTs: { body: <Gemini generateContent request> }
// We try the model chain in order, retrying on 429/503 (free-tier
// demand spikes), and pass the first successful response through.

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_KEY env var is not configured' });
  }

  const payload = req.body || {};
  const body = payload.body;
  if (!body || !Array.isArray(body.contents)) {
    return res.status(400).json({ error: 'Invalid request: missing body.contents' });
  }

  let lastStatus = 502;
  let lastMsg = 'All models failed';

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(2500);
      let upstream;
      try {
        upstream = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' +
            model + ':generateContent?key=' + key,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        );
      } catch (netErr) {
        lastStatus = 502;
        lastMsg = 'Network error: ' + (netErr.message || netErr);
        continue;
      }

      const text = await upstream.text();

      if (upstream.status === 429 || upstream.status === 503) {
        lastStatus = upstream.status;
        lastMsg = 'busy';
        continue; // retry same model, then fall through to next
      }
      if (upstream.status === 400 || upstream.status === 403) {
        // Bad request / key issue — surface immediately with detail
        return res.status(upstream.status).send(text);
      }
      if (!upstream.ok) {
        lastStatus = upstream.status;
        lastMsg = text.slice(0, 300);
        continue;
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }
  }

  const status = lastStatus === 429 || lastStatus === 503 ? 429 : 502;
  return res.status(status).json({
    error: lastMsg === 'busy'
      ? 'The AI service is busy right now (high demand). Please try again in a minute.'
      : lastMsg
  });
};
