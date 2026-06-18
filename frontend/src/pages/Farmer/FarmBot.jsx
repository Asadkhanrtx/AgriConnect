import React, { useState, useRef } from 'react';
import { Box, Typography, IconButton, Chip, Tooltip } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import GrassIcon from '@mui/icons-material/Grass';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ScienceIcon from '@mui/icons-material/Science';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AgricultureOutlinedIcon from '@mui/icons-material/AgricultureOutlined';
import axios from 'axios';
import AIChatBot, { C } from '../../components/AIChatBot';

const FARMBOT_API_URL = import.meta.env.VITE_FARMBOT_API_URL || '';

// ─── FarmBot SVG Illustration ──────────────────────────────────────────────────
function FarmBotIllustration() {
  return (
    <svg viewBox="0 0 400 440" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
      <defs>
        <radialGradient id="fbBg" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor="#C8EDD4" />
          <stop offset="100%" stopColor="#E8F7EE" />
        </radialGradient>
        <linearGradient id="fbRobot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#25A04A" />
          <stop offset="100%" stopColor="#184F2D" />
        </linearGradient>
        <linearGradient id="fbRobotLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EBD58" />
          <stop offset="100%" stopColor="#1B7F3A" />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <ellipse cx="200" cy="220" rx="190" ry="195" fill="url(#fbBg)" />

      {/* Ground */}
      <ellipse cx="200" cy="408" rx="175" ry="34" fill="#A8D8B4" opacity="0.55" />
      <ellipse cx="80"  cy="400" rx="90"  ry="22" fill="#B8E6C4" opacity="0.4"  />
      <ellipse cx="330" cy="402" rx="80"  ry="20" fill="#B8E6C4" opacity="0.35" />

      {/* Sun (top-left) */}
      <circle cx="58" cy="72" r="38" fill="#FFF8D6" opacity="0.85" />
      <circle cx="58" cy="72" r="26" fill="#FFE57A" opacity="0.6"  />

      {/* ── Wheat stalks (left) ── */}
      <line x1="60" y1="380" x2="60" y2="310" stroke="#184F2D" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="51"  cy="305" rx="9"  ry="20" fill="#1B7F3A" opacity="0.85" transform="rotate(-14 51 305)"  />
      <ellipse cx="69"  cy="299" rx="8"  ry="18" fill="#25A04A" opacity="0.75" transform="rotate(16 69 299)"   />
      <ellipse cx="60"  cy="292" rx="7"  ry="16" fill="#1B7F3A" opacity="0.9"                                  />

      <line x1="92" y1="375" x2="92" y2="318" stroke="#184F2D" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="83"  cy="313" rx="8"  ry="17" fill="#25A04A" opacity="0.8"  transform="rotate(-12 83 313)"  />
      <ellipse cx="101" cy="308" rx="7"  ry="15" fill="#1B7F3A" opacity="0.7"  transform="rotate(14 101 308)"  />
      <ellipse cx="92"  cy="302" rx="7"  ry="14" fill="#25A04A" opacity="0.88"                                 />

      {/* ── Tomato plant (right) ── */}
      <line x1="338" y1="378" x2="338" y2="318" stroke="#184F2D" strokeWidth="3" strokeLinecap="round" />
      <line x1="338" y1="348" x2="315" y2="332" stroke="#184F2D" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="338" y1="336" x2="360" y2="322" stroke="#184F2D" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tomatoes */}
      <circle cx="310" cy="325" r="13" fill="#E53935" opacity="0.85" />
      <path d="M 304 317 Q 310 312 316 317" stroke="#25A04A" strokeWidth="2" fill="none" />
      <circle cx="362" cy="315" r="12" fill="#E53935" opacity="0.8"  />
      <path d="M 356 307 Q 362 302 368 307" stroke="#25A04A" strokeWidth="2" fill="none" />
      <circle cx="338" cy="310" r="11" fill="#E53935" opacity="0.9"  />
      <path d="M 332 302 Q 338 297 344 302" stroke="#25A04A" strokeWidth="2" fill="none" />

      {/* ── Robot head ── */}
      <rect x="148" y="102" width="104" height="90" rx="24" fill="url(#fbRobot)" />
      {/* Glare */}
      <rect x="155" y="109" width="44" height="32" rx="14" fill="rgba(255,255,255,0.11)" />
      {/* Eyes */}
      <circle cx="176" cy="148" r="17" fill="white" />
      <circle cx="224" cy="148" r="17" fill="white" />
      <circle cx="180" cy="153" r="9"  fill="#1B7F3A" />
      <circle cx="228" cy="153" r="9"  fill="#1B7F3A" />
      <circle cx="183" cy="150" r="3.5" fill="white"  />
      <circle cx="231" cy="150" r="3.5" fill="white"  />
      {/* Smile */}
      <path d="M 172 174 Q 200 190 228 174" stroke="rgba(255,255,255,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Antenna */}
      <line x1="200" y1="102" x2="200" y2="74" stroke="#1B7F3A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="200" cy="66" r="12" fill="#25A04A" />
      <circle cx="200" cy="66" r="6"  fill="white" opacity="0.8" />

      {/* Neck */}
      <rect x="188" y="192" width="24" height="18" rx="9" fill="#184F2D" />

      {/* ── Robot body ── */}
      <rect x="143" y="209" width="114" height="92" rx="24" fill="url(#fbRobot)" />
      {/* Chest panel */}
      <rect x="165" y="225" width="70" height="52" rx="15" fill="rgba(255,255,255,0.12)" />
      {/* Status lights */}
      <circle cx="183" cy="245" r="8"  fill="#4ADE80" />
      <circle cx="200" cy="245" r="8"  fill="rgba(255,255,255,0.35)" />
      <circle cx="217" cy="245" r="8"  fill="rgba(255,255,255,0.2)" />
      {/* Progress bar */}
      <rect x="172" y="261" width="56" height="8" rx="4" fill="rgba(255,255,255,0.18)" />
      <rect x="172" y="261" width="38" height="8" rx="4" fill="#4ADE80" />

      {/* ── Arms ── */}
      <rect x="104" y="215" width="36" height="70" rx="18" fill="url(#fbRobot)" />
      <circle cx="122" cy="291" r="17" fill="url(#fbRobot)" />
      <rect x="260" y="215" width="36" height="70" rx="18" fill="url(#fbRobot)" />
      <circle cx="278" cy="291" r="17" fill="url(#fbRobot)" />

      {/* Left hand with wheat */}
      <circle cx="122" cy="300" r="13" fill="#184F2D" />
      <line x1="113" y1="284" x2="105" y2="256" stroke="#184F2D" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="101" cy="249" rx="6" ry="13" fill="#25A04A" opacity="0.9" />
      <ellipse cx="109" cy="244" rx="5" ry="11" fill="#1B7F3A" opacity="0.8" />

      {/* Right hand */}
      <circle cx="278" cy="300" r="13" fill="#184F2D" />

      {/* ── Legs ── */}
      <rect x="160" y="300" width="36" height="60" rx="18" fill="url(#fbRobot)" />
      <rect x="204" y="300" width="36" height="60" rx="18" fill="url(#fbRobot)" />
      {/* Feet */}
      <rect x="153" y="352" width="48" height="18" rx="9" fill="#184F2D" />
      <rect x="199" y="352" width="48" height="18" rx="9" fill="#184F2D" />

      {/* Floating leaves */}
      <ellipse cx="105" cy="170" rx="18" ry="9"  fill="#25A04A" opacity="0.62" transform="rotate(-35 105 170)" />
      <ellipse cx="302" cy="162" rx="15" ry="7.5" fill="#1B7F3A" opacity="0.58" transform="rotate(40 302 162)"  />
      <ellipse cx="92"  cy="250" rx="14" ry="7"  fill="#4ADE80" opacity="0.42" transform="rotate(-20 92 250)"  />
      <ellipse cx="312" cy="238" rx="13" ry="6.5" fill="#25A04A" opacity="0.48" transform="rotate(32 312 238)"  />
      <ellipse cx="142" cy="78"  rx="11" ry="5.5" fill="#1B7F3A" opacity="0.38" transform="rotate(-45 142 78)"  />
      <ellipse cx="266" cy="86"  rx="11" ry="5.5" fill="#25A04A" opacity="0.42" transform="rotate(48 266 86)"   />
    </svg>
  );
}

