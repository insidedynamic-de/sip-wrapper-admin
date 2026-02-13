/**
 * @file CrudTable — Reusable generic table with status, enabled toggle, and actions
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Chip, Switch, IconButton,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

/** A single data column definition */
export interface CrudColumn<T> {
  /** Header label (already translated by caller) */
  header: string;
  /** Key of T for simple text rendering */
  field?: keyof T;
  /** Custom cell renderer — takes priority over field */
  render?: (row: T, index: number) => ReactNode;
  /** Optional fixed width */
  width?: number | string;
  /** Horizontal alignment — defaults to 'left' */
  align?: 'left' | 'center' | 'right';
}

/** Status chip descriptor */
export interface StatusDescriptor {
  label: string;
  color: ChipProps['color'];
}

/** Main CrudTable props */
export interface CrudTableProps<T> {
  /** Data rows */
  rows: T[];
  /** Unique key extractor */
  getKey: (row: T, index: number) => string | number;
  /** Configurable data columns */
  columns: CrudColumn<T>[];

  // ── Status column (optional) ──
  /** Returns chip label + color. If omitted, no Status column. */
  getStatus?: (row: T) => StatusDescriptor;
  /** Header text for status column */
  statusHeader?: string;

  // ── Enabled toggle (optional) ──
  /** Returns current enabled state. If omitted, no Enabled column. */
  getEnabled?: (row: T) => boolean;
  /** Called when user flips the switch */
  onToggle?: (row: T, index: number) => void;
  /** Header text for enabled column */
  enabledHeader?: string;

  // ── Action buttons (each optional) ──
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;

  // ── Row styling ──
  /** Dim disabled rows — defaults to true when getEnabled is provided */
  dimDisabled?: boolean;

  // ── Wrapping ──
  /** Wrap table in Card > CardContent — defaults to true */
  withCard?: boolean;

  // ── Empty state ──
  /** Content shown when rows is empty */
  emptyMessage?: string;

  // ── Table variant ──
  size?: 'small' | 'medium';
  stickyHeader?: boolean;
  maxHeight?: number;
}

export default function CrudTable<T>({
  rows,
  getKey,
  columns,
  getStatus,
  statusHeader,
  getEnabled,
  onToggle,
  enabledHeader,
  onView,
  onEdit,
  onDelete,
  dimDisabled,
  withCard = true,
  emptyMessage,
  size = 'small',
  stickyHeader,
  maxHeight,
}: CrudTableProps<T>) {
  const { t } = useTranslation();
  const hasActions = !!(onView || onEdit || onDelete);
  const shouldDim = dimDisabled ?? !!getEnabled;

  const totalCols =
    columns.length +
    (getStatus ? 1 : 0) +
    (getEnabled ? 1 : 0) +
    (hasActions ? 1 : 0);

  const table = (
    <TableContainer sx={maxHeight ? { maxHeight } : undefined}>
      <Table size={size} stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow>
            {columns.map((col, i) => (
              <TableCell key={i} sx={col.width ? { width: col.width } : undefined} align={col.align}>
                {col.header}
              </TableCell>
            ))}
            {getStatus && <TableCell>{statusHeader || t('field.status')}</TableCell>}
            {getEnabled && <TableCell>{enabledHeader || t('status.enabled')}</TableCell>}
            {hasActions && <TableCell align="right">{t('field.actions')}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => {
            const enabled = getEnabled ? getEnabled(row) : true;
            return (
              <TableRow
                key={getKey(row, i)}
                sx={shouldDim && !enabled ? { opacity: 0.5 } : undefined}
              >
                {columns.map((col, ci) => (
                  <TableCell key={ci} align={col.align}>
                    {col.render ? col.render(row, i) : String((row as Record<string, unknown>)[col.field as string] ?? '')}
                  </TableCell>
                ))}
                {getStatus && (() => {
                  const s = getEnabled && !enabled
                    ? { label: t('status.deactivated'), color: 'default' as const }
                    : getStatus(row);
                  return (
                    <TableCell>
                      <Chip size="small" label={s.label} color={s.color} />
                    </TableCell>
                  );
                })()}
                {getEnabled && (
                  <TableCell>
                    <Switch
                      size="small"
                      checked={enabled}
                      onChange={() => onToggle?.(row, i)}
                      color={enabled ? 'success' : 'default'}
                    />
                  </TableCell>
                )}
                {hasActions && (
                  <TableCell align="right">
                    {onView && (
                      <IconButton size="small" onClick={() => onView(row)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    )}
                    {onEdit && (
                      <IconButton size="small" onClick={() => onEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {onDelete && (
                      <IconButton size="small" color="error" onClick={() => onDelete(row)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {rows.length === 0 && emptyMessage && (
            <TableRow>
              <TableCell colSpan={totalCols} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (!withCard) return table;

  return (
    <Card>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {table}
      </CardContent>
    </Card>
  );
}
