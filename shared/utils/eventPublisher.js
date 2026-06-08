const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

let _sns = null;
function getSNS() {
  if (!_sns) _sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  return _sns;
}

/**
 * Publish an application event to AgriConnect-Events SNS topic.
 * Returns true on success, false if EVENTS_TOPIC_ARN is not configured or publish fails.
 * Never throws — callers should treat false as "fall back to direct write".
 *
 * Event types: NEW_ORDER | NEW_BID | ORDER_STATUS | BID_ACCEPTED | BID_REJECTED |
 *              PAYMENT_RELEASED | WEATHER_ALERT
 */
async function publishEvent(eventData) {
  const topicArn = process.env.EVENTS_TOPIC_ARN;
  if (!topicArn) return false;

  try {
    await getSNS().send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(eventData),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: eventData.type || 'UNKNOWN' }
      }
    }));
    console.log(`[Events] Published ${eventData.type}`);
    return true;
  } catch (err) {
    console.error(`[Events] Failed to publish ${eventData.type}:`, err.message);
    return false;
  }
}

module.exports = { publishEvent };
