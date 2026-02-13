/**
 * @file MainLayout — Main app layout with sidebar and content area
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const DRAWER_WIDTH = 240;

import type { ThemeMode } from '../../store/preferences';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
}

export default function MainLayout({ themeMode, setThemeMode }: Props) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar themeMode={themeMode} setThemeMode={setThemeMode} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pb: 3,
          pt: 4,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
