const { getDatabaseConnection } = require('agriconnect-shared/db');
const { sendEmail } = require('agriconnect-shared/utils/email');

exports.getNotifications = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { target_user_id, title, message, email_to } = req.body;
    if (!target_user_id || !title || !message) {
      return res.status(400).json({ error: 'target_user_id, title, and message are required' });
    }

    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const notification = await Notification.create({
      user_id: target_user_id,
      title,
      message
    });

    // Send email if address provided
    if (email_to) {
      sendEmail({
        to: email_to,
        subject: title,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:24px 28px;">
              <h2 style="color:white;margin:0;">🌾 AgriConnect</h2>
            </div>
            <div style="padding:28px;background:#f9f9f9;">
              <h3 style="color:#1B5E20;">${title}</h3>
              <p style="color:#555;line-height:1.6;">${message}</p>
              <p style="color:#999;font-size:12px;margin-top:24px;">AgriConnect — India's Farm-to-Market Platform</p>
            </div>
          </div>
        `
      });
    } else {
      console.log(`[NOTIFICATION] User ${target_user_id}: ${title} — ${message}`);
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    await notification.update({ is_read: true });
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const count = await Notification.count({
      where: { user_id: req.user.id, is_read: false }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};
