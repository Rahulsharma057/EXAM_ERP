/* ============================================================
   THEME — deep navy, single-hue identity

   Design intent:
   - One family of blues, two intensities:
       "blue*"   = deep structural navy (headers, avatars, borders)
       "accent*" = a slightly more vivid navy — reserved for
                   primary actions (Add Student, Save, Import) and
                   the live student-count chip, so the eye has one
                   thing to land on without introducing a new hue.
   - Cool, neutral background (not warm paper) to match a navy,
     data-dense admin surface.
   - Cards get a very subtle shadow back (barely-there depth)
     instead of being fully flat — reads more premium than a
     pure border-only card.
============================================================ */

export const COLORS = {
  // Structural — deep navy (headers, avatars, chips, borders)
  blue: '#3f20ae',
  blueDark: '#2c409a',
  blueLight: '#EAF0FB',
  blueBorder: '#C3D3EC',

  // Primary action accent — a brighter royal navy, used ONLY for
  // main CTAs and the live-count chip.
  accent: '#2b53af',
  accentDark: '#153b88',
  accentLight: '#E8EEFC',
  accentBorder: '#BFD0F5',

  white: '#FFFFFF',
  background: '#F4F6FB',

  text: '#111827',
  secondaryText: '#5B6472',
  mutedText: '#94A0B3',

  border: '#E1E6EF',

  red: '#C4291D',
  redLight: '#FCEBEA',
  redBorder: '#F3C6C2',

  successBg: '#E9F7EF',
  successText: '#157347',
  successBorder: '#BFE5D0',
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const cardSx = {
  backgroundColor: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '12px',
  // Barely-there depth instead of fully flat — reads more premium.
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 0 rgba(15, 23, 42, 0.03)',
};

// Gradient header used on the table's TableHead cells.
export const tableHeaderCellSx = {
  background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueDark} 100%)`,
  color: COLORS.white,
  fontWeight: 700,
  fontSize: '12px',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
  py: 1.5,
  px: 2,
  borderBottom: `1px solid ${COLORS.blueDark}`,
};

export const inputFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: COLORS.white,
    minHeight: 42,
    '& fieldset': { borderColor: COLORS.border },
    '&:hover fieldset': { borderColor: COLORS.blueBorder },
    '&.Mui-focused fieldset': {
      borderColor: COLORS.accent,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputBase-input': { fontSize: '13px' },
  '& .MuiFormHelperText-root': { fontSize: '11px', mx: 0, mt: 0.5 },
};

// Neutral / secondary actions (Refresh, Cancel, Download Template)
export const outlinedButtonSx = {
  minHeight: 40,
  px: 2,
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '13px',
  borderColor: COLORS.border,
  color: COLORS.text,
  '&:hover': {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  '&.Mui-disabled': {
    borderColor: COLORS.border,
    color: COLORS.mutedText,
  },
  '&:focus-visible': {
    outline: `2px solid ${COLORS.accent}`,
    outlineOffset: '2px',
  },
};

// Primary actions (Add Student, Save Changes, Import Students)
export const containedButtonSx = {
  minHeight: 40,
  px: 2,
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '13px',
  backgroundColor: COLORS.accent,
  color: COLORS.white,
  boxShadow: '0 1px 2px rgba(19, 41, 75, 0.18)',
  '&:hover': {
    backgroundColor: COLORS.accentDark,
    boxShadow: '0 2px 6px rgba(19, 41, 75, 0.28)',
  },
  '&.Mui-disabled': {
    backgroundColor: '#C7CEDB',
    color: COLORS.white,
    boxShadow: 'none',
  },
  '&:focus-visible': {
    outline: `2px solid ${COLORS.accentDark}`,
    outlineOffset: '2px',
  },
};

export const iconButtonSx = {
  '&:focus-visible': {
    outline: `2px solid ${COLORS.accent}`,
    outlineOffset: '1px',
  },
};

export const dialogTitleSx = {
  fontSize: '16px',
  fontWeight: 700,
  color: COLORS.text,
  borderBottom: `1px solid ${COLORS.border}`,
  py: 2,
  px: 2.5,
};

export const dialogPaperSx = {
  borderRadius: '14px',
};

export const snackbarAlertSx = {
  borderRadius: '9px',
  fontSize: '13px',
  fontWeight: 500,
  alignItems: 'center',
  boxShadow: '0 8px 24px rgba(10, 25, 48, 0.22)',
};