import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Avatar, Chip, Paper,
  Fade, CircularProgress, Tooltip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import GrassIcon from '@mui/icons-material/Grass';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const C = {
  primary:  '#1B7F3A',
  dark:     '#184F2D',
  light:    '#EAF7EE',
  border:   '#D9EAD9',
  text:     '#2B2B2B',
  muted:    '#6E7F72',
  bg:       '#FFFFFF',
  inputBg:  '#F4F8F5',
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function strip(t) {
  return (t || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

// ─── ChatText: renders **bold** + line breaks ─────────────────────────────────
export function ChatText({ text, isUser = false }) {
  const clean = strip(text);
  return (
    <Typography
      component="div"
      sx={{
        fontSize: { xs: '0.9rem', md: '1rem' },
        lineHeight: 1.78,
        color: isUser ? 'white' : C.text,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {clean.split('\n').map((line, i) => {
        const marked = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `§B§${m}§/B§`);
        const parts  = marked.split(/(§B§.*?§\/B§)/);
        return (
          <span key={i} style={{ display: 'block', minHeight: line === '' ? '10px' : undefined }}>
            {parts.map((p, j) =>
              p.startsWith('§B§')
                ? <strong key={j} style={{ fontWeight: 700, color: isUser ? 'white' : C.dark }}>
                    {p.replace(/§B§|§\/B§/g, '')}
                  </strong>
                : p
            )}
          </span>
        );
      })}
    </Typography>
  );
}

// ─── TypingDots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <Box display="flex" gap={0.8} alignItems="center" py={0.5}>
      {[0, 1, 2].map(i => (
        <Box key={i} sx={{
          width: 9, height: 9, borderRadius: '50%', bgcolor: C.primary,
          animation: 'aiDot 1.3s ease infinite',
          animationDelay: `${i * 0.22}s`,
          '@keyframes aiDot': {
            '0%,80%,100%': { transform: 'scale(0.45)', opacity: 0.22 },
            '40%':          { transform: 'scale(1)',    opacity: 1   },
          },
        }} />
      ))}
    </Box>
  );
}

// ─── LiveBadge ────────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.8,
      border: `1.5px solid ${C.primary}`,
      borderRadius: '50px', px: 1.75, py: 0.55,
      background: C.light, userSelect: 'none',
    }}>
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%', bgcolor: C.primary,
        animation: 'livePulse 2.2s ease infinite',
        '@keyframes livePulse': {
          '0%,100%': { boxShadow: `0 0 0 0 rgba(27,127,58,0.55)` },
          '60%':     { boxShadow: `0 0 0 6px rgba(27,127,58,0)`   },
        },
      }} />
      <Typography sx={{ color: C.primary, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em' }}>
        LIVE
      </Typography>
    </Box>
  );
}

