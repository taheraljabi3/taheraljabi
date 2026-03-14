import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'chat-store.json');

// ضع هذا إذا أردت لاحقًا التحقق من توقيع Bird webhook
const BIRD_WEBHOOK_SIGNING_KEY = process.env.BIRD_WEBHOOK_SIGNING_KEY || '';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_FILE);
  } catch {
    const initial = {
      customers: [],
      histories: {},
      sessions: [],
      webhookEvents: []
    };
    await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sanitizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeCustomer(payload = {}) {
  return {
    id: sanitizeText(payload.id),
    email: sanitizeText(payload.email),
    displayName: sanitizeText(payload.displayName),
    locale: sanitizeText(payload.locale || 'ar'),
    companyName: sanitizeText(payload.companyName || 'Smart Life'),
    mode: sanitizeText(payload.mode || 'live'),
    createdAt: payload.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function normalizeEntry(payload = {}) {
  return {
    id: sanitizeText(payload.id) || createId('entry'),
    type: sanitizeText(payload.type || 'event'),
    source: sanitizeText(payload.source || 'system'),
    text: sanitizeText(payload.text),
    payload: payload.payload ?? null,
    createdAt: payload.createdAt || nowIso()
  };
}

function getHistory(store, customerId) {
  if (!store.histories[customerId]) {
    store.histories[customerId] = [];
  }
  return store.histories[customerId];
}

function upsertCustomer(store, customerPayload) {
  const customer = normalizeCustomer(customerPayload);
  if (!customer.id) {
    throw new Error('customer.id is required');
  }

  const index = store.customers.findIndex(c => c.id === customer.id);

  if (index >= 0) {
    store.customers[index] = {
      ...store.customers[index],
      ...customer,
      createdAt: store.customers[index].createdAt || customer.createdAt,
      updatedAt: nowIso()
    };
    return store.customers[index];
  }

  store.customers.push(customer);
  return customer;
}

function appendHistory(store, customerId, entryPayload) {
  if (!customerId) {
    throw new Error('customerId is required');
  }

  const entry = normalizeEntry(entryPayload);
  const history = getHistory(store, customerId);

  const exists = history.some(item => item.id === entry.id);
  if (!exists) {
    history.push(entry);
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return entry;
}

function findCustomerByIdentifiers(store, identifiers = []) {
  const normalized = identifiers
    .map(x => sanitizeText(x).toLowerCase())
    .filter(Boolean);

  if (!normalized.length) return null;

  return store.customers.find(c => {
    const candidates = [
      sanitizeText(c.id).toLowerCase(),
      sanitizeText(c.email).toLowerCase(),
      sanitizeText(c.displayName).toLowerCase()
    ];
    return normalized.some(id => candidates.includes(id));
  }) || null;
}

function collectPossibleIdentifiersFromWebhook(body = {}) {
  const identifiers = new Set();

  const tryAdd = (value) => {
    const v = sanitizeText(value);
    if (v) identifiers.add(v);
  };

  tryAdd(body.customerId);
  tryAdd(body.contactId);
  tryAdd(body.email);
  tryAdd(body.externalUserId);

  tryAdd(body?.data?.customerId);
  tryAdd(body?.data?.contactId);
  tryAdd(body?.data?.email);
  tryAdd(body?.data?.externalUserId);

  tryAdd(body?.contact?.id);
  tryAdd(body?.contact?.email);
  tryAdd(body?.contact?.externalUserId);

  tryAdd(body?.payload?.customerId);
  tryAdd(body?.payload?.contactId);
  tryAdd(body?.payload?.email);
  tryAdd(body?.payload?.externalUserId);

  const nestedIdentifiers = [
    ...(body?.identity?.identifiers || []),
    ...(body?.data?.identity?.identifiers || []),
    ...(body?.payload?.identity?.identifiers || [])
  ];

  for (const item of nestedIdentifiers) {
    tryAdd(item?.value);
  }

  return Array.from(identifiers);
}

function extractWebhookMessageText(body = {}) {
  const candidates = [
    body?.message?.text,
    body?.message?.body,
    body?.message?.content?.text,
    body?.data?.message?.text,
    body?.data?.message?.body,
    body?.data?.message?.content?.text,
    body?.payload?.message?.text,
    body?.payload?.message?.body,
    body?.payload?.message?.content?.text
  ];

  for (const candidate of candidates) {
    const text = sanitizeText(candidate);
    if (text) return text;
  }

  return '';
}

function extractWebhookEventName(body = {}) {
  return sanitizeText(
    body.event ||
    body.type ||
    body.name ||
    body?.data?.event ||
    body?.data?.type ||
    body?.payload?.event ||
    body?.payload?.type ||
    'bird.webhook'
  );
}

function extractWebhookTimestamp(body = {}) {
  return sanitizeText(
    body.timestamp ||
    body.createdAt ||
    body?.data?.timestamp ||
    body?.data?.createdAt ||
    body?.payload?.timestamp ||
    body?.payload?.createdAt ||
    nowIso()
  );
}

/**
 * هذا التحقق اختياري.
 * إذا فعّلت signingKey في Bird webhook أضف BIRD_WEBHOOK_SIGNING_KEY في env
 * ثم فعّل هذا الجزء لاحقًا.
 */
function verifyBirdWebhookSignature(req) {
  if (!BIRD_WEBHOOK_SIGNING_KEY) return true;
  return true;
}

app.get('/health', async (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

app.post('/api/chat/customer/upsert', async (req, res) => {
  try {
    const store = await readStore();
    const customer = upsertCustomer(store, req.body?.customer || {});
    await writeStore(store);
    res.json({ ok: true, customer });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/chat/history/:customerId', async (req, res) => {
  try {
    const store = await readStore();
    const customerId = sanitizeText(req.params.customerId);
    const entries = getHistory(store, customerId);
    res.json({ ok: true, entries });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/chat/history/:customerId', async (req, res) => {
  try {
    const store = await readStore();
    const customerId = sanitizeText(req.params.customerId);

    if (!store.customers.find(c => c.id === customerId)) {
      upsertCustomer(store, {
        id: customerId,
        email: req.body?.entry?.payload?.identifier || '',
        displayName: customerId
      });
    }

    const entry = appendHistory(store, customerId, req.body?.entry || {});
    await writeStore(store);
    res.json({ ok: true, entry });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post('/api/chat/session/start', async (req, res) => {
  try {
    const store = await readStore();

    const session = {
      id: createId('session'),
      customerId: sanitizeText(req.body?.customerId),
      email: sanitizeText(req.body?.email),
      displayName: sanitizeText(req.body?.displayName),
      pageUrl: sanitizeText(req.body?.pageUrl),
      userAgent: sanitizeText(req.body?.userAgent),
      startedAt: nowIso(),
      endedAt: null
    };

    store.sessions.push(session);

    if (session.customerId) {
      appendHistory(store, session.customerId, {
        type: 'session',
        source: 'backend',
        text: 'Customer session started',
        payload: {
          pageUrl: session.pageUrl,
          userAgent: session.userAgent
        }
      });
    }

    await writeStore(store);
    res.json({ ok: true, session });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/chat/session/end', express.json({ type: ['application/json', 'text/plain'] }), async (req, res) => {
  try {
    const store = await readStore();

    const customerId = sanitizeText(req.body?.customerId);
    const pageUrl = sanitizeText(req.body?.pageUrl);

    for (let i = store.sessions.length - 1; i >= 0; i--) {
      const session = store.sessions[i];
      if (session.customerId === customerId && !session.endedAt) {
        session.endedAt = req.body?.endedAt || nowIso();
        break;
      }
    }

    if (customerId) {
      appendHistory(store, customerId, {
        type: 'session',
        source: 'backend',
        text: 'Customer session ended',
        payload: { pageUrl }
      });
    }

    await writeStore(store);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * هذا هو endpoint الذي تربطه مع Bird webhook.
 * الفكرة:
 * 1) Bird يرسل حدث inbound / outbound / interaction
 * 2) نحن نربط الحدث بالعميل
 * 3) نحفظه داخل history لذلك العميل
 */
app.post('/webhooks/bird', async (req, res) => {
  try {
    if (!verifyBirdWebhookSignature(req)) {
      return res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
    }

    const store = await readStore();
    const body = req.body || {};

    const eventName = extractWebhookEventName(body);
    const createdAt = extractWebhookTimestamp(body);
    const messageText = extractWebhookMessageText(body);
    const identifiers = collectPossibleIdentifiersFromWebhook(body);

    const matchedCustomer = findCustomerByIdentifiers(store, identifiers);

    const webhookEvent = {
      id: createId('wh'),
      eventName,
      identifiers,
      createdAt,
      raw: body
    };

    store.webhookEvents.push(webhookEvent);

    if (matchedCustomer) {
      appendHistory(store, matchedCustomer.id, {
        id: webhookEvent.id,
        type: 'bird-message',
        source: 'bird-webhook',
        text: messageText || `[${eventName}] message received`,
        payload: {
          eventName,
          identifiers,
          raw: body
        },
        createdAt
      });
    }

    await writeStore(store);
    res.status(200).json({
      ok: true,
      matchedCustomerId: matchedCustomer?.id || null
    });
  } catch (error) {
    console.error('Bird webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, async () => {
  await ensureStore();
  console.log(`✅ Smart Life chat server running on http://localhost:${PORT}`);
});
