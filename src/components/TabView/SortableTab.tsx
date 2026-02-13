import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, ButtonBase, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Props {
  id: string;
  label: string;
  icon: ReactElement;
  isActive: boolean;
  index: number;
  totalCount: number;
  sortable: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onClick: () => void;
}

export default function SortableTab({
  id, label, icon, isActive, index, totalCount,
  sortable, onMoveLeft, onMoveRight, onClick,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const showArrows = useMediaQuery(theme.breakpoints.up('sm'));

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
    >
      {/* Left arrow */}
      {sortable && showArrows && index > 0 && (
        <Tooltip title={t('tabs.move_left')}>
          <IconButton size="small" onClick={onMoveLeft} sx={{ p: 0.25 }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Tab button */}
      <ButtonBase
        {...attributes}
        {...(sortable ? listeners : {})}
        onClick={onClick}
        role="tab"
        aria-selected={isActive}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: { xs: 1.5, sm: 2 }, py: 1.5,
          borderBottom: 2,
          borderColor: isActive ? 'primary.main' : 'transparent',
          color: isActive ? 'primary.main' : 'text.secondary',
          fontWeight: isActive ? 600 : 400,
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
          cursor: sortable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          transition: 'color 0.2s, border-color 0.2s',
          '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        {icon}
        {!isXs && label}
      </ButtonBase>

      {/* Right arrow */}
      {sortable && showArrows && index < totalCount - 1 && (
        <Tooltip title={t('tabs.move_right')}>
          <IconButton size="small" onClick={onMoveRight} sx={{ p: 0.25 }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
