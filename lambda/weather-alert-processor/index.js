/**
 * weather-alert-processor Lambda
 *
 * Triggered by EventBridge every 15 minutes.
 * Checks Open-Meteo weather for high-rainfall farmer locations.
 * Publishes SNS alert if rain probability > 70% or storm/flood codes detected.
 *
 * Environment variables required:
 *   SNS_TOPIC_ARN  — AgriConnect-WeatherAlerts topic ARN
 *   AWS_REGION     — e.g. ap-south-1 (injected automatically by Lambda runtime)
 */

const https = require('https');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// All seeded farmer locations — update if you add more locations
const FARMER_LOCATIONS = [
  { city: 'Mawsynram',   state: 'Meghalaya',       lat: 25.2967, lon: 91.5833, farmerCount: 2 },
  { city: 'Cherrapunji', state: 'Meghalaya',       lat: 25.2844, lon: 91.7267, farmerCount: 2 },
  { city: 'Shillong',    state: 'Meghalaya',       lat: 25.5788, lon: 91.8933, farmerCount: 2 },
  { city: 'Agumbe',      state: 'Karnataka',       lat: 13.5025, lon: 75.0929, farmerCount: 2 },
  { city: 'Kochi',       state: 'Kerala',          lat:  9.9312, lon: 76.2673, farmerCount: 2 },
  { city: 'Mangalore',   state: 'Karnataka',       lat: 12.9141, lon: 74.8560, farmerCount: 1 },
  { city: 'Gangtok',     state: 'Sikkim',          lat: 27.3389, lon: 88.6065, farmerCount: 1 },
  { city: 'Nashik',      state: 'Maharashtra',     lat: 19.9975, lon: 73.7898, farmerCount: 1 },
  { city: 'Amritsar',    state: 'Punjab',          lat: 31.6340, lon: 74.8723, farmerCount: 1 },
  { city: 'Pune',        state: 'Maharashtra',     lat: 18.5204, lon: 73.8567, farmerCount: 1 },
];

// WMO weather code alert mapping
const ALERT_CONDITIONS = {
  isRain: code => (code >= 51 && code <= 67) || (code >= 80 && code <= 82),
  isStorm: code => code >= 95 && code <= 99,
  isFog:   code => code >= 45 && code <= 48,
};

function getAlertType(code, rainProb) {
  if (ALERT_CONDITIONS.isStorm(code)) return { type: 'STORM', severity: 'HIGH',   emoji: '🚨', msg: 'Thunderstorm detected' };
  if (rainProb >= 80)                 return { type: 'HEAVY_RAIN', severity: 'HIGH',   emoji: '🌧️', msg: `Heavy rain likely (${rainProb}% probability)` };
  if (ALERT_CONDITIONS.isRain(code) && rainProb >= 70)
                                      return { type: 'RAIN', severity: 'MEDIUM', emoji: '⛈️', msg: `Rain expected (${rainProb}% probability)` };
  if (ALERT_CONDITIONS.isFog(code))   return { type: 'FOG',  severity: 'LOW',    emoji: '🌫️', msg: 'Foggy conditions — low visibility' };
  return null;
}

function fetchWeather(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&hourly=precipitation_probability&timezone=Asia%2FKolkata&forecast_days=1`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const hour = new Date().getHours();
          resolve({
            code: json.current_weather?.weathercode ?? -1,
            temp: json.current_weather?.temperature ?? 0,
            wind: json.current_weather?.windspeed ?? 0,
            rainProb: json.hourly?.precipitation_probability?.[hour] ?? 0,
          });
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  console.log('[WeatherAlert] Lambda triggered:', JSON.stringify(event));

  const snsTopicArn = process.env.SNS_TOPIC_ARN;
  if (!snsTopicArn) {
    console.error('[WeatherAlert] SNS_TOPIC_ARN not set — exiting');
    return { statusCode: 500, body: 'SNS_TOPIC_ARN not configured' };
  }

  const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  const alerts = [];

  for (const loc of FARMER_LOCATIONS) {
    try {
      const weather = await fetchWeather(loc.lat, loc.lon);
      const alert = getAlertType(weather.code, weather.rainProb);

      console.log(`[WeatherAlert] ${loc.city}: code=${weather.code}, rain=${weather.rainProb}%, temp=${weather.temp}°C → ${alert ? alert.type : 'no alert'}`);

      if (!alert) continue;

      const message = {
        type: 'WEATHER_ALERT',
        alertType: alert.type,
        severity: alert.severity,
        location: { city: loc.city, state: loc.state, lat: loc.lat, lon: loc.lon },
        farmerCount: loc.farmerCount,
        weather: { code: weather.code, temperature: weather.temp, windspeed: weather.wind, rainProbability: weather.rainProb },
        message: alert.msg,
        advice: getAdvice(alert.type),
        timestamp: new Date().toISOString(),
      };

      const emailBody = `
${alert.emoji} WEATHER ALERT — ${loc.city}, ${loc.state}

Alert Type : ${alert.type} (${alert.severity} severity)
Condition  : ${alert.msg}
Temperature: ${weather.temp}°C
Wind Speed : ${weather.wind} km/h
Rain Chance: ${weather.rainProb}%

Farming Advice:
${getAdvice(alert.type)}

${loc.farmerCount} AgriConnect farmer(s) in this area have been notified.

— AgriConnect Weather Monitoring System
      `.trim();

      const result = await sns.send(new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: `${alert.emoji} Weather Alert: ${alert.type} in ${loc.city}, ${loc.state}`,
        Message: emailBody,
        MessageStructure: undefined, // plain text for email subscribers
        MessageAttributes: {
          alertType:   { DataType: 'String', StringValue: alert.type },
          severity:    { DataType: 'String', StringValue: alert.severity },
          city:        { DataType: 'String', StringValue: loc.city },
        }
      }));

      alerts.push({ location: loc.city, alert: alert.type, messageId: result.MessageId });
      console.log(`[WeatherAlert] SNS published for ${loc.city}: ${result.MessageId}`);

    } catch (err) {
      console.error(`[WeatherAlert] Error for ${loc.city}:`, err.message);
    }
  }

  console.log(`[WeatherAlert] Done. ${alerts.length} alert(s) published.`);
  return { statusCode: 200, body: JSON.stringify({ alertsPublished: alerts.length, alerts }) };
};

function getAdvice(alertType) {
  const advice = {
    HEAVY_RAIN: '• Cover all stored produce immediately\n• Postpone harvest if possible\n• Check drainage channels\n• Secure loose equipment',
    RAIN:       '• Cover stored produce\n• Monitor field drainage\n• Delay pesticide application',
    STORM:      '• Stay indoors — do NOT operate machinery\n• Secure all equipment\n• Check for crop damage after storm passes\n• Contact local agriculture helpline if needed',
    FOG:        '• Delay harvest until visibility improves\n• Check for fungal disease conditions\n• Postpone spraying operations',
  };
  return advice[alertType] || '• Monitor weather conditions closely';
}
