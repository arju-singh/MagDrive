import express from 'express';
import Stripe from 'stripe';
import { db } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { requireAuth } from '../auth.js';

// One client, only when configured. All routes 503 when billing is off.
const stripe = config.billingEnabled ? new Stripe(config.stripe.secretKey) : null;

const router = express.Router();

function guard(_req, res, next) {
  if (!stripe) return res.status(503).json({ error: 'billing_unavailable' });
  return next();
}

// Ensure the user has a Stripe customer; return its id.
async function ensureCustomer(userId) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId },
  });
  await db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, userId]);
  return customer.id;
}

// Current plan/subscription snapshot for the signed-in user.
router.get('/subscription', requireAuth, async (req, res) => {
  const u = await db.get('SELECT plan, subscription_status, current_period_end FROM users WHERE id = ?', [req.user.id]);
  res.json({
    enabled: config.billingEnabled,
    plan: u?.plan || 'free',
    status: u?.subscription_status || null,
    currentPeriodEnd: u?.current_period_end || null,
    priceId: config.stripe.priceId || null,
  });
});

// Start a subscription via Stripe-hosted Checkout.
router.post('/checkout', requireAuth, guard, async (req, res, next) => {
  try {
    if (!config.stripe.priceId) return res.status(503).json({ error: 'price_not_configured' });
    const customer = await ensureCustomer(req.user.id);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      success_url: `${config.clientUrl}/billing?checkout=success`,
      cancel_url: `${config.clientUrl}/billing?checkout=cancel`,
      client_reference_id: req.user.id,
    });
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

// Manage subscription (upgrade / downgrade / cancel) via the Stripe Billing Portal.
router.post('/portal', requireAuth, guard, async (req, res, next) => {
  try {
    const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [req.user.id]);
    if (!user?.stripe_customer_id) return res.status(400).json({ error: 'no_customer' });
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${config.clientUrl}/billing`,
    });
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

// Reflect a subscription's state onto the user row.
async function applySubscription(customerId, sub) {
  const user = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', [customerId]);
  if (!user) return;
  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  await db.run(`UPDATE users SET plan = ?, subscription_status = ?, subscription_id = ?, current_period_end = ? WHERE id = ?`,
    [active ? 'pro' : 'free', sub.status, sub.id, (sub.current_period_end || 0) * 1000, user.id]);
  logger.info('subscription updated', { userId: user.id, status: sub.status });
}

/**
 * Stripe webhook. MUST receive the raw body for signature verification, so it is
 * mounted with express.raw() in index.js BEFORE express.json().
 */
export async function handleWebhook(req, res) {
  if (!stripe) return res.status(503).json({ error: 'billing_unavailable' });
  let event = req.body;
  try {
    if (config.stripe.webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
    } else {
      event = JSON.parse(req.body.toString('utf8')); // dev fallback (no signature check)
    }
  } catch (e) {
    logger.warn('stripe webhook signature failed', { msg: e.message });
    return res.status(400).json({ error: 'invalid_signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription);
        await applySubscription(s.customer, sub);
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await applySubscription(sub.customer, sub);
    }
  } catch (e) {
    logger.error('stripe webhook handler error', { type: event?.type, msg: e.message });
  }
  res.json({ received: true });
}

export default router;
