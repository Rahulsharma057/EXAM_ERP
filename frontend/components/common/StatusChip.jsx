import React from 'react';
import { Chip } from '@mui/material';

const STATUS_COLORS = {
  DRAFT: 'default',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
  CLOSED: 'error',
  ARCHIVED: 'warning'
};

export default function StatusChip({ status }) {
  return <Chip size="small" label={status} color={STATUS_COLORS[status] || 'default'} />;
}
