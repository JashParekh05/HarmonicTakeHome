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
  IMoveCompaniesResponse
} from "../utils/jam-api";

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
          variant="outlined"
          color="secondary"
          size="small"
          disabled={!targetCollectionId}
          onClick={() => setMoveAllDialog(true)}
        >
          Move All ({total || 0})
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
    </Box>
  );
};

export default CompanyTable;
