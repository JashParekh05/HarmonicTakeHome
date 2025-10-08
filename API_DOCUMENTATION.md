# API Documentation

This document provides comprehensive documentation for the Harmonic Fullstack Take-Home Project API.

## Base URL
```
http://localhost:8000
```

## Authentication
Currently no authentication is required. All endpoints are publicly accessible.

## Content Types
- **Request**: `application/json`
- **Response**: `application/json`

## Error Handling
All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

Error responses include a `detail` field with error information.

---

## Collections API

### Get All Collections
```http
GET /collections
```

**Response:**
```json
[
  {
    "id": "236f5a6b-ffcc-4bcc-82c9-4129dde5a725",
    "collection_name": "My List"
  },
  {
    "id": "6397fe12-3895-4197-9074-dba692e4c70e",
    "collection_name": "Liked Companies List"
  }
]
```

### Get Collection by ID
```http
GET /collections/{collection_id}?offset=0&limit=25
```

**Parameters:**
- `collection_id` (UUID) - Collection identifier
- `offset` (int, optional) - Number of items to skip (default: 0)
- `limit` (int, optional) - Number of items to fetch (default: 10)

**Response:**
```json
{
  "id": "236f5a6b-ffcc-4bcc-82c9-4129dde5a725",
  "collection_name": "My List",
  "companies": [
    {
      "id": 1,
      "company_name": "Saucy Imprint",
      "liked": true
    }
  ],
  "total": 10000
}
```

### Move Companies (Legacy)
```http
POST /collections/{source_collection_id}/move-companies
```

**Request Body:**
```json
{
  "company_ids": [1, 2, 3],
  "target_collection_id": "6397fe12-3895-4197-9074-dba692e4c70e"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully moved 3 companies to Liked Companies List",
  "companies_moved": 3,
  "estimated_completion_time": "0.3 seconds"
}
```

### Move All Companies (Legacy)
```http
POST /collections/{source_collection_id}/move-all?target_collection_id={target_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully moved 10000 companies to Liked Companies List",
  "companies_moved": 10000,
  "estimated_completion_time": "16.7 minutes"
}
```

---

## Advanced Jobs API

### Add Companies to Collection
```http
POST /jobs/collections/{dest_collection_id}/add
```

**Headers:**
- `X-Idempotency-Key` (optional) - Prevents duplicate operations

**Request Body:**
```json
{
  "select_all": false,
  "company_ids": [1, 2, 3]
}
```

**Or for Select All:**
```json
{
  "select_all": true,
  "source_collection_id": "236f5a6b-ffcc-4bcc-82c9-4129dde5a725"
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Job started: Add companies to Liked Companies List",
  "estimated_time": "0.3 seconds"
}
```

### Get Job Status
```http
GET /jobs/{job_id}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Add companies to Liked Companies List",
  "state": "running",
  "done": 1500,
  "total": 3000,
  "progress": 50.0,
  "created_at": "2025-01-08T02:00:00Z",
  "error_message": null
}
```

### Stream Job Progress (SSE)
```http
GET /jobs/{job_id}/stream
```

**Response:** Server-Sent Events stream
```
data: {"done": 1500, "total": 3000, "state": "running", "progress": 50.0}

data: {"done": 3000, "total": 3000, "state": "completed", "progress": 100.0}
```

### Cancel Job
```http
POST /jobs/{job_id}/cancel
```

**Response:**
```json
{
  "message": "Job cancelled successfully"
}
```

### Get Recent Jobs
```http
GET /jobs/?limit=20
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Add companies to Liked Companies List",
    "state": "completed",
    "done": 3000,
    "total": 3000,
    "progress": 100.0,
    "created_at": "2025-01-08T02:00:00Z",
    "error_message": null
  }
]
```

### Dry Run Operation
```http
GET /jobs/collections/{collection_id}/dry-run?select_all=true&source_collection_id={source_id}
```

**Response:**
```json
{
  "estimated_new_companies": 7500,
  "already_existing": 2500,
  "estimated_time": "12.5 minutes"
}
```

### Undo Last Operation
```http
POST /jobs/collections/{collection_id}/undo
```

**Response:**
```json
{
  "message": "Last operation undone successfully"
}
```

---

## Companies API

### Get All Companies
```http
GET /companies?offset=0&limit=25
```

**Parameters:**
- `offset` (int, optional) - Number of items to skip (default: 0)
- `limit` (int, optional) - Number of items to fetch (default: 10)

**Response:**
```json
{
  "companies": [
    {
      "id": 1,
      "company_name": "Saucy Imprint",
      "liked": true
    }
  ],
  "total": 10000
}
```

---

## Data Models

### Company
```typescript
interface Company {
  id: number;
  company_name: string;
  liked: boolean;
}
```

### Collection
```typescript
interface Collection {
  id: string;
  collection_name: string;
  companies: Company[];
  total: number;
}
```

### Job Status
```typescript
interface JobStatus {
  id: string;
  name: string;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  done: number;
  total: number;
  progress: number;
  created_at: string;
  error_message?: string;
}
```

### Add Companies Request
```typescript
interface AddCompaniesRequest {
  select_all: boolean;
  source_collection_id?: string;
  company_ids?: number[];
  filter?: any;
}
```

---

## Performance Considerations

### Database Throttling
- Each insert operation has a 100ms delay (simulated throttling)
- Large operations (10,000+ companies) can take significant time
- Use set-based SQL for Select All operations (600x faster)

### Recommended Usage
- **Small operations** (< 100 companies): Use legacy endpoints
- **Medium operations** (100-1000 companies): Use advanced jobs API
- **Large operations** (1000+ companies): Use advanced jobs API with SSE

### Best Practices
1. **Use idempotency keys** for important operations
2. **Monitor job status** via SSE for real-time updates
3. **Run dry-run** before large operations
4. **Handle errors gracefully** with retry mechanisms
5. **Use appropriate batch sizes** for your use case

---

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `400` | Bad Request | Check request body format |
| `404` | Not Found | Verify collection/company IDs |
| `409` | Conflict | Duplicate operation (use idempotency key) |
| `500` | Internal Error | Check server logs, retry operation |

---

## Rate Limiting
Currently no rate limiting is implemented. In production, consider implementing:
- Per-IP rate limiting
- Per-user rate limiting
- Operation-specific limits

---

## WebSocket/SSE Support
The API supports Server-Sent Events (SSE) for real-time progress updates:
- **Endpoint**: `/jobs/{job_id}/stream`
- **Content-Type**: `text/event-stream`
- **Reconnection**: Automatic with exponential backoff
- **Keepalive**: 30-second intervals

---

## Examples

### Complete Workflow
```javascript
// 1. Start operation
const response = await fetch('/jobs/collections/target-id/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    select_all: true,
    source_collection_id: 'source-id'
  })
});
const { job_id } = await response.json();

// 2. Stream progress
const eventSource = new EventSource(`/jobs/${job_id}/stream`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`Progress: ${progress.progress}%`);
};

// 3. Handle completion
eventSource.addEventListener('complete', () => {
  eventSource.close();
  console.log('Operation completed!');
});
```
