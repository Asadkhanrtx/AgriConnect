const { getDatabaseConnection } = require('agriconnect-shared/db');

exports.getNotifications = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { target_user_id, title, message } = req.body;
    const sequelize = await getDatabaseConnection();
    const { Notification } = sequelize.models;

    const notification = await Notification.create({
      user_id: target_user_id,
      title,
      message
    });

    // Email simulation
    console.log(`[SIMULATED EMAIL] To User ID \${target_user_id} - \${title}: \${message}`);

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
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};