// ─── CapabilityRow ────────────────────────────────────────────────────────────
function CapRow({ icon, title, desc }) {
  return (
    <Box display="flex" alignItems="flex-start" gap={2} mb={2.5}>
      <Box sx={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: C.light, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {React.cloneElement(icon, { sx: { color: C.primary, fontSize: 22 } })}
      </Box>
      <Box pt={0.25}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '1rem', color: C.text, lineHeight: 1.25, mb: 0.3 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>
          {desc}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── BotAvatar ────────────────────────────────────────────────────────────────
function BotAvatar({ BotIcon, size = 38 }) {
  return (
    <Avatar sx={{
      width: size, height: size, flexShrink: 0,
      background: `linear-gradient(135deg, ${C.primary}, ${C.dark})`,
      border: `2px solid ${C.border}`,
      boxShadow: `0 2px 10px rgba(27,127,58,0.2)`,
    }}>
      {BotIcon
        ? React.cloneElement(BotIcon, { sx: { color: 'white', fontSize: size * 0.46 } })
        : null}
    </Avatar>
  );
}

// ─── Main AIChatBot Component ─────────────────────────────────────────────────
export default function AIChatBot({
  // Identity
  botName,
  subtitle,
  footerText,
  BotIcon,

  // Welcome content
  greeting,
  description,
  capabilities,
  quickActions,

  // Visual
  Illustration,

  // Functional
  onSend,
  hasImageUpload,
  renderImageUpload,
  renderMessageMeta,

  user,
}) {
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showQuick,     setShowQuick]     = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (override) => {
    const msg = typeof override === 'string' ? override.trim() : input.trim();
    if (!msg || loading) return;
    setInput('');
    setShowQuick(false);

    const userEntry = { role: 'user', text: msg, ts: new Date() };
    setMessages(prev => [...prev, userEntry]);
    setLoading(true);

    try {
      const result = await onSend(msg);
      const botEntry = {
        role: 'bot',
        text: typeof result === 'string' ? result : result.text,
        meta: typeof result === 'object' ? result.meta : undefined,
        ts: new Date(),
      };
      setMessages(prev => [...prev, botEntry]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Something went wrong. Please try again.', ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const stamp = (ts) => ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 180px)', minHeight: 600, maxHeight: 960,
      background: '#F6FCF8',
      borderRadius: '28px',
      border: `1px solid ${C.border}`,
      boxShadow: '0 4px 48px rgba(27,127,58,0.08)',
      overflow: 'hidden',
    }}>

      {/* ── Header (90 px) ─────────────────────────────────────────────────── */}
      <Box sx={{
        height: 90, flexShrink: 0,
        background: 'white',
        borderBottom: `1px solid ${C.border}`,
        px: { xs: 2.5, md: 4 },
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Avatar with online dot */}
          <Box sx={{ position: 'relative' }}>
            <Avatar sx={{
              width: 52, height: 52,
              background: `linear-gradient(135deg, ${C.primary}, ${C.dark})`,
              boxShadow: `0 4px 16px rgba(27,127,58,0.28)`,
            }}>
              {BotIcon && React.cloneElement(BotIcon, { sx: { color: 'white', fontSize: 26 } })}
            </Avatar>
            <Box sx={{
              position: 'absolute', bottom: 2, right: 2,
              width: 12, height: 12, borderRadius: '50%',
              bgcolor: '#22C55E', border: '2.5px solid white',
              boxShadow: '0 0 8px rgba(34,197,94,0.5)',
            }} />
          </Box>

          {/* Name + subtitle */}
          <Box>
            <Typography sx={{
              fontFamily: '"Satoshi", Inter, sans-serif',
              fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.2rem' },
              color: C.dark, lineHeight: 1.1,
            }}>
              {botName}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.6} mt={0.3}>
              <GrassIcon sx={{ fontSize: 13, color: C.primary }} />
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: C.muted, fontWeight: 500 }}>
                {subtitle}
              </Typography>
            </Box>
          </Box>
        </Box>

        <LiveBadge />
      </Box>

      {/* ── Body: chat (left) + illustration (right) ───────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Chat panel ─────────────────────────────────────────────────────── */}
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          borderRight: { xs: 'none', lg: `1px solid ${C.border}` },
        }}>

          {/* Message list */}
          <Box sx={{
            flex: 1, overflowY: 'auto',
            px: { xs: 2.5, md: 4 }, py: 3,
            display: 'flex', flexDirection: 'column', gap: 2.5,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-thumb': { bgcolor: C.border, borderRadius: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          }}>

            {/* Welcome bubble */}
            <Fade in timeout={500}>
              <Box display="flex" gap={2} alignItems="flex-start">
                <BotAvatar BotIcon={BotIcon} size={42} />
                <Paper elevation={0} sx={{
                  px: { xs: 2.5, md: 3.5 }, py: 3,
                  flex: 1, maxWidth: 720,
                  background: 'white',
                  border: `1px solid ${C.border}`,
                  borderRadius: '4px 28px 28px 28px',
                  boxShadow: '0 2px 20px rgba(27,127,58,0.07)',
                }}>
                  {/* Greeting */}
                  <Typography sx={{
                    fontFamily: '"Satoshi", Inter, sans-serif',
                    fontWeight: 800,
                    fontSize: { xs: '1.4rem', md: '1.6rem' },
                    color: C.dark, lineHeight: 1.2, mb: 1.25,
                  }}>
                    {greeting}
                  </Typography>

                  {/* Description */}
                  <Typography sx={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: { xs: '0.95rem', md: '1rem' },
                    color: C.text, lineHeight: 1.75, mb: 3,
                  }}>
                    {description}
                  </Typography>

                  {/* Capabilities */}
                  <Box>
                    {capabilities.map((cap, i) => (
                      <CapRow key={i} icon={cap.icon} title={cap.title} desc={cap.desc} />
                    ))}
                  </Box>

                  {/* Footer note */}
                  <Box sx={{
                    mt: 0.5, pt: 2.5,
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 1,
                  }}>
                    <Typography sx={{ fontSize: '0.8rem', color: C.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
                      All answers come from real-time data — no guessing.
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: C.border }}>
                      {stamp(new Date())}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            </Fade>

            {/* Conversation */}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <Box
                    display="flex"
                    justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                    alignItems="flex-end"
                    gap={1.5}
                  >
                    {msg.role === 'bot' && <BotAvatar BotIcon={BotIcon} size={34} />}

                    <Paper elevation={0} sx={{
                      px: 2.5, py: 2, maxWidth: { xs: '85%', md: '72%' },
                      borderRadius: msg.role === 'user' ? '22px 4px 22px 22px' : '4px 22px 22px 22px',
                      background: msg.role === 'user'
                        ? `linear-gradient(135deg, ${C.primary} 0%, ${C.dark} 100%)`
                        : 'white',
                      border: msg.role === 'bot' ? `1px solid ${C.border}` : 'none',
                      boxShadow: msg.role === 'user'
                        ? '0 4px 20px rgba(27,127,58,0.25)'
                        : '0 2px 14px rgba(27,127,58,0.07)',
                    }}>
                      <ChatText text={msg.text} isUser={msg.role === 'user'} />
                      {msg.role === 'bot' && renderMessageMeta?.(msg)}
                      <Typography sx={{
                        display: 'block', mt: 0.75, fontSize: '0.62rem', textAlign: 'right',
                        color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : C.border,
                      }}>
                        {stamp(msg.ts)}
                      </Typography>
                    </Paper>

                    {msg.role === 'user' && (
                      <Avatar sx={{ width: 34, height: 34, flexShrink: 0, bgcolor: C.light, border: `1px solid ${C.border}` }}>
                        <PersonIcon sx={{ fontSize: 17, color: C.primary }} />
                      </Avatar>
                    )}
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {loading && (
              <Fade in timeout={200}>
                <Box display="flex" gap={1.5} alignItems="flex-end">
                  <BotAvatar BotIcon={BotIcon} size={34} />
                  <Paper elevation={0} sx={{
                    px: 2.5, py: 2, background: 'white',
                    border: `1px solid ${C.border}`, borderRadius: '4px 22px 22px 22px',
                    boxShadow: '0 2px 14px rgba(27,127,58,0.07)',
                  }}>
                    <TypingDots />
                  </Paper>
                </Box>
              </Fade>
            )}

            <div ref={bottomRef} />
          </Box>

          {/* Quick actions */}
          {showQuick && (
            <Box sx={{
              px: { xs: 2.5, md: 4 }, py: 1.75,
              borderTop: `1px solid ${C.border}`,
              background: 'white',
              display: 'flex', gap: 1, flexWrap: 'wrap',
            }}>
              {quickActions.map((qa, i) => (
                <Chip
                  key={i}
                  label={qa}
                  size="small"
                  onClick={() => handleSend(qa)}
                  sx={{
                    background: C.light,
                    border: `1px solid ${C.border}`,
                    color: C.dark,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    height: 34,
                    borderRadius: '50px',
                    cursor: 'pointer',
                    transition: 'all 0.22s',
                    '&:hover': {
                      background: '#d0edda',
                      borderColor: C.primary,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 14px rgba(27,127,58,0.15)',
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Image preview slot (FarmBot injects it via renderImageUpload) */}
          {renderImageUpload?.()}

          {/* Input */}
          <Box sx={{
            px: { xs: 2, md: 3 }, py: 2,
            background: 'white',
            borderTop: `1px solid ${C.border}`,
            display: 'flex', gap: 1.5, alignItems: 'flex-end',
          }}>
            {/* Extra left controls (e.g., image upload button) */}
            {hasImageUpload && renderImageUpload ? null : null /* handled externally */}

            <TextField
              fullWidth multiline maxRows={4} variant="outlined"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  minHeight: 56, borderRadius: '24px',
                  fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: C.text,
                  bgcolor: C.inputBg,
                  '& fieldset': { borderColor: C.border, borderWidth: 1.5 },
                  '&:hover fieldset': { borderColor: '#A3C8AD' },
                  '&.Mui-focused fieldset': { borderColor: C.primary, borderWidth: 2 },
                },
                '& textarea::placeholder': { color: C.muted, opacity: 1, fontFamily: 'Inter, sans-serif' },
              }}
            />

            <Tooltip title="Send">
              <span>
                <IconButton
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  sx={{
                    width: 56, height: 56, borderRadius: '18px', flexShrink: 0,
                    background: input.trim() && !loading
                      ? `linear-gradient(135deg, ${C.primary}, ${C.dark})`
                      : C.light,
                    color: input.trim() && !loading ? 'white' : C.border,
                    transition: 'all 0.25s',
                    '&:hover': {
                      background: `linear-gradient(135deg, #25a04a, ${C.primary})`,
                      boxShadow: '0 6px 22px rgba(27,127,58,0.32)',
                      transform: 'translateY(-1px)',
                    },
                    '&:disabled': { background: C.light },
                  }}
                >
                  {loading
                    ? <CircularProgress size={20} sx={{ color: C.primary }} />
                    : <SendIcon sx={{ fontSize: 22 }} />
                  }
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Illustration panel (desktop only) ──────────────────────────────── */}
        <Box sx={{
          display: { xs: 'none', lg: 'flex' },
          width: '38%', flexShrink: 0,
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(150deg, #F0FBF4 0%, #E4F5EB 50%, #F2FAF5 100%)',
          p: 4, overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Decorative circles */}
          <Box sx={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(27,127,58,0.05)' }} />
          <Box sx={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(27,127,58,0.04)' }} />

          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 1 }}
          >
            <Illustration />
          </motion.div>
        </Box>
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0, py: 1.25,
        background: 'white',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
      }}>
        <VerifiedUserIcon sx={{ fontSize: 13, color: C.muted }} />
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: C.muted }}>
          {footerText}
        </Typography>
      </Box>
    </Box>
  );
}
