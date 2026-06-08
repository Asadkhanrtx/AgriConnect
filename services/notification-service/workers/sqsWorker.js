const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { getDatabaseConnection } = require('agriconnect-shared/db');
const { sendEmail } = require('agriconnect-shared/utils/email');

const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL;
const REGION    = process.env.AWS_REGION || 'ap-south-1';

let sqs = null;
function getSQS() {
  if (!sqs) sqs = new SQSClient({ region: REGION });
  return sqs;
}

// ── DB helper ──────────────────────────────────────────────────────────────────
async function createNotification(userId, title, message) {
  const sequelize = await getDatabaseConnection();
  const { Notification } = sequelize.models;
  return Notification.create({ user_id: parseInt(userId, 10), title, message });
}

// ── Email HTML templates ───────────────────────────────────────────────────────
function wrapEmail(title, bodyHtml) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:24px 28px;">
        <h2 style="color:white;margin:0;font-size:20px;">🌾 AgriConnect</h2>
        <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Farm-to-Market Platform</p>
      </div>
      <div style="padding:28px;background:#f9f9f9;">
        <h3 style="color:#1B5E20;margin-top:0;">${title}</h3>
        ${bodyHtml}
        <p style="color:#aaa;font-size:11px;margin-top:24px;">AgriConnect · India's Farm-to-Market Platform</p>
      </div>
    </div>`;
}

function weatherAlertEmail(event) {
  const severityColors = { HIGH: '#C62828', MEDIUM: '#E65100', LOW: '#1565C0' };
  const color = severityColors[event.severity] || '#333';
  return wrapEmail(`${event.emoji || '⚠️'} Weather Alert: ${event.alert_type}`, `
    <div style="background:${color};color:white;border-radius:8px;padding:16px;margin-bottom:20px;">
      <strong style="font-size:17px;">${event.alert_type}</strong>
      <p style="margin:8px 0 0;opacity:0.9;">${event.message}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr><td style="padding:6px 0;color:#555;"><strong>Location</strong></td><td style="color:#333;">${event.city}, ${event.state}</td></tr>
      <tr><td style="padding:6px 0;color:#555;"><strong>Temperature</strong></td><td style="color:#333;">${event.temperature ?? '--'}°C</td></tr>
      <tr><td style="padding:6px 0;color:#555;"><strong>Rain Probability</strong></td><td style="color:#333;">${event.rain_probability ?? '--'}%</td></tr>
      <tr><td style="padding:6px 0;color:#555;"><strong>Wind Speed</strong></td><td style="color:#333;">${event.windspeed ?? '--'} km/h</td></tr>
    </table>
    ${event.advice ? `<div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;">
      <strong style="color:#1B5E20;">Farming Advice:</strong>
      <pre style="margin:8px 0 0;font-family:inherit;white-space:pre-wrap;color:#333;">${event.advice}</pre>
    </div>` : ''}`);
}

// ── Event handlers ─────────────────────────────────────────────────────────────
async function handleNewOrder(ev) {
  if (!ev.farmer_user_id) return;

  await createNotification(
    ev.farmer_user_id,
    'New Order Received! 🎉',
    `${ev.buyer_name} ordered ${ev.quantity} ${ev.unit} of ${ev.product_name} for ₹${parseFloat(ev.total_amount).toLocaleString('en-IN')}.`
  );

  if (ev.farmer_email) {
    sendEmail({
      to: ev.farmer_email,
      subject: `New Order: ${ev.product_name} from ${ev.buyer_name}`,
      html: wrapEmail('New Order Received! 🎉', `
        <p style="color:#555;">Hi <strong>${ev.farmer_name || 'Farmer'}</strong>,</p>
        <p style="color:#555;">You have a new order to fulfil.</p>
        <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Product:</strong> ${ev.product_name}</p>
          <p style="margin:0 0 8px;"><strong>Quantity:</strong> ${ev.quantity} ${ev.unit}</p>
          <p style="margin:0 0 8px;"><strong>Total:</strong> <span style="color:#1B5E20;font-size:18px;font-weight:bold;">₹${parseFloat(ev.total_amount).toLocaleString('en-IN')}</span></p>
          <p style="margin:0;"><strong>Buyer:</strong> ${ev.buyer_name}</p>
        </div>
        <p style="color:#555;">Log in to your dashboard to prepare the order for dispatch.</p>`)
    });
  }
}

async function handleNewBid(ev) {
  if (!ev.farmer_user_id) return;

  await createNotification(
    ev.farmer_user_id,
    'New Bid Received 💰',
    `${ev.buyer_name} placed a bid of ₹${parseFloat(ev.amount).toFixed(2)} on your ${ev.product_name} listing.`
  );

  if (ev.farmer_email) {
    sendEmail({
      to: ev.farmer_email,
      subject: `New Bid on your ${ev.product_name} listing`,
      html: wrapEmail('New Bid Received!', `
        <p style="color:#555;">Hi <strong>${ev.farmer_name || 'Farmer'}</strong>,</p>
        <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Product:</strong> ${ev.product_name}</p>
          <p style="margin:0 0 8px;"><strong>Listed Price:</strong> ₹${parseFloat(ev.listing_price || 0).toFixed(2)}</p>
          <p style="margin:0 0 8px;"><strong>Bid Amount:</strong> <span style="color:#1B5E20;font-size:18px;font-weight:bold;">₹${parseFloat(ev.amount).toFixed(2)}</span></p>
          <p style="margin:0;"><strong>From:</strong> ${ev.buyer_name}</p>
        </div>
        <p style="color:#555;">Log in to accept or reject this bid.</p>`)
    });
  }
}

async function handleOrderStatus(ev) {
  if (!ev.buyer_user_id) return;

  const msgs = {
    IN_TRANSIT: `Your order of ${ev.product_name} is now in transit! 🚚`,
    DELIVERED:  `Your order of ${ev.product_name} has been delivered. Please confirm receipt to release payment. ✅`
  };
  if (!msgs[ev.status]) return;

  await createNotification(
    ev.buyer_user_id,
    ev.status === 'DELIVERED' ? 'Order Delivered ✅' : 'Order Shipped 🚚',
    msgs[ev.status]
  );
}

async function handleBidAction(type, ev) {
  if (!ev.buyer_user_id) return;

  await createNotification(
    ev.buyer_user_id,
    type === 'BID_ACCEPTED' ? 'Bid Accepted! ✅' : 'Bid Declined',
    type === 'BID_ACCEPTED'
      ? `Your bid of ₹${parseFloat(ev.amount).toFixed(2)} on ${ev.product_name} has been accepted.`
      : `Your bid on ${ev.product_name} was not accepted this time.`
  );
}

async function handlePaymentReleased(ev) {
  const amtFmt = parseFloat(ev.amount).toLocaleString('en-IN');

  if (ev.farmer_user_id) {
    await createNotification(
      ev.farmer_user_id,
      'Payment Released! 💰',
      `Payment of ₹${amtFmt} for ${ev.product_name} (Order #${ev.order_id}) has been released.`
    );
    if (ev.farmer_email) {
      sendEmail({
        to: ev.farmer_email,
        subject: `Payment Released — ₹${amtFmt} for Order #${ev.order_id}`,
        html: wrapEmail('Payment Released! 💰', `
          <p style="color:#555;">Hi <strong>${ev.farmer_name || 'Farmer'}</strong>,</p>
          <p style="color:#555;">Great news — the buyer has confirmed delivery.</p>
          <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;"><strong>Order #${ev.order_id}</strong></p>
            <p style="margin:0 0 8px;"><strong>Product:</strong> ${ev.product_name}</p>
            <p style="margin:0;"><strong>Amount Released:</strong> <span style="color:#1B5E20;font-size:20px;font-weight:800;">₹${amtFmt}</span></p>
          </div>`)
      });
    }
  }

  if (ev.buyer_user_id) {
    await createNotification(
      ev.buyer_user_id,
      'Delivery Confirmed ✅',
      `You confirmed delivery of ${ev.product_name} (Order #${ev.order_id}). ₹${amtFmt} released to the farmer.`
    );
  }
}

