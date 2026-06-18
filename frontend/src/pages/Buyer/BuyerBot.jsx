import React, { useRef } from 'react';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SearchIcon from '@mui/icons-material/Search';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BarChartIcon from '@mui/icons-material/BarChart';
import GavelIcon from '@mui/icons-material/Gavel';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AIChatBot from '../../components/AIChatBot';

const BUYERBOT_API_URL = import.meta.env.VITE_BUYERBOT_API_URL || '';

// ─── BuyerBot SVG Illustration ─────────────────────────────────────────────────
function BuyerBotIllustration() {
  return (
    <svg viewBox="0 0 400 440" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
      <defs>
        <radialGradient id="bbBg" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor="#C8EDD4" />
          <stop offset="100%" stopColor="#E8F7EE" />
        </radialGradient>
        <linearGradient id="bbRobot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#25A04A" />
          <stop offset="100%" stopColor="#184F2D" />
        </linearGradient>
        <linearGradient id="bbBasket" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5E3C" />
          <stop offset="100%" stopColor="#5C3D22" />
        </linearGradient>
        <linearGradient id="bbCoin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD740" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <ellipse cx="200" cy="220" rx="190" ry="195" fill="url(#bbBg)" />

      {/* Ground */}
      <ellipse cx="200" cy="408" rx="175" ry="34" fill="#A8D8B4" opacity="0.55" />
      <ellipse cx="80"  cy="400" rx="90"  ry="22" fill="#B8E6C4" opacity="0.4"  />
      <ellipse cx="330" cy="402" rx="80"  ry="20" fill="#B8E6C4" opacity="0.35" />

      {/* ── Market stall / price tag (top right) ── */}
      <rect x="300" y="60" width="86" height="62" rx="16" fill="white" opacity="0.85" />
      <rect x="300" y="60" width="86" height="62" rx="16" fill="none" stroke="#1B7F3A" strokeWidth="2" opacity="0.4" />
      <text x="343" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill="#184F2D" opacity="0.8">BEST</text>
      <text x="343" y="102" textAnchor="middle" fontSize="11" fontWeight="700" fill="#184F2D" opacity="0.8">PRICE</text>
      <text x="343" y="116" textAnchor="middle" fontSize="9" fill="#1B7F3A" opacity="0.65">TODAY</text>
      {/* Tag hole */}
      <circle cx="343" cy="64" r="5" fill="#1B7F3A" opacity="0.5" />
      {/* Tag string */}
      <line x1="343" y1="59" x2="343" y2="48" stroke="#1B7F3A" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />

      {/* ── Coins (left side) ── */}
      <ellipse cx="72" cy="290" rx="28" ry="10" fill="url(#bbCoin)" opacity="0.8" />
      <rect x="44" y="270" width="56" height="20" rx="3" fill="url(#bbCoin)" opacity="0.8" />
      <ellipse cx="72" cy="270" rx="28" ry="10" fill="#FFE082" opacity="0.95" />
      <text x="72" y="274" textAnchor="middle" fontSize="11" fontWeight="900" fill="#795548" opacity="0.7">₹</text>

      <ellipse cx="72" cy="252" rx="24" ry="8.5" fill="url(#bbCoin)" opacity="0.75" />
      <rect x="48" y="234" width="48" height="18" rx="3" fill="url(#bbCoin)" opacity="0.72" />
      <ellipse cx="72" cy="234" rx="24" ry="8.5" fill="#FFE082" opacity="0.92" />
      <text x="72" y="238" textAnchor="middle" fontSize="10" fontWeight="900" fill="#795548" opacity="0.65">₹</text>

      {/* ── Vegetables floating (right) ── */}
      {/* Carrot */}
      <ellipse cx="330" cy="255" rx="8" ry="22" fill="#FF6F00" opacity="0.82" transform="rotate(18 330 255)" />
      <line x1="325" y1="233" x2="322" y2="218" stroke="#1B7F3A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="330" y1="231" x2="330" y2="216" stroke="#25A04A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="335" y1="233" x2="338" y2="218" stroke="#1B7F3A" strokeWidth="2.5" strokeLinecap="round" />

      {/* Capsicum */}
      <ellipse cx="360" cy="290" rx="16" ry="20" fill="#4CAF50" opacity="0.8" />
      <line x1="360" y1="270" x2="360" y2="258" stroke="#184F2D" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="349" cy="285" rx="5"  ry="10" fill="#388E3C" opacity="0.55" />
      <ellipse cx="371" cy="285" rx="5"  ry="10" fill="#388E3C" opacity="0.55" />

      {/* ── Robot head ── */}
      <rect x="148" y="102" width="104" height="90" rx="24" fill="url(#bbRobot)" />
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
      <rect x="143" y="209" width="114" height="92" rx="24" fill="url(#bbRobot)" />
      {/* Chest panel */}
      <rect x="165" y="225" width="70" height="52" rx="15" fill="rgba(255,255,255,0.12)" />
      {/* Chart bars on chest */}
      <rect x="174" y="256" width="8" height="14" rx="3" fill="#4ADE80" opacity="0.85" />
      <rect x="186" y="248" width="8" height="22" rx="3" fill="#4ADE80" opacity="0.7"  />
      <rect x="198" y="242" width="8" height="28" rx="3" fill="#4ADE80" opacity="0.9"  />
      <rect x="210" y="252" width="8" height="18" rx="3" fill="#4ADE80" opacity="0.65" />
      <rect x="222" y="245" width="8" height="25" rx="3" fill="#4ADE80" opacity="0.75" />

      {/* ── Arms ── */}
      <rect x="104" y="215" width="36" height="70" rx="18" fill="url(#bbRobot)" />
      <circle cx="122" cy="291" r="17" fill="url(#bbRobot)" />
      <rect x="260" y="215" width="36" height="70" rx="18" fill="url(#bbRobot)" />
      <circle cx="278" cy="291" r="17" fill="url(#bbRobot)" />

      {/* Left hand */}
      <circle cx="122" cy="300" r="13" fill="#184F2D" />

      {/* Right arm holds basket */}
      <circle cx="278" cy="300" r="13" fill="#184F2D" />

      {/* ── Market basket ── */}
      <path d="M 262 298 Q 262 330 290 334 Q 318 338 322 316 Q 326 295 306 292 Q 290 290 262 298 Z" fill="url(#bbBasket)" opacity="0.85" />
      {/* Basket weave lines */}
      <line x1="265" y1="305" x2="320" y2="300" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <line x1="266" y1="315" x2="321" y2="308" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <line x1="275" y1="293" x2="270" y2="330" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <line x1="292" y1="291" x2="290" y2="332" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <line x1="308" y1="292" x2="310" y2="332" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      {/* Basket handle */}
      <path d="M 272 296 Q 292 272 312 296" stroke="url(#bbBasket)" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Items in basket (peaking out) */}
      <circle cx="280" cy="292" r="10" fill="#E53935" opacity="0.85" />
      <circle cx="296" cy="289" r="10" fill="#FF6F00" opacity="0.8"  />
      <circle cx="311" cy="292" r="9"  fill="#4CAF50" opacity="0.85" />

      {/* ── Legs ── */}
      <rect x="160" y="300" width="36" height="60" rx="18" fill="url(#bbRobot)" />
      <rect x="204" y="300" width="36" height="60" rx="18" fill="url(#bbRobot)" />
      {/* Feet */}
      <rect x="153" y="352" width="48" height="18" rx="9" fill="#184F2D" />
      <rect x="199" y="352" width="48" height="18" rx="9" fill="#184F2D" />

      {/* Floating sparkles / data dots */}
      <circle cx="105" cy="170" r="6"  fill="#FFD740" opacity="0.55" />
      <circle cx="302" cy="162" r="5"  fill="#4ADE80" opacity="0.6"  />
      <circle cx="92"  cy="250" r="4"  fill="#FFD740" opacity="0.4"  />
      <circle cx="145" cy="82"  r="4"  fill="#4ADE80" opacity="0.45" />
      <circle cx="262" cy="88"  r="5"  fill="#FFD740" opacity="0.5"  />
      {/* Price tag floating */}
      <rect x="68" y="145" width="52" height="28" rx="8" fill="white" opacity="0.75" />
      <text x="94" y="164" textAnchor="middle" fontSize="12" fontWeight="800" fill="#184F2D" opacity="0.8">₹LIVE</text>
    </svg>
  );
}

