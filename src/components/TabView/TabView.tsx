import { useState, type ReactElement } from 'react';
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { Box } from '@mui/material';
import SortableTab from './SortableTab';
import { useTabOrder } from './useTabOrder';

export interface TabItemConfig {
  id: string;
  label: string;
  icon: ReactElement;
  content: React.ReactNode;
}

export interface TabViewProps {
  tabs: TabItemConfig[];
  storageKey?: string;
  sortable?: boolean;
  defaultTab?: string;
}

export default function TabView({
  tabs, storageKey, sortable = true, defaultTab,
}: TabViewProps) {
  const tabIds = tabs.map((t) => t.id);
  const { order, moveTab, moveLeft, moveRight } = useTabOrder(tabIds, storageKey);
  const [activeTab, setActiveTab] = useState(defaultTab || order[0]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const fromIndex = order.indexOf(String(active.id));
      const toIndex = order.indexOf(String(over.id));
      moveTab(fromIndex, toIndex);
    }
  };

  const orderedTabs = order
    .map((id) => tabs.find((t) => t.id === id))
    .filter(Boolean) as TabItemConfig[];

  return (
    <Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={sortable ? [restrictToHorizontalAxis] : []}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          <Box
            role="tablist"
            sx={{
              display: 'flex',
              borderBottom: 1,
              borderColor: 'divider',
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 2 },
            }}
          >
            {orderedTabs.map((tab, i) => (
              <SortableTab
                key={tab.id}
                id={tab.id}
                label={tab.label}
                icon={tab.icon}
                isActive={tab.id === activeTab}
                index={i}
                totalCount={orderedTabs.length}
                sortable={sortable}
                onMoveLeft={() => moveLeft(i)}
                onMoveRight={() => moveRight(i)}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </Box>
        </SortableContext>
      </DndContext>

      {orderedTabs.map((tab) => (
        <Box
          key={tab.id}
          role="tabpanel"
          sx={{ display: tab.id === activeTab ? 'block' : 'none', pt: 3 }}
        >
          {tab.content}
        </Box>
      ))}
    </Box>
  );
}
