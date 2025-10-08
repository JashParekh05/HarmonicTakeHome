import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Divider,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Timeline as ActivityIcon,
  Add as AddIcon,
  Undo as UndoIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

interface ActivityItem {
  id: string;
  job_id?: string;
  event_type: string;
  actor?: string;
  description: string;
  metadata?: any;
  created_at: string;
}

interface ActivityFeedProps {
  open: boolean;
  onClose: () => void;
  collectionId?: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  open,
  onClose,
  collectionId
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSlackSetup, setShowSlackSetup] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');

  useEffect(() => {
    if (open) {
      fetchActivities();
    }
  }, [open, collectionId]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const url = collectionId 
        ? `http://localhost:8000/activity/?limit=50`
        : `http://localhost:8000/activity/?limit=50`;
      const response = await fetch(url);
      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSlackWebhook = async () => {
    try {
      await fetch('http://localhost:8000/activity/slack-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: slackWebhook,
          job_id: 'all'
        })
      });
      setShowSlackSetup(false);
      setSlackWebhook('');
    } catch (error) {
      console.error('Error setting up Slack webhook:', error);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'bulk_add':
        return <AddIcon color="primary" />;
      case 'undo':
        return <UndoIcon color="warning" />;
      case 'cancel':
        return <CancelIcon color="error" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <ActivityIcon />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'bulk_add':
        return 'primary';
      case 'undo':
        return 'warning';
      case 'cancel':
        return 'error';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{ width: 400 }}
      >
        <Box sx={{ width: 400, p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Activity Feed</Typography>
            <Box>
              <IconButton
                size="small"
                onClick={() => setShowSlackSetup(true)}
                title="Setup Slack Notifications"
              >
                <SettingsIcon />
              </IconButton>
              <Button
                size="small"
                onClick={fetchActivities}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <List>
            {activities.map((activity) => (
              <ListItem key={activity.id} divider>
                <ListItemIcon>
                  {getEventIcon(activity.event_type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {activity.description}
                      </Typography>
                      <Chip
                        label={activity.event_type}
                        size="small"
                        color={getEventColor(activity.event_type) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(activity.created_at)}
                      </Typography>
                      {activity.metadata && (
                        <Box mt={1}>
                          {activity.metadata.throughput && (
                            <Chip
                              label={`${activity.metadata.throughput} companies/sec`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {activity.metadata.duration && (
                            <Chip
                              label={`${activity.metadata.duration}s`}
                              size="small"
                              variant="outlined"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
          
          {activities.length === 0 && !loading && (
            <Box textAlign="center" py={4}>
              <ActivityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">
                No activity yet
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>

      <Dialog open={showSlackSetup} onClose={() => setShowSlackSetup(false)}>
        <DialogTitle>Setup Slack Notifications</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Slack Webhook URL"
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            margin="normal"
            placeholder="https://hooks.slack.com/services/..."
            helperText="Get this from your Slack workspace settings"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSlackSetup(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={setupSlackWebhook}
            disabled={!slackWebhook}
          >
            Setup
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ActivityFeed;