// ─── FarmBot capability config ────────────────────────────────────────────────
const CAPABILITIES = [
  { icon: <GrassIcon />,               title: 'Crop Disease Detection',       desc: 'Upload a plant photo for instant AI-powered diagnosis and treatment plan.' },
  { icon: <WbSunnyIcon />,             title: 'Weather Intelligence',         desc: 'Get weather-based farming advice — irrigation, harvest timing, pest alerts.' },
  { icon: <WaterDropIcon />,           title: 'Irrigation Planning',          desc: 'Optimize your watering schedule to save water and boost yields.' },
  { icon: <ScienceIcon />,             title: 'Fertilizer Recommendations',   desc: 'Soil-specific fertilizer guidance for each growth stage of your crops.' },
  { icon: <TrendingUpIcon />,          title: 'Yield Optimization',           desc: 'Data-driven tips to maximize harvest from your land and resources.' },
  { icon: <AgricultureOutlinedIcon />, title: 'Smart Farming Tips',           desc: 'Season planning, crop rotation, and modern farming techniques.' },
];

const QUICK_ACTIONS = [
  'Diagnose tomato leaf disease',
  'Will it rain tomorrow?',
  'Best fertilizer for paddy',
  'Optimize my irrigation schedule',
  'How to prevent pest attacks?',
];

