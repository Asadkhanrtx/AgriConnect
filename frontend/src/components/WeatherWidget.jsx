import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Select, MenuItem, FormControl,
  CircularProgress, Chip, Tooltip
} from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import UmbrellaIcon from '@mui/icons-material/Umbrella';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AirIcon from '@mui/icons-material/Air';

const CITIES = {
  'Amritsar': { lat: 31.634, lon: 74.872 },
  'Ludhiana': { lat: 30.901, lon: 75.857 },
  'Chandigarh': { lat: 30.733, lon: 76.779 },
  'Delhi': { lat: 28.614, lon: 77.209 },
  'Agra': { lat: 27.176, lon: 78.008 },
  'Lucknow': { lat: 26.847, lon: 80.946 },
  'Jaipur': { lat: 26.912, lon: 75.787 },
  'Bhopal': { lat: 23.260, lon: 77.413 },
  'Nagpur': { lat: 21.146, lon: 79.088 },
  'Pune': { lat: 18.520, lon: 73.857 },
  'Mumbai': { lat: 19.076, lon: 72.878 },
  'Nashik': { lat: 19.997, lon: 73.791 },
  'Hyderabad': { lat: 17.385, lon: 78.487 },
  'Bangalore': { lat: 12.972, lon: 77.595 },
  'Mysore': { lat: 12.296, lon: 76.639 },
  'Chennai': { lat: 13.083, lon: 80.271 },
  'Coimbatore': { lat: 11.017, lon: 76.956 },
  'Patna': { lat: 25.594, lon: 85.138 },
  'Kolkata': { lat: 22.573, lon: 88.364 },
  'Bhubaneswar': { lat: 20.296, lon: 85.824 },
};

function getWeatherInfo(code) {
  if (code === 0) return { label: 'Clear Sky', icon: <WbSunnyIcon sx={{ color: '#FDD835', fontSize: 32 }} />, alert: null };
  if (code <= 3) return { label: 'Partly Cloudy', icon: <CloudIcon sx={{ color: '#90A4AE', fontSize: 32 }} />, alert: null };
  if (code <= 48) return { label: 'Foggy', icon: <CloudIcon sx={{ color: '#B0BEC5', fontSize: 32 }} />, alert: '⚠️ Low visibility — delay harvest if possible' };
  if (code <= 57) return { label: 'Drizzle', icon: <WaterDropIcon sx={{ color: '#42A5F5', fontSize: 32 }} />, alert: null };
  if (code <= 67) return { label: 'Rain', icon: <UmbrellaIcon sx={{ color: '#1565C0', fontSize: 32 }} />, alert: '⚠️ Heavy Rain — cover stored produce' };
  if (code <= 77) return { label: 'Snow', icon: <AcUnitIcon sx={{ color: '#81D4FA', fontSize: 32 }} />, alert: '❄️ Frost risk — protect crops' };
  if (code <= 82) return { label: 'Rain Showers', icon: <UmbrellaIcon sx={{ color: '#1976D2', fontSize: 32 }} />, alert: '⚠️ Showers expected' };
  if (code <= 99) return { label: 'Thunderstorm', icon: <ThunderstormIcon sx={{ color: '#7B1FA2', fontSize: 32 }} />, alert: '🚨 Thunderstorm — stay indoors, protect equipment' };
  return { label: 'Unknown', icon: <WbSunnyIcon sx={{ fontSize: 32 }} />, alert: null };
}

const WeatherWidget = () => {
  const [city, setCity] = useState('Delhi');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = async (cityName) => {
    const coords = CITIES[cityName];
    if (!coords) return;
    setLoading(true);
    setError('');
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=relativehumidity_2m,precipitation_probability&timezone=Asia%2FKolkata&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      const humidity = data.hourly?.relativehumidity_2m?.[new Date().getHours()] ?? '--';
      const rainChance = data.hourly?.precipitation_probability?.[new Date().getHours()] ?? '--';
      setWeather({ ...data.current_weather, humidity, rainChance });
    } catch {
      setError('Weather unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWeather(city); }, [city]);

  const info = weather ? getWeatherInfo(weather.weathercode) : null;

  return (
    <Box sx={{
      p: 2.5, borderRadius: 3,
      background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
      color: 'white', minWidth: 260,
    }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Weather
        </Typography>
        <FormControl size="small" variant="standard" sx={{ minWidth: 110 }}>
          <Select
            value={city} onChange={e => setCity(e.target.value)}
            disableUnderline
            sx={{ color: 'white', fontSize: 12, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' } }}
          >
            {Object.keys(CITIES).map(c => (
              <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.7)' }} />
        </Box>
      ) : error ? (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>{error}</Typography>
      ) : weather && info ? (
        <>
          <Box display="flex" alignItems="center" gap={2} mb={1.5}>
            {info.icon}
            <Box>
              <Typography variant="h4" fontWeight="bold" lineHeight={1}>
                {Math.round(weather.temperature)}°C
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{info.label}</Typography>
            </Box>
          </Box>

          <Box display="flex" gap={2} mb={info.alert ? 1.5 : 0}>
            <Tooltip title="Humidity">
              <Box display="flex" alignItems="center" gap={0.5}>
                <WaterDropIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                <Typography variant="caption">{weather.humidity}%</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Rain Chance">
              <Box display="flex" alignItems="center" gap={0.5}>
                <UmbrellaIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                <Typography variant="caption">{weather.rainChance}%</Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Wind Speed">
              <Box display="flex" alignItems="center" gap={0.5}>
                <AirIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                <Typography variant="caption">{weather.windspeed} km/h</Typography>
              </Box>
            </Tooltip>
          </Box>

          {info.alert && (
            <Box sx={{
              mt: 1, p: 1, borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.15)', fontSize: 11
            }}>
              <Typography variant="caption" sx={{ lineHeight: 1.4 }}>{info.alert}</Typography>
            </Box>
          )}
        </>
      ) : null}
    </Box>
  );
};

export default WeatherWidget;
