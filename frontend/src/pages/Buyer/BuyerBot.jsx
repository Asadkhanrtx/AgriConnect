import React, { useState, useRef, useEffect } from 'react';
import {
  Box, TextField, IconButton, Typography, Paper, CircularProgress,
  Avatar, Chip, Fade
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GavelIcon from '@mui/icons-material/Gavel';
import CategoryIcon from '@mui/icons-material/Category';

const BUYERBOT_API_URL = import.meta.env.VITE_BUYERBOT_API_URL || '';

const SUGGESTIONS = [
  { icon: <SearchIcon sx={{ fontSize: 14 }} />, text: 'Find tomatoes under ₹30/kg' },
  { icon: <TrendingUpIcon sx={{ fontSize: 14 }} />, text: 'What is the average price of wheat?' },
  { icon: <GavelIcon sx={{ fontSize: 14 }} />, text: 'What should I bid on listing #3?' },
  { icon: <CategoryIcon sx={{ fontSize: 14 }} />, text: 'What categories are available today?' },
];

const BotAvatar = () => (
  <Avatar sx={{
    width: 32, height: 32, flexShrink: 0,
    background: 'linear-gradient(135deg, #123524, #3E5F44)',
  }}>
    <SmartToyIcon sx={{ fontSize: 17, color: '#A3B18A' }} />
  </Avatar>
);

const UserAvatar = () => (
  <Avatar sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: 'rgba(18,53,36,0.10)' }}>
    <PersonIcon sx={{ fontSize: 17, color: '#3E5F44' }} />
  </Avatar>
);

const TypingDots = () => (
  <Box display="flex" gap={0.5} alignItems="center" px={0.5} py={0.25}>
    {[0, 1, 2].map(i => (
      <Box key={i} sx={{
        width: 7, height: 7, borderRadius: '50%', bgcolor: '#A3B18A',
        animation: 'bounce 1.1s infinite',
        animationDelay: `${i * 0.18}s`,
        '@keyframes bounce': {
          '0%,80%,100%': { transform: 'scale(0.7)', opacity: 0.5 },
          '40%': { transform: 'scale(1)', opacity: 1 },
        },
      }} />
    ))}
  </Box>
);

export default function BuyerBot({ user }) {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: `Hello ${user?.first_name || 'there'}! 👋 I'm your AgriConnect BuyerBot.\n\nI can help you:\n• 🔍 Find fresh produce at the best prices\n• 📊 Compare market prices in real-time\n• 🎯 Decide competitive bid amounts\n• 🌿 Discover what's available today\n\nWhat are you looking for?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const res = await fetch(BUYERBOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, token }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.response || data.error || 'Sorry, something went wrong.',
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'BuyerBot is temporarily unavailable. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const isFirstMessage = messages.length === 1;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '72vh', maxHeight: 720,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)',
      border: '1px solid rgba(18,53,36,0.07)',
      boxShadow: '0 4px 24px rgba(18,53,36,0.08)',
      borderRadius: '20px', overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2.5, py: 1.75,
        background: 'linear-gradient(135deg, #0a1f15 0%, #123524 60%, #3E5F44 100%)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Avatar sx={{ width: 38, height: 38, background: 'rgba(163,177,138,0.15)', border: '1px solid rgba(163,177,138,0.25)' }}>
          <SmartToyIcon sx={{ color: '#A3B18A', fontSize: 20 }} />
        </Avatar>
        <Box>
          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '0.97rem', lineHeight: 1.1 }}>
            BuyerBot AI
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(163,177,138,0.8)', fontSize: '0.7rem' }}>
            Powered by Amazon Nova · Real-time market data
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4CAF50', boxShadow: '0 0 6px #4CAF50' }} />
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(18,53,36,0.12)', borderRadius: 2 },
      }}>
        {messages.map((msg, i) => (
          <Fade in key={i} timeout={300}>
            <Box display="flex" gap={1} alignItems="flex-start"
              flexDirection={msg.role === 'user' ? 'row-reverse' : 'row'}>
              {msg.role === 'bot' ? <BotAvatar /> : <UserAvatar />}
              <Paper elevation={0} sx={{
                px: 2, py: 1.25, maxWidth: '78%',
                borderRadius: msg.role === 'user'
                  ? '16px 4px 16px 16px'
                  : '4px 16px 16px 16px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #123524, #3E5F44)'
                  : 'rgba(18,53,36,0.04)',
                border: msg.role === 'bot' ? '1px solid rgba(18,53,36,0.06)' : 'none',
              }}>
                <Typography sx={{
                  fontSize: '0.875rem', lineHeight: 1.65,
                  color: msg.role === 'user' ? 'white' : '#1a2e1d',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text}
                </Typography>
              </Paper>
            </Box>
          </Fade>
        ))}

        {loading && (
          <Fade in timeout={200}>
            <Box display="flex" gap={1} alignItems="flex-start">
              <BotAvatar />
              <Paper elevation={0} sx={{
                px: 2, py: 1.25, borderRadius: '4px 16px 16px 16px',
                background: 'rgba(18,53,36,0.04)', border: '1px solid rgba(18,53,36,0.06)',
              }}>
                <TypingDots />
              </Paper>
            </Box>
          </Fade>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* Suggestion chips — show only before first user message */}
      {isFirstMessage && (
        <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map((s, i) => (
            <Chip
              key={i}
              icon={s.icon}
              label={s.text}
              size="small"
              onClick={() => send(s.text)}
              sx={{
                fontWeight: 600, fontSize: '0.72rem', borderRadius: '8px', cursor: 'pointer',
                bgcolor: 'rgba(18,53,36,0.05)', color: '#3E5F44',
                border: '1px solid rgba(18,53,36,0.12)',
                '& .MuiChip-icon': { color: '#3E5F44' },
                '&:hover': { bgcolor: 'rgba(18,53,36,0.10)' },
              }}
            />
          ))}
        </Box>
      )}

      {/* Input */}
      <Box sx={{
        px: 2, py: 1.5, borderTop: '1px solid rgba(18,53,36,0.07)',
        background: 'rgba(255,255,255,0.8)', display: 'flex', gap: 1, alignItems: 'flex-end',
      }}>
        <TextField
          fullWidth multiline maxRows={4} variant="outlined"
          placeholder="Ask about prices, availability, or bids…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px', fontSize: '0.875rem',
              '& fieldset': { borderColor: 'rgba(18,53,36,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(18,53,36,0.30)' },
              '&.Mui-focused fieldset': { borderColor: '#3E5F44' },
            },
          }}
        />
        <IconButton
          onClick={() => send()}
          disabled={!input.trim() || loading}
          sx={{
            width: 44, height: 44, flexShrink: 0,
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #123524, #3E5F44)'
              : 'rgba(18,53,36,0.07)',
            color: input.trim() && !loading ? 'white' : 'rgba(18,53,36,0.3)',
            borderRadius: '12px', transition: 'all 0.2s',
            '&:hover': { background: 'linear-gradient(135deg, #0a1f15, #123524)' },
            '&:disabled': { background: 'rgba(18,53,36,0.05)', color: 'rgba(18,53,36,0.2)' },
          }}
        >
          {loading ? <CircularProgress size={18} sx={{ color: '#3E5F44' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}