// ─── FarmBot Page ──────────────────────────────────────────────────────────────
export default function FarmBot({ user }) {
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef    = useRef(null);
  const historyRef = useRef([]);
  const token      = localStorage.getItem('token');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const clearImage = () => { setImageFile(null); setImagePreview(''); };

  const onSend = async (message) => {
    let image_b64;
    if (imageFile) {
      image_b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.readAsDataURL(imageFile);
        r.onload  = () => res(r.result.split(',')[1]);
        r.onerror = rej;
      });
      clearImage();
    }

    const { data } = await axios.post(FARMBOT_API_URL, {
      farmer_id: user?.id || 'unknown',
      message:   message,
      image:     image_b64,
      history:   historyRef.current,
    }, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = data.response || data.error || 'No response received.';

    // append this exchange to history
    historyRef.current = [
      ...historyRef.current,
      { role: 'user',      text: message },
      { role: 'assistant', text: responseText },
    ];

    return {
      text: responseText,
      meta: { critical: data.critical },
    };
  };

  const renderMessageMeta = (msg) => {
    if (!msg?.meta?.critical) return null;
    return (
      <Chip
        label="CRITICAL — Agri Officer Alerted"
        size="small"
        sx={{
          mt: 1.5, bgcolor: 'rgba(198,40,40,0.1)', color: '#c62828',
          fontWeight: 700, fontSize: 10, borderRadius: '8px',
          border: '1px solid rgba(198,40,40,0.2)',
        }}
      />
    );
  };

  const renderImagePreviewBar = () => {
    if (!imagePreview) return null;
    return (
      <Box sx={{
        px: 3, py: 1.25,
        background: 'rgba(234,247,238,0.6)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${C.border}` }}>
          <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
        <Typography variant="caption" sx={{ color: C.muted, flexGrow: 1, fontSize: '0.78rem' }}>
          {imageFile?.name}
        </Typography>
        <IconButton size="small" onClick={clearImage} sx={{ color: '#c62828', bgcolor: 'rgba(198,40,40,0.08)', '&:hover': { bgcolor: 'rgba(198,40,40,0.16)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Hidden file input */}
      <input type="file" accept="image/*" ref={fileRef} hidden onChange={handleImageChange} />

      <AIChatBot
        botName="FarmBot AI"
        subtitle="Smart Farming Assistant 🌱"
        footerText="Powered by AgriConnect • AI Farming Intelligence 🌱"
        BotIcon={<AgricultureIcon />}

        greeting={`Hello ${user?.first_name || 'Farmer'}! 🌱`}
        description="I'm your AgriConnect FarmBot AI. I can help you with crop health, weather insights, disease detection, irrigation advice, fertilizer recommendations, and smart farming decisions powered by AI."
        capabilities={CAPABILITIES}
        quickActions={QUICK_ACTIONS}

        Illustration={FarmBotIllustration}

        onSend={onSend}
        renderImageUpload={renderImagePreviewBar}
        renderMessageMeta={renderMessageMeta}

        user={user}
      />

      {/* Image upload button — overlaid on the input area */}
      <Tooltip title={imageFile ? 'Photo attached' : 'Upload plant photo for diagnosis'}>
        <IconButton
          onClick={() => fileRef.current?.click()}
          sx={{
            position: 'absolute',
            bottom: { xs: 52, md: 54 },
            left: { xs: 12, md: 18 },
            zIndex: 10,
            width: 38, height: 38, borderRadius: '12px',
            color: imageFile ? C.primary : C.muted,
            bgcolor: imageFile ? C.light : 'rgba(0,0,0,0.04)',
            border: `1px solid ${imageFile ? C.border : 'transparent'}`,
            '&:hover': { bgcolor: C.light },
            transition: 'all 0.2s',
          }}
        >
          <AttachFileIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
