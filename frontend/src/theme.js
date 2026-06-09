import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main:         '#123524',  // Deep Forest
      light:        '#3E5F44',  // Olive Green
      dark:         '#0a1f15',
      contrastText: '#ffffff',
    },
    secondary: {
      main:         '#D9A441',  // Golden Wheat
      light:        '#E8BF7A',
      dark:         '#B8862E',
      contrastText: '#ffffff',
    },
    success: {
      main:  '#3E5F44',
      light: '#A3B18A',
      dark:  '#123524',
    },
    warning: {
      main: '#D9A441',
    },
    background: {
      default: '#F8F7F2',  // Warm Cream
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#1a2e1d',
      secondary: '#5a6b5c',
      disabled:  '#9aab9c',
    },
    divider: 'rgba(18,53,36,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 800 },
    h3: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Satoshi", "Inter", sans-serif', fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  shadows: [
    'none',
    '0 1px 3px rgba(18,53,36,0.06)',
    '0 2px 6px rgba(18,53,36,0.08)',
    '0 4px 12px rgba(18,53,36,0.10)',
    '0 6px 18px rgba(18,53,36,0.10)',
    '0 8px 24px rgba(18,53,36,0.12)',
    '0 10px 32px rgba(18,53,36,0.12)',
    '0 12px 40px rgba(18,53,36,0.14)',
    '0 16px 48px rgba(18,53,36,0.14)',
    '0 20px 56px rgba(18,53,36,0.16)',
    '0 24px 64px rgba(18,53,36,0.16)',
    '0 28px 72px rgba(18,53,36,0.18)',
    '0 32px 80px rgba(18,53,36,0.18)',
    '0 36px 88px rgba(18,53,36,0.20)',
    '0 40px 96px rgba(18,53,36,0.20)',
    '0 44px 104px rgba(18,53,36,0.22)',
    '0 48px 112px rgba(18,53,36,0.22)',
    '0 52px 120px rgba(18,53,36,0.24)',
    '0 56px 128px rgba(18,53,36,0.24)',
    '0 60px 136px rgba(18,53,36,0.26)',
    '0 64px 144px rgba(18,53,36,0.26)',
    '0 68px 152px rgba(18,53,36,0.28)',
    '0 72px 160px rgba(18,53,36,0.28)',
    '0 76px 168px rgba(18,53,36,0.30)',
    '0 80px 176px rgba(18,53,36,0.30)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          padding: '9px 22px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #123524 0%, #3E5F44 100%)',
          boxShadow: '0 4px 14px rgba(18,53,36,0.30)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0a1f15 0%, #2d4a33 100%)',
            boxShadow: '0 6px 20px rgba(18,53,36,0.40)',
            transform: 'translateY(-1px)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #D9A441 0%, #E8BF7A 100%)',
          boxShadow: '0 4px 14px rgba(217,164,65,0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #B8862E 0%, #D9A441 100%)',
            boxShadow: '0 6px 20px rgba(217,164,65,0.45)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '18px',
          boxShadow: '0 4px 20px rgba(18,53,36,0.07)',
          border: '1px solid rgba(18,53,36,0.06)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: '8px', fontWeight: 600 },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#3E5F44',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#123524',
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.01em',
          '&.Mui-selected': { color: '#123524' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: '#123524', height: 3, borderRadius: 2 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            color: '#123524',
            letterSpacing: '0.02em',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: 'rgba(18,53,36,0.025)' },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },
  },
});

export default theme;
