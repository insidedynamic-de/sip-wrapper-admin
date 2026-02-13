/**
 * @file MainLayout — Main app layout with sidebar, content area, and global Apply button
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ApplyChangesButton from '../ApplyChangesButton';

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
          pt: 10,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        {/* Global Apply Changes button — top-right */}
        <Box sx={{ position: 'absolute', top: 24, right: 24 }}>
          <ApplyChangesButton />
        </Box>
        <Outlet />
      </Box>
    </Box>
  );
}
