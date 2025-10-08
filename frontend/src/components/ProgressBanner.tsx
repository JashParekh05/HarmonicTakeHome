import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Button,
  Chip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Close as CloseIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Undo as UndoIcon
} from '@mui/icons-material';

interface ProgressBannerProps {
  jobId: string;
  jobName: string;
  progress: number;
  done: number;
  total: number;
  state: string;
  estimatedTime?: string;
  throughput?: number;
  onCancel?: () => void;
  onUndo?: () => void;
  isVisible: boolean;
  onClose: () => void;
}

const ProgressBanner: React.FC<ProgressBannerProps> = ({
  jobId,
  jobName,
  progress,
  done,
  total,
  state,
  estimatedTime,
  throughput,
  onCancel,
  onUndo,
  isVisible,
  onClose
}) => {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'running': return 'primary';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'running': return <PauseIcon />;
      case 'completed': return <PlayIcon />;
      case 'failed': return <CloseIcon />;
      default: return null;
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const formatThroughput = (throughput: number) => {
    if (throughput < 1000) return `${throughput}/s`;
    return `${(throughput / 1000).toFixed(1)}k/s`;
  };

  return (
    <Collapse in={isVisible}>
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 600,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          boxShadow: 3,
          p: 2,
          zIndex: 1000
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {jobName}
          </Typography>
          
          <Chip
            label={state}
            color={getStateColor(state) as any}
            size="small"
            icon={getStateIcon(state)}
          />
          
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {done.toLocaleString()} / {total.toLocaleString()} • {progress.toFixed(1)}%
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {throughput && (
              <Typography variant="caption" color="text.secondary">
                {formatThroughput(throughput)}
              </Typography>
            )}
            
            {estimatedTime && (
              <Typography variant="caption" color="text.secondary">
                ~{estimatedTime}
              </Typography>
            )}
          </Box>
        </Box>

        {state === 'running' && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {onCancel && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PauseIcon />}
                onClick={onCancel}
              >
                Pause
              </Button>
            )}
          </Box>
        )}

        {state === 'completed' && onUndo && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UndoIcon />}
              onClick={onUndo}
            >
              Undo
            </Button>
          </Box>
        )}
      </Box>
    </Collapse>
  );
};

export default ProgressBanner;
