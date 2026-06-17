import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress,
  Alert, Chip, Avatar, Tooltip, Paper, Fade
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';

const FARMBOT_API_URL = import.meta.env.VITE_FARMBOT_API_URL || '';

const SUGGESTIONS = [
  'My tomato leaves have yellow spots — what disease is this?',
  'Should I switch from wheat to soybean this season?',
  'Best fertilizer schedule for rice in monsoon?',
  'When is the right time to harvest onions?',
];

function stripThinking(text) {
  return (text || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

function ChatText({ text, color }) {
  const cleaned = stripThinking(text);
  return (
    <Typography component="div" sx={{ fontSize: '0.875rem', lineHeight: 1.75, color: color || 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {cleaned.split('\n').map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `§B§${m}§/B§`);
        const parts = bold.split(/(§B§.*?§\/B§)/);
        return (
          <span key={i} style={{ display: 'block', marginBottom: line === '' ? '6px' : '1px' }}>
            {parts.map((p, j) =>
              p.startsWith('§B§') ? <strong key={j}>{p.replace(/§B§|§\/B§/g, '')}</strong> : p
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
        width: 7, height: 7, borderRadius: '50%', bgcolor: '#A3B18A',
        animation: 'fb-bounce 1.2s ease infinite',
        animationDelay: `${i * 0.2}s`,
        '@keyframes fb-bounce': {
          '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.35 },
          '40%': { transform: 'scale(1)', opacity: 1 },
        },
      }} />
    ))}
  </Box>
);

const WELCOME = {
  id: 'welcome', role: 'bot', ts: new Date(),
  text: "Namaste! I'm FarmBot 🌱\n\nI'm your personal agricultural advisor. Ask me anything about:\n\n**Crop Advisory** — switching crops, yield improvement, season planning\n**Disease Diagnosis** — upload a photo of your crop for instant diagnosis\n**Treatment Advice** — pesticides, organic solutions, dosage\n**Market Guidance** — when to sell, price expectations\n\nWhat can I help you with today?",
};

export default function FarmBot({ user }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
    e.target.value = '';
  };

  const clearImage = () => { setImageFile(null); setImagePreview(''); };

  const handleSend = async (override) => {
    const msg = (override || input).trim();
    if (!msg && !imageFile) return;
    if (!FARMBOT_API_URL) { setError('FarmBot API not configured.'); return; }

    setShowSuggestions(false);
    const userMsg = { id: Date.now(), role: 'user', text: msg || '(photo uploaded)', imagePreview: imagePreview || undefined, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); clearImage(); setLoading(true); setError('');

    try {
      let image_b64;
      if (imageFile) {
        image_b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.readAsDataURL(imageFile);
          r.onload = () => res(r.result.split(',')[1]);
          r.onerror = rej;
        });
      }
      const { data } = await axios.post(FARMBOT_API_URL, {
        farmer_id: user?.id || 'unknown',
        message: userMsg.text === '(photo uploaded)' ? '' : userMsg.text,
        image: image_b64,
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: data.response, critical: data.critical, ts: new Date() }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Could not reach FarmBot. Please try again.';
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: errMsg, ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '76vh', maxHeight: 760,
      borderRadius: '20px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 4px 32px rgba(18,53,36,0.10)',
      border: '1px solid rgba(18,53,36,0.09)',
    }}>
      {/* Subtle farm background */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.07,
      }} />
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, background: 'rgba(248,247,242,0.93)' }} />

      {/* Header */}
      <Box sx={{
        position: 'relative', zIndex: 2, px: 2.5, py: 1.75,
        background: 'rgba(255,255,255,0.97)',
        borderBottom: '1px solid rgba(18,53,36,0.08)',
        display: 'flex', alignItems: 'center', gap: 1.5,
        backdropFilter: 'blur(12px)',
      }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar sx={{ width: 40, height: 40, background: 'linear-gradient(135deg, #1a4a2e, #3E5F44)', border: '2px solid rgba(163,177,138,0.35)' }}>
            <AgricultureIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Avatar>
          <Box sx={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', bgcolor: '#4CAF50', border: '1.5px solid white', boxShadow: '0 0 6px rgba(76,175,80,0.6)' }} />
        </Box>
        <Box flex={1}>
          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: '#0d2818', fontSize: '1rem', lineHeight: 1.1 }}>
            FarmBot AI
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b8f71', fontSize: '0.68rem', letterSpacing: '0.02em' }}>
            Powered by Amazon Nova · Crop Advisory & Disease Diagnosis
          </Typography>
        </Box>
        <Chip label="AI" size="small" sx={{ bgcolor: 'rgba(217,164,65,0.12)', color: '#B8860B', fontWeight: 700, fontSize: 10, border: '1px solid rgba(217,164,65,0.3)', borderRadius: '6px' }} />
      </Box>

      {/* Messages */}
      <Box sx={{
        position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', px: 2.5, py: 2,
        display: 'flex', flexDirection: 'column', gap: 2,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(18,53,36,0.15)', borderRadius: 4 },
      }}>
        {messages.map(msg => (
          <Fade in key={msg.id} timeout={300}>
            <Box display="flex" justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'} gap={1} alignItems="flex-end">
              {msg.role === 'bot' && (
                <Avatar sx={{ width: 30, height: 30, flexShrink: 0, mb: 0.5, background: 'linear-gradient(135deg, #1a4a2e, #3E5F44)', border: '1.5px solid rgba(163,177,138,0.3)' }}>
                  <AgricultureIcon sx={{ fontSize: 15, color: '#fff' }} />
                </Avatar>
              )}
              <Box sx={{ maxWidth: '78%' }}>
                {msg.imagePreview && (
                  <Box mb={1} borderRadius="12px" overflow="hidden" sx={{ maxHeight: 180 }}>
                    <img src={msg.imagePreview} alt="uploaded" style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
                  </Box>
                )}
                <Paper elevation={0} sx={{
                  px: 2, py: 1.5,
                  borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #0d3320 0%, #1e6040 100%)'
                    : 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(8px)',
                  border: msg.role === 'bot'
                    ? '1px solid rgba(18,53,36,0.09)'
                    : 'none',
                  boxShadow: msg.role === 'user'
                    ? '0 4px 16px rgba(13,51,32,0.22)'
                    : '0 2px 12px rgba(18,53,36,0.07)',
                }}>
                  <ChatText
                    text={msg.text}
                    color={msg.role === 'user' ? 'rgba(255,255,255,0.95)' : '#1a2e1a'}
                  />
                  {msg.critical && (
                    <Chip label="CRITICAL — Agri Officer Alerted" size="small" sx={{ mt: 1.5, bgcolor: 'rgba(198,40,40,0.10)', color: '#c62828', fontWeight: 700, fontSize: 10, borderRadius: '6px', border: '1px solid rgba(198,40,40,0.2)' }} />
                  )}
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.45, fontSize: '0.65rem', textAlign: 'right', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#4a6b52' }}>
                    {msg.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Fade>
        ))}

        {loading && (
          <Fade in timeout={200}>
            <Box display="flex" gap={1} alignItems="flex-end">
              <Avatar sx={{ width: 30, height: 30, flexShrink: 0, mb: 0.5, background: 'linear-gradient(135deg, #1a4a2e, #3E5F44)' }}>
                <AgricultureIcon sx={{ fontSize: 15, color: '#fff' }} />
              </Avatar>
              <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: '4px 18px 18px 18px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(18,53,36,0.09)', boxShadow: '0 2px 12px rgba(18,53,36,0.07)' }}>
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
            <Chip key={i} label={s} size="small" onClick={() => handleSend(s)}
              sx={{ cursor: 'pointer', fontWeight: 500, fontSize: '0.72rem', borderRadius: '8px', bgcolor: 'rgba(18,53,36,0.06)', color: '#1a3d25', border: '1px solid rgba(18,53,36,0.12)', '&:hover': { bgcolor: 'rgba(18,53,36,0.11)' } }} />
          ))}
        </Box>
      )}

      {/* Image preview */}
      {imagePreview && (
        <Box sx={{ position: 'relative', zIndex: 2, px: 2.5, py: 1, background: 'rgba(248,247,242,0.97)', borderTop: '1px solid rgba(18,53,36,0.07)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(18,53,36,0.12)' }}>
            <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
          <Typography variant="caption" sx={{ color: '#6b8f71', flexGrow: 1, fontSize: '0.75rem' }}>{imageFile?.name}</Typography>
          <IconButton size="small" onClick={clearImage} sx={{ color: '#c62828', bgcolor: 'rgba(198,40,40,0.08)', '&:hover': { bgcolor: 'rgba(198,40,40,0.15)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box px={2.5} pb={0.5} sx={{ position: 'relative', zIndex: 2 }}>
          <Alert severity="error" sx={{ borderRadius: '10px', py: 0.5 }} onClose={() => setError('')}>{error}</Alert>
        </Box>
      )}

      {/* Input */}
      <Box sx={{
        position: 'relative', zIndex: 2, px: 2, py: 1.5,
        background: 'rgba(255,255,255,0.97)',
        borderTop: '1px solid rgba(18,53,36,0.08)',
        display: 'flex', alignItems: 'flex-end', gap: 1,
        backdropFilter: 'blur(12px)',
      }}>
        <input type="file" accept="image/*" ref={fileRef} hidden onChange={handleImageChange} />
        <Tooltip title="Upload plant photo">
          <IconButton onClick={() => fileRef.current?.click()} disabled={loading}
            sx={{ color: imageFile ? '#1a4a2e' : 'rgba(18,53,36,0.35)', bgcolor: imageFile ? 'rgba(18,53,36,0.08)' : 'transparent', mb: 0.25, '&:hover': { bgcolor: 'rgba(18,53,36,0.08)' } }}>
            <AttachFileIcon />
          </IconButton>
        </Tooltip>
        <TextField fullWidth multiline maxRows={4} variant="outlined"
          placeholder="Ask about your farm, or upload a crop photo…"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px', fontSize: '0.875rem', color: '#1a2e1a',
              bgcolor: '#f4f6f2',
              '& fieldset': { borderColor: 'rgba(18,53,36,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(18,53,36,0.30)' },
              '&.Mui-focused fieldset': { borderColor: '#3E5F44' },
            },
            '& textarea::placeholder': { color: 'rgba(18,53,36,0.35)' },
          }}
        />
        <IconButton onClick={() => handleSend()} disabled={loading || (!input.trim() && !imageFile)}
          sx={{
            mb: 0.25, width: 44, height: 44, borderRadius: '12px',
            background: (!loading && (input.trim() || imageFile)) ? 'linear-gradient(135deg, #0d3320, #1e6040)' : 'rgba(18,53,36,0.07)',
            color: (!loading && (input.trim() || imageFile)) ? 'white' : 'rgba(18,53,36,0.25)',
            transition: 'all 0.2s',
            '&:hover': { background: 'linear-gradient(135deg, #123524, #2d6a47)' },
          }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#3E5F44' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}
