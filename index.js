// index.js — forward raw form submissions to a Discord webhook (for local testing only)
// WARNING: This forwards raw fields. Only use with data you own or where users explicitly consent.
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // remove if running Node 18+ and using global fetch
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
if (!DISCORD_WEBHOOK) {
  console.error('ERROR: Set DISCORD_WEBHOOK in .env');
  process.exit(1);
}

// Allow requests from your local page(s)
app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://reviewthisalways.netlify.app/"
  ],
  credentials: true
}));

// Accept JSON and URL-encoded form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function buildRawPayload(body) {
  // Convert each incoming key -> embed field. Limit values to 1024 chars (Discord limit per field).
  const entries = Object.entries(body || {});
  const fields = entries.map(([k, v]) => ({
    name: String(k).slice(0, 256) || 'field',
    value: String(v === undefined || v === null ? '' : v).slice(0, 1024) || '—',
    inline: false
  }));

  // Discord embed max fields = 25. If more, send compact JSON as content instead.
  if (fields.length > 25) {
    return {
      content: 'Raw submission (too many fields for embed):\n```json\n' +
               JSON.stringify(body, null, 2).slice(0, 1900) +
               '\n```'
    };
  }

  return {
    content: 'Raw form submission (forwarded without masking).',
    embeds: [
      {
        title: 'Raw Submission',
        fields,
        color: 5814783
      }
    ]
  };
}

app.post('/send-webhook', async (req, res) => {
  try {
    // Build raw payload directly from req.body (no sanitization)
    const payload = buildRawPayload(req.body);

    const r = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('Discord returned', r.status, text);
      // Return an error status to the client but no body to avoid popup/alert on client side
      return res.sendStatus(502);
    }

    // No Content response: prevents front-end from receiving a visible JSON body "popup"
    return res.sendStatus(204);
  } catch (err) {
    console.error('Proxy error', err);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Webhook proxy running on http://localhost:${PORT}`);
});
