import { 
  DataGrid, 
  GridRowSelectionModel, 
  GridColDef,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector
} from "@mui/x-data-grid";
import { 
  Button, 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from "@mui/material";
import { useEffect, useState } from "react";
import { 
  getCollectionsById, 
  ICompany, 
  ICollection,
  moveCompaniesToCollection,
  moveAllCompaniesToCollection,
  IMoveCompaniesResponse,
  addCompaniesToCollection,
  getJobStatus,
  cancelJob,
  undoLastOperation,
  dryRunAddOperation,
  IAddCompaniesRequest,
  IAddCompaniesResponse,
  IDryRunResponse
} from "../utils/jam-api";
import { useJobSSE, JobProgress } from "../utils/useJobSSE";
import ProgressBanner from "./ProgressBanner";
import SavedSearchManager from "./SavedSearchManager";
import ActivityFeed from "./ActivityFeed";

interface CompanyTableProps {
  selectedCollectionId: string;
  collections: ICollection[];
  onCollectionChange: () => void;
}

const CompanyTable = (props: CompanyTableProps) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>();
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [targetCollectionId, setTargetCollectionId] = useState<string>("");
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [moveResult, setMoveResult] = useState<IMoveCompaniesResponse | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState<boolean>(false);
  const [moveAllDialog, setMoveAllDialog] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // Advanced job management state
  const [currentJob, setCurrentJob] = useState<IAddCompaniesResponse | null>(null);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [showProgressBanner, setShowProgressBanner] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<IDryRunResponse | null>(null);
  const [showDryRunDialog, setShowDryRunDialog] = useState<boolean>(false);
  const [showSavedSearchManager, setShowSavedSearchManager] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<any>({});

  // Load collection data
  useEffect(() => {
    getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
      (newResponse) => {
        setResponse(newResponse.companies);
        setTotal(newResponse.total);
      }
    );
  }, [props.selectedCollectionId, offset, pageSize]);

  // Reset offset when collection changes
  useEffect(() => {
    setOffset(0);
    setSelectedRows([]);
    setMoveResult(null);
  }, [props.selectedCollectionId]);

  // SSE hook for real-time progress updates
  useJobSSE(currentJob?.job_id || null, (progress) => {
    setJobProgress(progress);
    if (progress.state === 'completed' || progress.state === 'failed') {
      // Refresh data when job completes
      getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
        (newResponse) => {
          setResponse(newResponse.companies);
          setTotal(newResponse.total);
        }
      );
      props.onCollectionChange();
    }
  });

  // Handle moving selected companies
  const handleMoveSelected = async () => {
    if (selectedRows.length === 0 || !targetCollectionId) return;

    setIsMoving(true);
    setProgress(0);
    setShowMoveDialog(true);

    try {
      const result = await moveCompaniesToCollection(props.selectedCollectionId, {
        company_ids: selectedRows.map(id => Number(id)),
        target_collection_id: targetCollectionId
      });

      setMoveResult(result);
      
      // Simulate progress for UX (since the actual operation is handled by the backend)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Complete progress when operation is done
      setTimeout(() => {
        setProgress(100);
        clearInterval(progressInterval);
        setIsMoving(false);
        // Refresh the data
        getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
          (newResponse) => {
            setResponse(newResponse.companies);
            setTotal(newResponse.total);
          }
        );
        props.onCollectionChange();
      }, 2000);

    } catch (error) {
      console.error('Error moving companies:', error);
      setMoveResult({
        success: false,
        message: 'Failed to move companies',
        companies_moved: 0,
        estimated_completion_time: '0 seconds'
      });
      setIsMoving(false);
    }
  };

  // Handle moving all companies
  const handleMoveAll = async () => {
    if (!targetCollectionId) return;

    setIsMoving(true);
    setProgress(0);
    setMoveAllDialog(true);

    try {
      const result = await moveAllCompaniesToCollection(
        props.selectedCollectionId,
        targetCollectionId
      );

      setMoveResult(result);
      
      // Simulate progress for large operations
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 2;
        });
      }, 200);

      // Complete progress when operation is done
      setTimeout(() => {
        setProgress(100);
        clearInterval(progressInterval);
        setIsMoving(false);
        // Refresh the data
        getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
          (newResponse) => {
            setResponse(newResponse.companies);
            setTotal(newResponse.total);
          }
        );
        props.onCollectionChange();
      }, 5000);

    } catch (error) {
      console.error('Error moving all companies:', error);
      setMoveResult({
        success: false,
        message: 'Failed to move all companies',
        companies_moved: 0,
        estimated_completion_time: '0 seconds'
      });
      setIsMoving(false);
    }
  };

  // Advanced job management functions
  const handleAdvancedMoveSelected = async () => {
    if (selectedRows.length === 0 || !targetCollectionId) return;

    try {
      const request: IAddCompaniesRequest = {
        select_all: false,
        company_ids: selectedRows.map(id => Number(id))
      };

      const result = await addCompaniesToCollection(targetCollectionId, request);
      setCurrentJob(result);
      setShowProgressBanner(true);
      setShowMoveDialog(false);

    } catch (error) {
      console.error('Error starting advanced move:', error);
    }
  };

  const handleAdvancedMoveAll = async () => {
    if (!targetCollectionId) return;

    try {
      const request: IAddCompaniesRequest = {
        select_all: true,
        source_collection_id: props.selectedCollectionId
      };

      // Run dry run first
      const dryRun = await dryRunAddOperation(targetCollectionId, request);
      setDryRunResult(dryRun);
      setShowDryRunDialog(true);

    } catch (error) {
      console.error('Error running dry run:', error);
    }
  };

  const handleConfirmAdvancedMoveAll = async () => {
    if (!targetCollectionId) return;

    try {
      const request: IAddCompaniesRequest = {
        select_all: true,
        source_collection_id: props.selectedCollectionId
      };

      const result = await addCompaniesToCollection(targetCollectionId, request);
      setCurrentJob(result);
      setShowProgressBanner(true);
      setShowDryRunDialog(false);
      setMoveAllDialog(false);

    } catch (error) {
      console.error('Error starting advanced move all:', error);
    }
  };

  const handleCancelJob = async () => {
    if (currentJob?.job_id) {
      try {
        await cancelJob(currentJob.job_id);
        setCurrentJob(null);
        setShowProgressBanner(false);
      } catch (error) {
        console.error('Error cancelling job:', error);
      }
    }
  };

  const handleUndoLastOperation = async () => {
    try {
      await undoLastOperation(targetCollectionId);
      // Refresh data
      getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
        (newResponse) => {
          setResponse(newResponse.companies);
          setTotal(newResponse.total);
        }
      );
      props.onCollectionChange();
    } catch (error) {
      console.error('Error undoing operation:', error);
    }
  };

  const columns: GridColDef[] = [
    { 
      field: "liked", 
      headerName: "Liked", 
      width: 90,
      renderCell: (params) => (
        <Chip 
          label={params.value ? "Yes" : "No"} 
          color={params.value ? "success" : "default"}
          size="small"
        />
      )
    },
    { field: "id", headerName: "ID", width: 90 },
    { field: "company_name", headerName: "Company Name", width: 200 },
  ];

  const CustomToolbar = () => (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {selectedRows.length} selected
        </Typography>
        
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Move to Collection</InputLabel>
          <Select
            value={targetCollectionId}
            onChange={(e) => setTargetCollectionId(e.target.value)}
            label="Move to Collection"
          >
            {props.collections
              .filter(col => col.id !== props.selectedCollectionId)
              .map((collection) => (
                <MenuItem key={collection.id} value={collection.id}>
                  {collection.collection_name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={selectedRows.length === 0 || !targetCollectionId}
          onClick={() => setShowMoveDialog(true)}
        >
          Move Selected ({selectedRows.length})
        </Button>
        
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={selectedRows.length === 0 || !targetCollectionId}
          onClick={handleAdvancedMoveSelected}
        >
          Advanced Move ({selectedRows.length})
        </Button>
        
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          disabled={!targetCollectionId}
          onClick={() => setMoveAllDialog(true)}
        >
          Move All ({total || 0})
        </Button>
        
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          disabled={!targetCollectionId}
          onClick={handleAdvancedMoveAll}
        >
          Advanced Move All ({total || 0})
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={() => setShowSavedSearchManager(true)}
        >
          Saved Searches
        </Button>
        <Button
          variant="outlined"
          color="info"
          size="small"
          onClick={() => setShowActivityFeed(true)}
        >
          Activity Feed
        </Button>
      </Box>
    </GridToolbarContainer>
  );

  return (
    <Box sx={{ height: 600, width: "100%" }}>
      <DataGrid
        rows={response}
        columns={columns}
        rowHeight={30}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25 },
          },
        }}
        rowCount={total}
        pagination
        checkboxSelection
        paginationMode="server"
        rowSelectionModel={selectedRows}
        onRowSelectionModelChange={setSelectedRows}
        onPaginationModelChange={(newMeta) => {
          setPageSize(newMeta.pageSize);
          setOffset(newMeta.page * newMeta.pageSize);
        }}
        slots={{
          toolbar: CustomToolbar,
        }}
        loading={isMoving}
      />

      {/* Move Selected Dialog */}
      <Dialog open={showMoveDialog} onClose={() => setShowMoveDialog(false)}>
        <DialogTitle>Move Selected Companies</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to move {selectedRows.length} companies to{' '}
            {props.collections.find(c => c.id === targetCollectionId)?.collection_name}?
          </Typography>
          {isMoving && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary">
                Moving companies... {progress}%
              </Typography>
            </Box>
          )}
          {moveResult && (
            <Alert 
              severity={moveResult.success ? "success" : "error"} 
              sx={{ mt: 2 }}
            >
              {moveResult.message}
              {moveResult.success && (
                <Typography variant="caption" display="block">
                  Estimated completion time: {moveResult.estimated_completion_time}
                </Typography>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMoveDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleMoveSelected} 
            variant="contained"
            disabled={isMoving}
          >
            {isMoving ? <CircularProgress size={20} /> : 'Move Companies'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move All Dialog */}
      <Dialog open={moveAllDialog} onClose={() => setMoveAllDialog(false)}>
        <DialogTitle>Move All Companies</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to move ALL {total} companies to{' '}
            {props.collections.find(c => c.id === targetCollectionId)?.collection_name}?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This operation may take a significant amount of time due to database throttling.
            For large collections (10,000+ companies), this could take 15+ minutes.
          </Alert>
          {isMoving && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary">
                Moving all companies... {progress}%
              </Typography>
            </Box>
          )}
          {moveResult && (
            <Alert 
              severity={moveResult.success ? "success" : "error"} 
              sx={{ mt: 2 }}
            >
              {moveResult.message}
              {moveResult.success && (
                <Typography variant="caption" display="block">
                  Estimated completion time: {moveResult.estimated_completion_time}
                </Typography>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveAllDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleMoveAll} 
            variant="contained"
            color="secondary"
            disabled={isMoving}
          >
            {isMoving ? <CircularProgress size={20} /> : 'Move All Companies'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dry Run Dialog */}
      <Dialog open={showDryRunDialog} onClose={() => setShowDryRunDialog(false)}>
        <DialogTitle>Dry Run Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This operation will add companies to{' '}
            {props.collections.find(c => c.id === targetCollectionId)?.collection_name}:
          </Typography>
          {dryRunResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" color="primary">
                {dryRunResult.estimated_new_companies.toLocaleString()} new companies
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dryRunResult.already_existing.toLocaleString()} already exist
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Estimated time: {dryRunResult.estimated_time}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDryRunDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmAdvancedMoveAll} 
            variant="contained"
            color="secondary"
          >
            Proceed with Move All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Progress Banner */}
      {currentJob && jobProgress && (
        <ProgressBanner
          jobId={currentJob.job_id}
          jobName={currentJob.message}
          progress={jobProgress.progress}
          done={jobProgress.done}
          total={jobProgress.total}
          state={jobProgress.state}
          estimatedTime={currentJob.estimated_time}
          throughput={jobProgress.done > 0 ? jobProgress.done / 10 : undefined}
          onCancel={handleCancelJob}
          onUndo={handleUndoLastOperation}
          isVisible={showProgressBanner}
          onClose={() => setShowProgressBanner(false)}
        />
      )}

      {/* Saved Search Manager */}
      <SavedSearchManager
        open={showSavedSearchManager}
        onClose={() => setShowSavedSearchManager(false)}
        currentFilters={currentFilters}
        onApplySearch={(search) => {
          // Apply the saved search filters
          setCurrentFilters(search.filters);
          setShowSavedSearchManager(false);
          // Refresh data with new filters
          props.onCollectionChange();
        }}
      />

      {/* Activity Feed */}
      <ActivityFeed
        open={showActivityFeed}
        onClose={() => setShowActivityFeed(false)}
        collectionId={props.selectedCollectionId}
      />
    </Box>
  );
};

export default CompanyTable;
