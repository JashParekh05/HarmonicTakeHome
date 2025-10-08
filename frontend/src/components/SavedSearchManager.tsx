import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Save as SaveIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: any;
  sort_by?: string;
  sort_order?: string;
  is_public: boolean;
  shareable_link?: string;
  match_count?: number;
}

interface SavedSearchManagerProps {
  open: boolean;
  onClose: () => void;
  currentFilters: any;
  onApplySearch: (search: SavedSearch) => void;
}

const SavedSearchManager: React.FC<SavedSearchManagerProps> = ({
  open,
  onClose,
  currentFilters,
  onApplySearch
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSearch, setNewSearch] = useState({
    name: '',
    description: '',
    is_public: false
  });

  useEffect(() => {
    if (open) {
      fetchSavedSearches();
    }
  }, [open]);

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('http://localhost:8000/saved-searches/');
      const data = await response.json();
      setSavedSearches(data.searches);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    }
  };

  const createSavedSearch = async () => {
    try {
      const response = await fetch('http://localhost:8000/saved-searches/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSearch,
          filters: currentFilters
        })
      });
      
      if (response.ok) {
        await fetchSavedSearches();
        setShowCreate(false);
        setNewSearch({ name: '', description: '', is_public: false });
      }
    } catch (error) {
      console.error('Error creating saved search:', error);
    }
  };

  const deleteSavedSearch = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/saved-searches/${id}`, {
        method: 'DELETE'
      });
      await fetchSavedSearches();
    } catch (error) {
      console.error('Error deleting saved search:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SearchIcon />
          <Typography variant="h6">Saved Searches</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!showCreate ? (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Your Saved Searches</Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => setShowCreate(true)}
              >
                Save Current Search
              </Button>
            </Box>
            
            <List>
              {savedSearches.map((search) => (
                <ListItem key={search.id} divider>
                  <ListItemText
                    primary={search.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {search.description}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip 
                            label={`${search.match_count || 0} matches`} 
                            size="small" 
                            color="primary" 
                          />
                          {search.is_public && (
                            <Chip 
                              label="Public" 
                              size="small" 
                              color="success" 
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => onApplySearch(search)}
                        title="Apply Search"
                      >
                        <SearchIcon />
                      </IconButton>
                      {search.shareable_link && (
                        <IconButton
                          size="small"
                          onClick={() => navigator.clipboard.writeText(
                            `${window.location.origin}/search/${search.shareable_link}`
                          )}
                          title="Copy Share Link"
                        >
                          <ShareIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => deleteSavedSearch(search.id)}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              Save Current Search
            </Typography>
            <TextField
              fullWidth
              label="Search Name"
              value={newSearch.name}
              onChange={(e) => setNewSearch({...newSearch, name: e.target.value})}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description (optional)"
              value={newSearch.description}
              onChange={(e) => setNewSearch({...newSearch, description: e.target.value})}
              margin="normal"
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newSearch.is_public}
                  onChange={(e) => setNewSearch({...newSearch, is_public: e.target.checked})}
                />
              }
              label="Make this search public"
            />
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Current Filters:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {Object.entries(currentFilters).map(([key, value]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {showCreate ? (
          <>
            <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={createSavedSearch}
              disabled={!newSearch.name}
            >
              Save Search
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SavedSearchManager;
