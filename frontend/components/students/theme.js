export const COLORS = {
  blue: '#1565C0',
  blueDark: '#0D47A1',
  blueLight: '#EAF3FC',
  blueBorder: '#BFDCFA',

  white: '#FFFFFF',
  background: '#F5F7FA',

  text: '#1A2332',
  secondaryText: '#64748B',
  mutedText: '#94A3B8',

  border: '#E4E9F0',

  red: '#D32F2F',
  redLight: '#FDECEC',
  redBorder: '#F5C6C6',

  successBg: '#ECFDF3',
  successText: '#027A48',
  successBorder: '#ABEFC6',
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const cardSx = {
  backgroundColor: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
};

export const inputFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: COLORS.white,
    minHeight: 42,
    '& fieldset': { borderColor: COLORS.border },
    '&:hover fieldset': { borderColor: COLORS.blueBorder },
    '&.Mui-focused fieldset': {
      borderColor: COLORS.blue,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputBase-input': { fontSize: '13px' },
  '& .MuiFormHelperText-root': { fontSize: '11px', mx: 0, mt: 0.5 },
};

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
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blueLight,
  },
  '&.Mui-disabled': {
    borderColor: COLORS.border,
    color: COLORS.mutedText,
  },
  '&:focus-visible': {
    outline: `2px solid ${COLORS.blue}`,
    outlineOffset: '2px',
  },
};

export const containedButtonSx = {
  minHeight: 40,
  px: 2,
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '13px',
  backgroundColor: COLORS.blue,
  color: COLORS.white,
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: COLORS.blueDark,
    boxShadow: 'none',
  },
  '&.Mui-disabled': {
    backgroundColor: '#CBD5E1',
    color: COLORS.white,
  },
  '&:focus-visible': {
    outline: `2px solid ${COLORS.blueDark}`,
    outlineOffset: '2px',
  },
};

export const iconButtonSx = {
  '&:focus-visible': {
    outline: `2px solid ${COLORS.blue}`,
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
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
};