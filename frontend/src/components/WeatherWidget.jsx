import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Select, MenuItem, FormControl, CircularProgress, Tooltip
} from '@mui/material';
import { motion } from 'framer-motion';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import UmbrellaIcon from '@mui/icons-material/Umbrella';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AirIcon from '@mui/icons-material/Air';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const CITIES = {
  'Mawsynram':   { lat: 25.2967, lon: 91.5833 },
  'Cherrapunji': { lat: 25.2844, lon: 91.7267 },
  'Shillong':    { lat: 25.5788, lon: 91.8933 },
  'Agumbe':      { lat: 13.5025, lon: 75.0929 },
  'Kochi':       { lat:  9.9312, lon: 76.2673 },
  'Mangalore':   { lat: 12.9141, lon: 74.8560 },
  'Gangtok':     { lat: 27.3389, lon: 88.6065 },
  'Nashik':      { lat: 19.9975, lon: 73.7898 },
  'Amritsar':    { lat: 31.6340, lon: 74.8723 },
  'Ludhiana':    { lat: 30.9010, lon: 75.8573 },
  'Pune':        { lat: 18.5204, lon: 73.8567 },
  'Hyderabad':   { lat: 17.3850, lon: 78.4867 },
  'Bhopal':      { lat: 23.2599, lon: 77.4126 },
  'Coimbatore':  { lat: 11.0168, lon: 76.9558 },
  'Patna':       { lat: 25.5941, lon: 85.1376 },
  'Delhi':       { lat: 28.6139, lon: 77.2090 },
  'Mumbai':      { lat: 19.0760, lon: 72.8777 },
  'Bangalore':   { lat: 12.9716, lon: 77.5946 },
  'Chennai':     { lat: 13.0827, lon: 80.2707 },
  'Kolkata':     { lat: 22.5726, lon: 88.3639 },
};

function getWeatherInfo(code) {
  if (code === 0) return { label: 'Clear Sky',     icon: <WbSunnyIcon sx={{ color: '#FDD835', fontSize: 36 }} />, alert: null };
  if (code <= 3)  return { label: 'Partly Cloudy', icon: <CloudIcon sx={{ color: '#B0BEC5', fontSize: 36 }} />, alert: null };
  if (code <= 48) return { label: 'Foggy',         icon: <CloudIcon sx={{ color: '#90A4AE', fontSize: 36 }} />, alert: 'Low visibility — delay harvest if possible' };
  if (code <= 57) return { label: 'Drizzle',       icon: <WaterDropIcon sx={{ color: '#64B5F6', fontSize: 36 }} />, alert: null };
  if (code <= 67) return { label: 'Rain',          icon: <UmbrellaIcon sx={{ color: '#90CAF9', fontSize: 36 }} />, alert: 'Heavy Rain — cover stored produce' };
  if (code <= 77) return { label: 'Snow / Sleet',  icon: <AcUnitIcon sx={{ color: '#B3E5FC', fontSize: 36 }} />, alert: 'Frost risk — protect crops' };
  if (code <= 82) return { label: 'Rain Showers',  icon: <UmbrellaIcon sx={{ color: '#81D4FA', fontSize: 36 }} />, alert: 'Showers expected — secure equipment' };
  if (code <= 99) return { label: 'Thunderstorm',  icon: <ThunderstormIcon sx={{ color: '#CE93D8', fontSize: 36 }} />, alert: 'Thunderstorm — stay indoors, protect equipment' };
  return { label: 'Unknown', icon: <WbSunnyIcon sx={{ fontSize: 36 }} />, alert: null };
}

const WeatherWidget = ({ farmerLocation }) => {
  const [city, setCity]       = useState('Mawsynram');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const getCoords = () => {
    if (farmerLocation?.latitude && farmerLocation?.longitude)
      return { lat: farmerLocation.latitude, lon: farmerLocation.longitude };
    return CITIES[city] || CITIES['Mawsynram'];
  };

  const getLabel = () => {
    if (farmerLocation?.city) return `${farmerLocation.city}${farmerLocation.state ? `, ${farmerLocation.state}` : ''}`;
    return city;
  };

  const fetchWeather = async () => {
    const coords = getCoords();
    setLoading(true); setError('');
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=relativehumidity_2m,precipitation_probability&timezone=Asia%2FKolkata&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const h = new Date().getHours();
      const humidity   = data.hourly?.relativehumidity_2m?.[h] ?? '--';
      const rainChance = data.hourly?.precipitation_probability?.[h] ?? '--';
      setWeather({ ...data.current_weather, humidity, rainChance });
    } catch {
      setError('Weather unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWeather(); }, [city, farmerLocation?.latitude]);

  const info = weather ? getWeatherInfo(weather.weathercode) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <Box sx={{
        p: 2.5, borderRadius: '16px', minWidth: 260,
        background: 'linear-gradient(135deg, rgba(10,31,21,0.85) 0%, rgba(18,53,36,0.80) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(163,177,138,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        color: 'white',
      }}>
        {/* Header row */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Box display="flex" alignItems="center" gap={0.75}>
            <LocationOnIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
            <Typography variant="caption" sx={{ color: '#A3B18A', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontSize: '0.65rem' }}>
              Weather
            </Typography>
          </Box>

          {farmerLocation?.latitude ? (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: '0.72rem' }}>
              {getLabel()}
            </Typography>
          ) : (
            <FormControl size="small" variant="standard" sx={{ minWidth: 110 }}>
              <Select
                value={city} onChange={e => setCity(e.target.value)}
                disableUnderline
                sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.55)' } }}
              >
                {Object.keys(CITIES).map(c => (
                  <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={2.5}>
            <CircularProgress size={22} sx={{ color: '#A3B18A' }} />
          </Box>
        ) : error ? (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>{error}</Typography>
        ) : weather && info ? (
          <>
            {/* Temp + icon */}
            <Box display="flex" alignItems="center" gap={2} mb={1.75}>
              {info.icon}
              <Box>
                <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '2rem', lineHeight: 1, color: 'white' }}>
                  {Math.round(weather.temperature)}°C
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                  {info.label}
                </Typography>
              </Box>
            </Box>

            {/* Metrics row */}
            <Box display="flex" gap={2.5} mb={info.alert ? 1.5 : 0}>
              <Tooltip title="Humidity">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <WaterDropIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>{weather.humidity}%</Typography>
                </Box>
              </Tooltip>
              <Tooltip title="Rain Chance">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <UmbrellaIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>{weather.rainChance}%</Typography>
                </Box>
              </Tooltip>
              <Tooltip title="Wind Speed">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <AirIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>{weather.windspeed} km/h</Typography>
                </Box>
              </Tooltip>
            </Box>

            {info.alert && (
              <Box sx={{
                mt: 1.5, px: 1.5, py: 1, borderRadius: '10px',
                background: 'rgba(217,164,65,0.18)',
                border: '1px solid rgba(217,164,65,0.30)',
                display: 'flex', alignItems: 'flex-start', gap: 0.75,
              }}>
                <WarningAmberIcon sx={{ fontSize: 14, color: '#D9A441', flexShrink: 0, mt: '1px' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                  {info.alert}
                </Typography>
              </Box>
            )}
          </>
        ) : null}
      </Box>
    </motion.div>
  );
};

export default WeatherWidget;
