/**
 * @file ErrorBoundary — Catches React render errors, shows error UI in content area
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import {
  Box, Typography, Button, Alert, Collapse,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import BugReportIcon from '@mui/icons-material/BugReport';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface Props {
  children: ReactNode;
  resetKey?: string;
  labels: {
    title: string;
    message: string;
    showDetails: string;
    hideDetails: string;
    reload: string;
    sendReport: string;
    goDashboard: string;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: '', showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo: errorInfo.componentStack || '' });
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: '', showDetails: false });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: '', showDetails: false });
    window.location.hash = '#/';
  };

  handleSendReport = () => {
    const { error, errorInfo } = this.state;
    const subject = encodeURIComponent(`[SIP Wrapper] Error Report: ${error?.message || 'Unknown error'}`);
    const body = encodeURIComponent(
      `Error Report\n` +
      `============\n\n` +
      `URL: ${window.location.href}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `User Agent: ${navigator.userAgent}\n\n` +
      `Error: ${error?.message || 'Unknown'}\n\n` +
      `Stack:\n${error?.stack || 'N/A'}\n\n` +
      `Component Stack:\n${errorInfo || 'N/A'}\n`,
    );
    window.open(`mailto:support@insidedynamic.de?subject=${subject}&body=${body}`);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo, showDetails } = this.state;
    const { labels } = this.props;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          px: 3,
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />

        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {labels.title}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
          {labels.message}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, maxWidth: 600, width: '100%', textAlign: 'left' }}>
            {error.message}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.handleReload}>
            {labels.reload}
          </Button>
          <Button variant="outlined" startIcon={<HomeIcon />} onClick={this.handleGoDashboard}>
            {labels.goDashboard}
          </Button>
          <Button variant="outlined" color="warning" startIcon={<BugReportIcon />} onClick={this.handleSendReport}>
            {labels.sendReport}
          </Button>
        </Box>

        <Button
          size="small"
          startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => this.setState({ showDetails: !showDetails })}
          sx={{ mb: 1 }}
        >
          {showDetails ? labels.hideDetails : labels.showDetails}
        </Button>

        <Collapse in={showDetails} sx={{ width: '100%', maxWidth: 700 }}>
          <Box
            component="pre"
            sx={{
              textAlign: 'left',
              fontSize: 12,
              fontFamily: 'monospace',
              bgcolor: 'grey.100',
              color: 'grey.900',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 300,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error?.stack || error?.message || 'Unknown error'}
            {errorInfo && `\n\nComponent Stack:${errorInfo}`}
          </Box>
        </Collapse>
      </Box>
    );
  }
}
