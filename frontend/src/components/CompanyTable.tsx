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
  CircularProgress
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
  const [total, setTotal] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [offset, setOffset] = useState<number>(0);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const columns: GridColDef[] = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "name", headerName: "Company Name", width: 200 },
    { field: "industry", headerName: "Industry", width: 150 },
    { field: "liked", headerName: "Liked", width: 100, type: "boolean" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getCollectionsById(props.selectedCollectionId, pageSize, offset);
        setResponse(data.companies);
        setTotal(data.total);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
      }
    };
    fetchData();
  }, [props.selectedCollectionId, pageSize, offset]);

  const handleMoveSelected = async () => {
    if (selectedRows.length === 0 || !targetCollectionId) return;
    
    setIsMoving(true);
    setError(null);
    
    try {
      const result: IMoveCompaniesResponse = await moveCompaniesToCollection(
        props.selectedCollectionId,
        targetCollectionId,
        selectedRows as number[]
      );
      
      if (result.success) {
        setSelectedRows([]);
        setTargetCollectionId("");
        // Refresh data
        const data = await getCollectionsById(props.selectedCollectionId, pageSize, offset);
        setResponse(data.companies);
        setTotal(data.total);
        props.onCollectionChange();
      } else {
        setError(result.message || "Failed to move companies");
      }
    } catch (err) {
      console.error("Error moving companies:", err);
      setError("Failed to move companies");
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveAll = async () => {
    if (!targetCollectionId) return;
    
    setIsMoving(true);
    setError(null);
    
    try {
      const result: IMoveCompaniesResponse = await moveAllCompaniesToCollection(
        props.selectedCollectionId,
        targetCollectionId
      );
      
      if (result.success) {
        setTargetCollectionId("");
        // Refresh data
        const data = await getCollectionsById(props.selectedCollectionId, pageSize, offset);
        setResponse(data.companies);
        setTotal(data.total);
        props.onCollectionChange();
      } else {
        setError(result.message || "Failed to move all companies");
      }
    } catch (err) {
      console.error("Error moving all companies:", err);
      setError("Failed to move all companies");
    } finally {
      setIsMoving(false);
    }
  };

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
            value={targetCollectionId || ""}
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
          disabled={selectedRows.length === 0 || !targetCollectionId || isMoving}
          onClick={handleMoveSelected}
        >
          Move Selected ({selectedRows.length})
        </Button>
        
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          disabled={!targetCollectionId || isMoving}
          onClick={handleMoveAll}
        >
          Move All
        </Button>
      </Box>
    </GridToolbarContainer>
  );

  return (
    <Box sx={{ height: 600, width: "100%", minWidth: 0 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <DataGrid
        rows={response}
        columns={columns}
        rowHeight={30}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25 },
          },
        }}
        rowCount={total || 0}
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
    </Box>
  );
};

export default CompanyTable;