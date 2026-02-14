/**
 * @file CrudTable — Reusable generic table with status, enabled toggle in actions,
 *       draggable column reordering, and search filtering
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Chip, Switch, IconButton, TextField,
  InputAdornment,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import SortableHeaderCell from './SortableHeaderCell';
import { useColumnOrder } from '../hooks/useColumnOrder';

/** A single data column definition */
export interface CrudColumn<T> {
  /** Unique ID for column ordering — falls back to index if omitted */
  id?: string;
  /** Header label (already translated by caller) */
  header: string;
  /** Key of T for simple text rendering */
  field?: keyof T;
  /** Custom cell renderer — takes priority over field */
  render?: (row: T, index: number) => ReactNode;
  /** Text extractor for search filtering (needed for custom render columns) */
  searchText?: (row: T) => string;
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

  // ── Enabled toggle (optional — rendered inside Actions column) ──
  /** Returns current enabled state. If omitted, no toggle in actions. */
  getEnabled?: (row: T) => boolean;
  /** Called when user flips the switch */
  onToggle?: (row: T, index: number) => void;
  /** Header text for enabled column (unused — kept for backward compat) */
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

  // ── Column reordering ──
  /** localStorage key for persisting column order. Enables drag-to-reorder when set. */
  columnOrderKey?: string;

  // ── Search ──
  /** Show a search field above the table */
  searchable?: boolean;
}

/** Extract text value from a row for a given column (for search) */
function colText<T>(col: CrudColumn<T>, row: T): string {
  if (col.searchText) return col.searchText(row);
  if (col.field) return String((row as Record<string, unknown>)[col.field as string] ?? '');
  return '';
}

export default function CrudTable<T>({
  rows,
  getKey,
  columns,
  getStatus,
  statusHeader,
  getEnabled,
  onToggle,
  onView,
  onEdit,
  onDelete,
  dimDisabled,
  withCard = true,
  emptyMessage,
  size = 'small',
  stickyHeader,
  maxHeight,
  columnOrderKey,
  searchable,
}: CrudTableProps<T>) {
  const { t } = useTranslation();
  const hasActions = !!(onView || onEdit || onDelete || getEnabled);
  const shouldDim = dimDisabled ?? !!getEnabled;
  const [search, setSearch] = useState('');

  // Build full column list on every render (cheap — just spreads + optional push)
  // This keeps render closures fresh (they capture parent state like registrations, users, etc.)
  const statusColumn: CrudColumn<T> | null = getStatus ? {
    id: '__status__',
    header: statusHeader || t('field.status'),
    width: 120,
    render: (row: T) => {
      const enabled = getEnabled ? getEnabled(row) : true;
      const s = getEnabled && !enabled
        ? { label: t('status.deactivated'), color: 'default' as const }
        : getStatus(row);
      return <Chip size="small" label={s.label} color={s.color} />;
    },
    searchText: (row: T) => {
      const enabled = getEnabled ? getEnabled(row) : true;
      const s = getEnabled && !enabled
        ? { label: t('status.deactivated'), color: 'default' as const }
        : getStatus(row);
      return s.label;
    },
  } : null;

  const allColumns = statusColumn ? [...columns, statusColumn] : columns;

  // Column IDs — stabilised by joining into a string so inline column arrays
  // don't cause useColumnOrder to reset on every render
  const idString = allColumns.map((col, i) => col.id || `col-${i}`).join('\0');
  const columnIds = useMemo(() => idString.split('\0'), [idString]);

  const { order, moveColumn } = useColumnOrder(columnIds, columnOrderKey);

  // Build ordered columns using stable order but current column objects
  const orderedColumns = useMemo(() => {
    if (!columnOrderKey) return allColumns;
    const colMap = new Map(allColumns.map((col, i) => [col.id || `col-${i}`, col]));
    return order
      .map((id) => colMap.get(id))
      .filter(Boolean) as CrudColumn<T>[];
    // allColumns changes identity every render, but order is stable —
    // this is intentional so render closures stay fresh
  }, [allColumns, order, columnOrderKey]);

  // DnD sensors (same config as TabView)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const fromIndex = order.indexOf(String(active.id));
      const toIndex = order.indexOf(String(over.id));
      moveColumn(fromIndex, toIndex);
    }
  };

  // Filter rows by search text
  const filteredRows = useMemo(() => {
    if (!searchable || !search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      orderedColumns.some((col) => colText(col, row).toLowerCase().includes(q)),
    );
  }, [rows, search, searchable, orderedColumns]);

  const totalCols =
    orderedColumns.length +
    (hasActions ? 1 : 0);

  // Header row content (just the cells, no wrapper divs inside <tr>)
  const headerCells = columnOrderKey ? (
    orderedColumns.map((col, i) => (
      <SortableHeaderCell
        key={col.id || `col-${i}`}
        id={col.id || `col-${i}`}
        label={col.header}
        width={col.width}
        align={col.align}
      />
    ))
  ) : (
    orderedColumns.map((col, i) => (
      <TableCell key={i} sx={col.width ? { width: col.width } : undefined} align={col.align}>
        {col.header}
      </TableCell>
    ))
  );

  const tableContent = (
    <TableContainer sx={maxHeight ? { maxHeight } : undefined}>
      <Table size={size} stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow>
            {headerCells}
            {hasActions && <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: '1%' }}>{t('field.actions')}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRows.map((row, i) => {
            const enabled = getEnabled ? getEnabled(row) : true;
            return (
              <TableRow
                key={getKey(row, i)}
                sx={shouldDim && !enabled ? { opacity: 0.5 } : undefined}
              >
                {orderedColumns.map((col, ci) => (
                  <TableCell key={col.id || ci} align={col.align}>
                    {col.render ? col.render(row, i) : String((row as Record<string, unknown>)[col.field as string] ?? '')}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell sx={{ whiteSpace: 'nowrap', width: '1%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                      {getEnabled && (
                        <Switch
                          size="small"
                          checked={enabled}
                          onChange={() => onToggle?.(row, i)}
                          color={enabled ? 'success' : 'default'}
                        />
                      )}
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
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {filteredRows.length === 0 && emptyMessage && (
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

  // Wrap with DndContext outside the table to avoid injecting divs into <tr>
  const table = columnOrderKey ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        {tableContent}
      </SortableContext>
    </DndContext>
  ) : tableContent;

  const searchBar = searchable ? (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <TextField
        size="small"
        fullWidth
        placeholder={t('table.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  ) : null;

  if (!withCard) {
    return (
      <>
        {searchBar}
        {table}
      </>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {searchBar}
        {table}
      </CardContent>
    </Card>
  );
}
