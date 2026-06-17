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
  { icon: <SearchIcon sx={{ fontSize: 13 }} />, text: 'Find tomatoes under ₹30/kg' },
  { icon: <TrendingUpIcon sx={{ fontSize: 13 }} />, text: 'What is the average price of wheat?' },
  { icon: <GavelIcon sx={{ fontSize: 13 }} />, text: 'What should I bid on listing #1?' },
  { icon: <CategoryIcon sx={{ fontSize: 13 }} />, text: 'What categories are available today?' },
];

function stripThinking(text) {
  return (text || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

function ChatText({ text, color }) {
  const cleaned = stripThinking(text);
  return (
    <Typography component="div" sx={{ fontSize: '0.875rem', lineHeight: 1.75, color: color || 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {cleaned.split('\n').map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `§BOLD§${m}§/BOLD§`);
        const parts = bold.split(/(§BOLD§.*?§\/BOLD§)/);
        return (
          <span key={i} style={{ display: 'block', marginBottom: line === '' ? '6px' : '1px' }}>
            {parts.map((p, j) =>
              p.startsWith('§BOLD§') ? <strong key={j}>{p.replace(/§BOLD§|§\/BOLD§/g, '')}</strong> : p
            )}
          </span>
        );
      })}
    </Typography>
  );
}

const TypingDots = () => (
  <Box display="flex" gap={0.6} alignItems="center" py={0.5}>
    {[0, 1, 2].map(i => (
      <Box key={i} sx={{
        width: 7, height: 7, borderRadius: '50%', bgcolor: 'rgba(163,177,138,0.8)',
        animation: 'bb-bounce 1.1s infinite',
        animationDelay: `${i * 0.18}s`,
        '@keyframes bb-bounce': {
          '0%,80%,100%': { transform: 'scale(0.65)', opacity: 0.4 },
          '40%': { transform: 'scale(1)', opacity: 1 },
        },
      }} />
    ))}
  </Box>
);

export default function BuyerBot({ user }) {
  const [messages, setMessages] = useState([{
    role: 'bot',
    text: `Hello ${user?.first_name || 'there'}! I'm your AgriConnect BuyerBot.\n\nI can help you with real-time data from the marketplace:\n\n**Find Produce** — "Find me tomatoes under ₹30/kg"\n**Price Intelligence** — "What's the average price of wheat today?"\n**Bid Strategy** — "What should I bid on listing #3?"\n**What's Available** — "Show me all categories available"\n\nAll answers come from live marketplace data — no guessing.`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (override) => {
    const msg = (override || input).trim();
    if (!msg || loading) return;
    setInput('');
    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const res = await fetch(BUYERBOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, token }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.response || data.error || 'Something went wrong.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'BuyerBot is temporarily unavailable. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '76vh', maxHeight: 760,
      borderRadius: '20px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 8px 40px rgba(10,31,21,0.18)',
      border: '1px solid rgba(18,53,36,0.10)',
    }}>
      {/* Background */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'brightness(0.15) saturate(0.5)',
      }} />
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, background: 'rgba(6,18,10,0.85)' }} />

      {/* Header */}
      <Box sx={{
        position: 'relative', zIndex: 2, px: 2.5, py: 1.75,
        background: 'linear-gradient(135deg, rgba(6,18,10,0.98) 0%, rgba(18,53,36,0.95) 100%)',
        borderBottom: '1px solid rgba(163,177,138,0.12)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar sx={{ width: 40, height: 40, background: 'linear-gradient(135deg, #0d3320, #1a5c35)', border: '2px solid rgba(163,177,138,0.25)' }}>
            <SmartToyIcon sx={{ color: '#A3B18A', fontSize: 20 }} />
          </Avatar>
          <Box sx={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', bgcolor: '#4CAF50', border: '1.5px solid #060e09', boxShadow: '0 0 6px #4CAF50' }} />
        </Box>
        <Box flex={1}>
          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '1rem', lineHeight: 1.1 }}>
            BuyerBot AI
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(163,177,138,0.7)', fontSize: '0.68rem', letterSpacing: '0.03em' }}>
            Amazon Nova · Real-time marketplace data
          </Typography>
        </Box>
        <Chip label="LIVE DATA" size="small" sx={{ bgcolor: 'rgba(76,175,80,0.12)', color: '#4CAF50', fontWeight: 700, fontSize: 9, border: '1px solid rgba(76,175,80,0.25)', borderRadius: '6px' }} />
      </Box>

      {/* Messages */}
      <Box sx={{
        position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', px: 2.5, py: 2,
        display: 'flex', flexDirection: 'column', gap: 2,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(163,177,138,0.15)', borderRadius: 4 },
      }}>
        {messages.map((msg, i) => (
          <Fade in key={i} timeout={300}>
            <Box display="flex" justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'} gap={1} alignItems="flex-end">
              {msg.role === 'bot' && (
                <Avatar sx={{ width: 30, height: 30, flexShrink: 0, mb: 0.5, background: 'linear-gradient(135deg, #0d3320, #1a5c35)', border: '1px solid rgba(163,177,138,0.2)' }}>
                  <SmartToyIcon sx={{ fontSize: 15, color: '#A3B18A' }} />
                </Avatar>
              )}
              <Paper elevation={0} sx={{
                px: 2, py: 1.5, maxWidth: '78%',
                borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #0d3320 0%, #1a5c35 100%)'
                  : 'rgba(255,255,255,0.065)',
                backdropFilter: msg.role === 'bot' ? 'blur(12px)' : 'none',
                border: msg.role === 'bot' ? '1px solid rgba(163,177,138,0.1)' : 'none',
                boxShadow: msg.role === 'user' ? '0 4px 16px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.25)',
              }}>
                <ChatText text={msg.text} color={msg.role === 'user' ? 'rgba(255,255,255,0.95)' : 'rgba(215,235,215,0.95)'} />
                {msg.role === 'bot' && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.35, fontSize: '0.65rem', color: '#A3B18A' }}>
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                )}
              </Paper>
              {msg.role === 'user' && (
                <Avatar sx={{ width: 30, height: 30, flexShrink: 0, mb: 0.5, bgcolor: 'rgba(163,177,138,0.12)', border: '1px solid rgba(163,177,138,0.15)' }}>
                  <PersonIcon sx={{ fontSize: 15, color: 'rgba(163,177,138,0.7)' }} />
                </Avatar>
              )}
            </Box>
          </Fade>
        ))}

        {loading && (
          <Fade in timeout={200}>
            <Box display="flex" gap={1} alignItems="flex-end">
              <Avatar sx={{ width: 30, height: 30, flexShrink: 0, mb: 0.5, background: 'linear-gradient(135deg, #0d3320, #1a5c35)' }}>
                <SmartToyIcon sx={{ fontSize: 15, color: '#A3B18A' }} />
              </Avatar>
              <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: '4px 18px 18px 18px', background: 'rgba(255,255,255,0.065)', backdropFilter: 'blur(12px)', border: '1px solid rgba(163,177,138,0.1)' }}>
                <TypingDots />
              </Paper>
            </Box>
          </Fade>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Suggestions */}
      {showSuggestions && messages.length === 1 && (
        <Box sx={{ position: 'relative', zIndex: 2, px: 2.5, pb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map((s, i) => (
            <Chip key={i} icon={s.icon} label={s.text} size="small" onClick={() => send(s.text)}
              sx={{ cursor: 'pointer', fontWeight: 500, fontSize: '0.72rem', borderRadius: '8px', bgcolor: 'rgba(163,177,138,0.08)', color: 'rgba(200,225,200,0.85)', border: '1px solid rgba(163,177,138,0.15)', '& .MuiChip-icon': { color: 'rgba(163,177,138,0.6)' }, '&:hover': { bgcolor: 'rgba(163,177,138,0.16)' } }} />
          ))}
        </Box>
      )}

      {/* Input */}
      <Box sx={{
        position: 'relative', zIndex: 2, px: 2, py: 1.5,
        background: 'rgba(6,18,10,0.92)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(163,177,138,0.08)',
        display: 'flex', gap: 1, alignItems: 'flex-end',
      }}>
        <TextField fullWidth multiline maxRows={4} variant="outlined"
          placeholder="Ask about prices, availability, or bid strategy…"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px', fontSize: '0.875rem', color: 'rgba(215,235,215,0.95)',
              bgcolor: 'rgba(255,255,255,0.05)',
              '& fieldset': { borderColor: 'rgba(163,177,138,0.18)' },
              '&:hover fieldset': { borderColor: 'rgba(163,177,138,0.35)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(163,177,138,0.55)' },
            },
            '& textarea::placeholder': { color: 'rgba(163,177,138,0.35)' },
          }}
        />
        <IconButton onClick={() => send()} disabled={!input.trim() || loading}
          sx={{
            width: 44, height: 44, flexShrink: 0, borderRadius: '12px',
            background: input.trim() && !loading ? 'linear-gradient(135deg, #0d3320, #1a5c35)' : 'rgba(163,177,138,0.07)',
            color: input.trim() && !loading ? 'white' : 'rgba(163,177,138,0.25)',
            transition: 'all 0.2s',
            '&:hover': { background: 'linear-gradient(135deg, #123524, #2d6a47)' },
            '&:disabled': { background: 'rgba(163,177,138,0.05)' },
          }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#A3B18A' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}
