/**
 * @file MainLayout — Main app layout with collapsible sidebar and content area
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar, { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from './Sidebar';
import { loadPreferences, savePreferences } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
}

export default function MainLayout({ themeMode, setThemeMode }: Props) {
  const [collapsed, setCollapsed] = useState(() => loadPreferences().sidebarCollapsed);

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    savePreferences({ sidebarCollapsed: next });
  };

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pb: 3,
          pt: 4,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
          transition: 'width 0.2s ease',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