async function handleWeatherAlert(ev) {
  const sequelize = await getDatabaseConnection();
  const { Farmer, User } = sequelize.models;
  const { Op } = sequelize.constructor;

  // Find all farmers with a pinned location in the affected city
  const farmers = await Farmer.findAll({
    where: { city: ev.city, latitude: { [Op.not]: null } },
    include: [{ model: User, attributes: ['id', 'email', 'first_name'] }]
  });

  if (farmers.length === 0) {
    console.log(`[SQS Worker] WEATHER_ALERT: no farmers found for city "${ev.city}"`);
    return;
  }

  console.log(`[SQS Worker] WEATHER_ALERT: notifying ${farmers.length} farmer(s) in ${ev.city}`);

  for (const farmer of farmers) {
    if (!farmer.User) continue;

    await createNotification(
      farmer.user_id,
      `${ev.emoji || '⚠️'} Weather Alert: ${ev.alert_type} in ${ev.city}`,
      `${ev.message}. ${ev.advice ? ev.advice.split('\n')[0] : 'Check your dashboard for details.'}`
    ).catch(err => console.error('[SQS Worker] Notification create failed:', err.message));

    if (farmer.User.email) {
      sendEmail({ to: farmer.User.email, subject: `Weather Alert for ${ev.city}: ${ev.alert_type}`, html: weatherAlertEmail(ev) });
    }
  }
}

