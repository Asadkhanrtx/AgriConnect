const nodemailer = require('nodemailer');
const { getSecret } = require('./secrets');

async function sendEmail({ to, subject, html, text }) {
  try {
    const emailConfig = await getSecret('agriconnect/dev/email');
    if (!emailConfig?.smtp_user || emailConfig.smtp_user === 'your-email@gmail.com') {
      console.log(`[EMAIL SIMULATED] To: ${to} | Subject: ${subject}`);
      return;
    }

    const port = parseInt(emailConfig.smtp_port) || 587;
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: {
        user: emailConfig.smtp_user,
        pass: emailConfig.smtp_password
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"AgriConnect" <${emailConfig.smtp_user}>`,
      to,
      subject,
      html: html || `<p>${text}</p>`,
      text
    });

    console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
  } catch (err) {
    // Email failure must not break the main request
    console.error(`[EMAIL FAILED] To: ${to} | Error: ${err.message}`);
  }
}

function bidNotificationEmail({ farmerName, buyerName, productName, bidAmount, listingPrice }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:28px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">🌾 AgriConnect</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;">Farm-to-Market Platform</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1B5E20;margin-top:0;">New Bid Received!</h2>
        <p style="color:#555;">Hi <strong>${farmerName}</strong>,</p>
        <p style="color:#555;">You have received a new bid on your listing.</p>
        <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Product:</strong> ${productName}</p>
          <p style="margin:0 0 8px;"><strong>Your Listed Price:</strong> ₹${parseFloat(listingPrice).toFixed(2)}</p>
          <p style="margin:0 0 8px;"><strong>Bid Amount:</strong> <span style="color:#1B5E20;font-size:18px;font-weight:bold;">₹${parseFloat(bidAmount).toFixed(2)}</span></p>
          <p style="margin:0;"><strong>From:</strong> ${buyerName}</p>
        </div>
        <p style="color:#555;">Log in to your dashboard to accept or reject this bid.</p>
        <a href="#" style="display:inline-block;background:linear-gradient(135deg,#2E7D32,#388E3C);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
          View Bid →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">AgriConnect · India's Farm-to-Market Platform</p>
      </div>
    </div>
  `;
}

function orderNotificationEmail({ farmerName, productName, quantity, unit, totalAmount, buyerCompany }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:28px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">🌾 AgriConnect</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;">Farm-to-Market Platform</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1B5E20;margin-top:0;">New Order Received! 🎉</h2>
        <p style="color:#555;">Hi <strong>${farmerName}</strong>,</p>
        <p style="color:#555;">Great news! You have a new order to fulfill.</p>
        <div style="background:#E8F5E9;border-left:4px solid #2E7D32;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Product:</strong> ${productName}</p>
          <p style="margin:0 0 8px;"><strong>Quantity:</strong> ${quantity} ${unit}</p>
          <p style="margin:0 0 8px;"><strong>Total Amount:</strong> <span style="color:#1B5E20;font-size:18px;font-weight:bold;">₹${parseFloat(totalAmount).toLocaleString('en-IN')}</span></p>
          <p style="margin:0;"><strong>Buyer:</strong> ${buyerCompany}</p>
        </div>
        <p style="color:#555;">Please prepare the order for dispatch and update the delivery status in your dashboard.</p>
        <a href="#" style="display:inline-block;background:linear-gradient(135deg,#2E7D32,#388E3C);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
          View Order →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">AgriConnect · India's Farm-to-Market Platform</p>
      </div>
    </div>
  `;
}

module.exports = { sendEmail, bidNotificationEmail, orderNotificationEmail };
