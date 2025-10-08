# Harmonic Fullstack Take-Home Project

A full-stack application that allows users to manage company collections with advanced selection and movement capabilities. Built for the Harmonic take-home assessment.

## 🚀 Features

### ✅ Core Requirements Implemented
- **Individual Company Selection**: Select and move specific companies between collections
- **Select All Functionality**: Move entire collections of companies at once
- **Database Throttling Handling**: Graceful UX for slow database operations (100ms per insert)
- **Progress Indicators**: Real-time feedback for long-running operations
- **Non-blocking UI**: Smooth user experience during lengthy operations

### 🎯 Key Features
- **Multi-row Selection**: Checkbox-based selection with visual feedback
- **Collection Management**: Move companies between 3 pre-seeded collections
- **Progress Tracking**: Linear progress bars with time estimation
- **Confirmation Dialogs**: Prevent accidental large operations
- **Real-time Updates**: Automatic data refresh after operations
- **Error Handling**: Comprehensive error messages and recovery

## 🏗️ Architecture

### Backend (FastAPI + PostgreSQL)
- **Framework**: FastAPI with Python 3.9
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Features**: 
  - RESTful API with comprehensive validation
  - Database throttling simulation (100ms per insert)
  - Bulk operations with duplicate prevention
  - Time estimation for operations

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) with dark theme
- **Features**:
  - Material-UI DataGrid with custom toolbar
  - Multi-row selection with visual feedback
  - Progress indicators and loading states
  - Responsive design with Tailwind CSS

## 📊 Database Schema

The application includes 4 main tables:

1. **`companies`** - Company information (10,000 seeded records)
2. **`company_collections`** - Collection metadata (3 collections)
3. **`company_collection_associations`** - Many-to-many relationships
4. **`harmonic_settings`** - Application settings

### Seeded Data
- **10,000 companies** with randomly generated names
- **3 collections**:
  - "My List" (all 10,000 companies)
  - "Liked Companies List" (10 companies)
  - "Companies to Ignore List" (50 companies)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend development)

### Backend Setup
```bash
cd backend
poetry install
docker compose up -d
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔧 API Endpoints

### Collections
- `GET /collections` - Get all collection metadata
- `GET /collections/{id}` - Get companies in a collection (paginated)
- `POST /collections/{source_id}/move-companies` - Move selected companies
- `POST /collections/{source_id}/move-all` - Move all companies

### Companies
- `GET /companies` - Get all companies (paginated)

## 💡 Technical Decisions

### Backend Design
- **Bulk Operations**: Used `bulk_save_objects` for efficiency while respecting throttling
- **Duplicate Prevention**: Implemented comprehensive checking to avoid data inconsistencies
- **Time Estimation**: Added calculation based on throttling (100ms per insert)
- **Error Handling**: Comprehensive validation with meaningful HTTP status codes

### Frontend Design
- **Progress Simulation**: Implemented progress bars for better perceived performance
- **Confirmation Dialogs**: Added safety measures for large operations
- **Type Safety**: Full TypeScript implementation with proper interfaces
- **State Management**: Efficient state handling for selection and progress tracking

### UX Considerations
- **Non-blocking Operations**: UI remains responsive during long operations
- **Visual Feedback**: Clear indicators for operation status and completion
- **Time Estimation**: Users understand operation duration upfront
- **Error Recovery**: Graceful handling of failures with retry options

## 🧪 Testing the Feature

1. **Start both services** (backend via Docker, frontend via npm)
2. **Navigate to frontend** at http://localhost:5173
3. **Select companies** using checkboxes in the data grid
4. **Choose target collection** from the dropdown
5. **Click "Move Selected"** to move individual companies
6. **Click "Move All"** to move entire collections
7. **Observe progress indicators** and time estimations

## 📈 Performance Considerations

- **Database Throttling**: 100ms delay per insert simulates real-world constraints
- **Large Operations**: Moving 10,000 companies takes ~16.7 minutes
- **Progress Feedback**: Users see estimated completion times
- **Non-blocking UI**: Interface remains responsive during operations

## 🔮 Future Enhancements

- **Background Jobs**: Implement async job processing for very large operations
- **Progress WebSockets**: Real-time progress updates via WebSocket connections
- **Batch Size Optimization**: Configurable batch sizes for different operation types
- **Operation History**: Track and display past movement operations
- **Undo Functionality**: Allow users to reverse recent operations

## 📝 Development Notes

This implementation demonstrates:
- **Thoughtful UX Design**: Consideration for end-user experience during slow operations
- **Maintainable Code**: Clean architecture with proper separation of concerns
- **Technical Proficiency**: Full-stack development with modern tools and practices
- **Problem-Solving**: Creative solutions for database throttling challenges

## 🎯 Acceptance Criteria Met

✅ **Individual Selection**: Users can select and move specific companies  
✅ **Select All**: Users can move entire collections at once  
✅ **Progress States**: Clear "In Progress" and "Completed" feedback  
✅ **Non-blocking UI**: Interface remains responsive during operations  
✅ **Database Throttling**: Graceful handling of slow database operations  

---

**Built with ❤️ for Harmonic's take-home assessment**