// ── Message processor ──────────────────────────────────────────────────────────
async function processEvent(event) {
  const { type } = event;
  console.log(`[SQS Worker] Processing event: ${type}`);

  switch (type) {
    case 'NEW_ORDER':        return handleNewOrder(event);
    case 'NEW_BID':          return handleNewBid(event);
    case 'ORDER_STATUS':     return handleOrderStatus(event);
    case 'BID_ACCEPTED':     return handleBidAction('BID_ACCEPTED', event);
    case 'BID_REJECTED':     return handleBidAction('BID_REJECTED', event);
    case 'PAYMENT_RELEASED': return handlePaymentReleased(event);
    case 'WEATHER_ALERT':    return handleWeatherAlert(event);
    default:
      console.warn(`[SQS Worker] Unknown event type: ${type}`);
  }
}

async function processMessage(msg) {
  // SQS messages from SNS are wrapped: { Type:"Notification", Message: "JSON string" }
  // Direct SQS messages are plain JSON
  const body = JSON.parse(msg.Body);
  const event = body.Type === 'Notification'
    ? JSON.parse(body.Message)
    : body;
  await processEvent(event);
}

// ── Long-polling loop ──────────────────────────────────────────────────────────
async function poll() {
  try {
    const response = await getSQS().send(new ReceiveMessageCommand({
      QueueUrl:            QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds:     20,   // long-poll — reduces empty receives
      VisibilityTimeout:   30
    }));

    for (const msg of response.Messages || []) {
      try {
        await processMessage(msg);
        await getSQS().send(new DeleteMessageCommand({
          QueueUrl:      QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle
        }));
        console.log(`[SQS Worker] Deleted message ${msg.MessageId}`);
      } catch (err) {
        // Leave in queue — will retry; DLQ handles exhausted retries
        console.error(`[SQS Worker] Processing failed for ${msg.MessageId}:`, err.message);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('[SQS Worker] Poll error:', err.message);
    await new Promise(r => setTimeout(r, 5000)); // back-off on error
  }

  // Immediately poll again (long-polling handles idle waiting server-side)
  setImmediate(poll);
}

function startWorker() {
  if (!QUEUE_URL) {
    console.log('[SQS Worker] NOTIFICATIONS_QUEUE_URL not set — SQS polling disabled (direct DB mode active)');
    return;
  }
  console.log(`[SQS Worker] Starting — polling ${QUEUE_URL}`);
  poll();
}

module.exports = { startWorker };
