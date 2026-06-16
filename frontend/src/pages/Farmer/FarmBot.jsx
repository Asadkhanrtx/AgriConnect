import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress,
  Alert, Chip, Avatar, Tooltip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';

const FARMBOT_API_URL = import.meta.env.VITE_FARMBOT_API_URL || '';

const WELCOME = {
  id: 'welcome',
  role: 'bot',
  text: "Hello! I'm FarmBot 🌱\n\nI can help you with:\n• Crop disease diagnosis from photos\n• Pesticide and treatment advice\n• Harvest timing and irrigation\n• Pest identification\n\nUpload a photo of your crop or ask me anything!",
  ts: new Date()
};

const MessageBubble = ({ msg }) => {
  const isBot = msg.role === 'bot';
  return (
    <Box
      display="flex"
      justifyContent={isBot ? 'flex-start' : 'flex-end'}
      mb={1.5}
      sx={{ animation: 'fadeIn 0.2s ease' }}
    >
      {isBot && (
        <Avatar sx={{
          width: 32, height: 32, mr: 1, mt: 0.5, flexShrink: 0,
          bgcolor: '#123524', fontSize: 14
        }}>
          <AgricultureIcon sx={{ fontSize: 17 }} />
        </Avatar>
      )}
      <Box sx={{
        maxWidth: '75%',
        px: 2, py: 1.25,
        borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        background: isBot
          ? 'rgba(18,53,36,0.06)'
          : 'linear-gradient(135deg, #123524, #3E5F44)',
        color: isBot ? '#1a2e1d' : 'white',
        boxShadow: isBot
          ? '0 2px 8px rgba(18,53,36,0.08)'
          : '0 2px 12px rgba(18,53,36,0.25)',
      }}>
        {msg.imagePreview && (
          <Box mb={1} borderRadius="10px" overflow="hidden" maxHeight={180}>
            <img src={msg.imagePreview} alt="uploaded"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </Box>
        )}
        <Typography variant="body2" sx={{
          whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: '0.875rem'
        }}>
          {msg.text}
        </Typography>
        {msg.critical && (
          <Chip
            label="CRITICAL — Agri Officer contacted"
            size="small"
            sx={{
              mt: 1, bgcolor: 'rgba(198,40,40,0.12)', color: '#c62828',
              fontWeight: 700, fontSize: 10, borderRadius: '6px',
              border: '1px solid rgba(198,40,40,0.25)'
            }}
          />
        )}
        <Typography variant="caption" sx={{
          display: 'block', mt: 0.5, opacity: 0.5, fontSize: '0.68rem',
          textAlign: 'right'
        }}>
          {msg.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Box>
  );
};

const FarmBot = ({ user }) => {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.'); return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
    e.target.value = '';
  };

  const clearImage = () => { setImageFile(null); setImagePreview(''); };

  const handleSend = async () => {
    if (!input.trim() && !imageFile) return;
    if (!FARMBOT_API_URL) {
      setError('FarmBot API URL not configured. Set VITE_FARMBOT_API_URL in your environment.');
      return;
    }

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: input.trim() || '(photo uploaded)',
      imagePreview: imagePreview || undefined,
      ts: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    clearImage();
    setLoading(true);
    setError('');

    try {
      let image_b64 = undefined;
      if (imageFile) {
        image_b64 = await toBase64(imageFile);
      }

      const { data } = await axios.post(FARMBOT_API_URL, {
        farmer_id: user?.id || 'unknown',
        message: userMsg.text === '(photo uploaded)' ? '' : userMsg.text,
        image: image_b64
      }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: data.response,
        critical: data.critical,
        ts: new Date()
      }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Could not reach FarmBot. Please try again.';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: errMsg,
        ts: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '72vh',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(18,53,36,0.07)',
      boxShadow: '0 4px 24px rgba(18,53,36,0.08)',
      borderRadius: '18px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Box sx={{
        px: 2.5, py: 1.75,
        background: 'linear-gradient(135deg, #0a1f15, #123524)',
        display: 'flex', alignItems: 'center', gap: 1.5
      }}>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.12)', width: 36, height: 36 }}>
          <AgricultureIcon sx={{ color: '#A3B18A', fontSize: 20 }} />
        </Avatar>
        <Box>
          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '1rem', lineHeight: 1.1 }}>
            FarmBot
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
            Powered by Amazon Nova Lite · Crop Advisory AI
          </Typography>
        </Box>
        <Box ml="auto">
          <Chip label="BETA" size="small"
            sx={{ bgcolor: 'rgba(217,164,65,0.2)', color: '#D9A441', fontWeight: 700, fontSize: 10, border: '1px solid rgba(217,164,65,0.35)' }} />
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2.5, py: 2,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(18,53,36,0.15)', borderRadius: 2 }
      }}>
        <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {loading && (
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#123524', fontSize: 14 }}>
              <AgricultureIcon sx={{ fontSize: 17 }} />
            </Avatar>
            <Box sx={{
              px: 2, py: 1.25, borderRadius: '4px 16px 16px 16px',
              background: 'rgba(18,53,36,0.06)', display: 'flex', gap: 0.6, alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <Box key={i} sx={{
                  width: 7, height: 7, borderRadius: '50%', bgcolor: '#3E5F44',
                  animation: 'bounce 1.2s ease infinite',
                  animationDelay: `${i * 0.2}s`,
                  '@keyframes bounce': {
                    '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 },
                    '40%': { transform: 'scale(1)', opacity: 1 }
                  }
                }} />
              ))}
            </Box>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Image preview bar */}
      {imagePreview && (
        <Box sx={{
          px: 2.5, py: 1,
          background: 'rgba(18,53,36,0.04)',
          borderTop: '1px solid rgba(18,53,36,0.06)',
          display: 'flex', alignItems: 'center', gap: 1.5
        }}>
          <Box sx={{ position: 'relative', width: 52, height: 52, borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
            <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            {imageFile?.name}
          </Typography>
          <IconButton size="small" onClick={clearImage}
            sx={{ color: '#c62828', bgcolor: 'rgba(198,40,40,0.08)', '&:hover': { bgcolor: 'rgba(198,40,40,0.15)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box px={2.5} pb={0.5}>
          <Alert severity="error" sx={{ borderRadius: '10px', py: 0.5 }}
            onClose={() => setError('')}>{error}</Alert>
        </Box>
      )}

      {/* Input */}
      <Box sx={{
        px: 2, py: 1.5,
        borderTop: '1px solid rgba(18,53,36,0.08)',
        background: 'white',
        display: 'flex', alignItems: 'flex-end', gap: 1
      }}>
        <input type="file" accept="image/*" ref={fileRef} hidden onChange={handleImageChange} />
        <Tooltip title="Upload plant photo">
          <IconButton onClick={() => fileRef.current?.click()} disabled={loading}
            sx={{
              color: imageFile ? '#3E5F44' : '#9aab9c',
              bgcolor: imageFile ? 'rgba(62,95,68,0.1)' : 'transparent',
              mb: 0.25
            }}>
            <AttachFileIcon />
          </IconButton>
        </Tooltip>

        <TextField
          fullWidth
          multiline maxRows={4}
          placeholder="Ask about your crop, or upload a photo…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontSize: '0.875rem',
              '& fieldset': { borderColor: 'rgba(18,53,36,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(18,53,36,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#3E5F44' }
            }
          }}
        />

        <IconButton
          onClick={handleSend}
          disabled={loading || (!input.trim() && !imageFile)}
          sx={{
            mb: 0.25,
            bgcolor: (loading || (!input.trim() && !imageFile)) ? 'rgba(18,53,36,0.08)' : '#123524',
            color: (loading || (!input.trim() && !imageFile)) ? '#9aab9c' : 'white',
            '&:hover': { bgcolor: '#3E5F44' },
            transition: 'all 0.2s'
          }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#9aab9c' }} /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Strip the data:image/jpeg;base64, prefix — send only the base64 payload
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

export default FarmBot;