// ─── BuyerBot capability config ───────────────────────────────────────────────
const CAPABILITIES = [
  { icon: <SearchIcon />,       title: 'Find Produce',           desc: 'Search live marketplace listings by product, category, or price range.' },
  { icon: <AttachMoneyIcon />,  title: 'Price Intelligence',     desc: 'Get real-time min, max, and average prices for any agricultural commodity.' },
  { icon: <BarChartIcon />,     title: 'Market Analytics',       desc: 'Live marketplace stats — volume, trends, and availability insights.' },
  { icon: <GavelIcon />,        title: 'Smart Bid Strategy',     desc: 'See current bids on any listing and get competitive bidding recommendations.' },
  { icon: <Inventory2Icon />,   title: 'Availability Search',    desc: 'Find out what categories and products are available in the marketplace today.' },
  { icon: <TrendingUpIcon />,   title: 'Demand Forecasting',     desc: 'Understand demand trends to time your purchases for the best value.' },
];

const QUICK_ACTIONS = [
  'Find tomatoes under ₹30/kg',
  'Average wheat price today',
  'What should I bid today?',
  'Show available vegetables',
  'Best deals near me',
];

// ─── BuyerBot Page ────────────────────────────────────────────────────────────
export default function BuyerBot({ user }) {
  const token      = localStorage.getItem('token');
  const historyRef = useRef([]);

  const onSend = async (message) => {
    const res = await fetch(BUYERBOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, token, history: historyRef.current }),
    });
    const data = await res.json();
    const responseText = data.response || data.error || 'Something went wrong.';

    historyRef.current = [
      ...historyRef.current,
      { role: 'user',      text: message },
      { role: 'assistant', text: responseText },
    ];

    return { text: responseText };
  };

  return (
    <AIChatBot
      botName="BuyerBot AI"
      subtitle="Marketplace Intelligence 🛒"
      footerText="Powered by AgriConnect • Live Marketplace Data 🛒"
      BotIcon={<SmartToyIcon />}

      greeting={`Hello ${user?.first_name || 'Buyer'}! 🛒`}
      description="I'm your AgriConnect BuyerBot AI. I fetch real-time data from the marketplace — product listings, live prices, bid intelligence, and availability — all powered by Amazon Nova AI."
      capabilities={CAPABILITIES}
      quickActions={QUICK_ACTIONS}

      Illustration={BuyerBotIllustration}

      onSend={onSend}
      user={user}
    />
  );
}
