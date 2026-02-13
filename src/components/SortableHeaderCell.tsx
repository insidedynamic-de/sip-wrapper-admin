/**
 * @file SortableHeaderCell — Draggable table header cell using @dnd-kit/sortable
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableCell, Box } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

interface Props {
  id: string;
  label: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

export default function SortableHeaderCell({ id, label, width, align }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <TableCell
      ref={setNodeRef}
      style={style}
      sx={width ? { width } : undefined}
      align={align}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        {label}
      </Box>
    </TableCell>
  );
}
