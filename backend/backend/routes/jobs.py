# backend/routes/jobs.py
import asyncio
import json
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db import database
from backend.jobs import job_manager


router = APIRouter(
    prefix="/jobs",
    tags=["jobs"],
)


class JobStatus(BaseModel):
    id: str
    name: str
    state: str
    done: int
    total: int
    progress: float
    created_at: str
    error_message: Optional[str] = None


class AddCompaniesRequest(BaseModel):
    select_all: bool = False
    source_collection_id: Optional[str] = None
    company_ids: Optional[List[int]] = None
    filter: Optional[dict] = None


class AddCompaniesResponse(BaseModel):
    job_id: str
    message: str
    estimated_time: str


@router.get("/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str, db: Session = Depends(database.get_db)):
    """Get job status by ID"""
    job = db.query(database.Job).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatus(
        id=str(job.id),
        name=job.name,
        state=job.state,
        done=job.done,
        total=job.total,
        progress=(job.done / job.total * 100) if job.total > 0 else 0,
        created_at=job.created_at.isoformat(),
        error_message=job.error_message
    )


@router.get("/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """Server-Sent Events stream for job progress"""
    # Create a queue for this job
    queue = asyncio.Queue()
    job_manager._subscribers[job_id] = queue
    
    async def event_generator():
        try:
            while True:
                # Wait for progress updates
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(message)}\n\n"
                    
                    # If job is completed or failed, close the stream
                    if message.get("state") in ["completed", "failed"]:
                        break
                        
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # Clean up
            job_manager._subscribers.pop(job_id, None)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, db: Session = Depends(database.get_db)):
    """Cancel a running job"""
    job = db.query(database.Job).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.state not in ["queued", "running"]:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled")
    
    job.state = "cancelled"
    job.updated_at = database.datetime.utcnow()
    db.commit()
    
    return {"message": "Job cancelled successfully"}


@router.get("/", response_model=List[JobStatus])
def get_recent_jobs(limit: int = 20, db: Session = Depends(database.get_db)):
    """Get recent jobs for activity feed"""
    jobs = db.query(database.Job).order_by(database.Job.created_at.desc()).limit(limit).all()
    
    return [
        JobStatus(
            id=str(job.id),
            name=job.name,
            state=job.state,
            done=job.done,
            total=job.total,
            progress=(job.done / job.total * 100) if job.total > 0 else 0,
            created_at=job.created_at.isoformat(),
            error_message=job.error_message
        )
        for job in jobs
    ]


async def background_add_companies(
    db: Session, 
    job_id: str, 
    dest_collection_id: str, 
    request: AddCompaniesRequest
):
    """Background task for adding companies"""
    try:
        if request.select_all and request.source_collection_id:
            # Set-based SQL for Select All
            await job_manager.add_all_companies_set_based(
                db, job_id, dest_collection_id, request.source_collection_id
            )
        elif request.company_ids:
            # Chunked insert for selected companies
            await job_manager.add_selected_companies_chunked(
                db, job_id, dest_collection_id, request.company_ids
            )
        else:
            raise ValueError("Invalid request parameters")
            
    except Exception as e:
        await job_manager.complete_job(db, job_id, False, str(e))


@router.post("/collections/{dest_collection_id}/add", response_model=AddCompaniesResponse)
async def add_companies_to_collection(
    dest_collection_id: str,
    request: AddCompaniesRequest,
    background_tasks: BackgroundTasks,
    idempotency_key: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    """Add companies to a collection with advanced job management"""
    
    # Validate destination collection
    dest_collection = db.query(database.CompanyCollection).get(dest_collection_id)
    if not dest_collection:
        raise HTTPException(status_code=404, detail="Destination collection not found")
    
    # Create job
    job_name = f"Add companies to {dest_collection.collection_name}"
    job_id = await job_manager.create_job(db, job_name, request.dict(), idempotency_key)
    
    # Start background task
    background_tasks.add_task(
        background_add_companies,
        db, job_id, dest_collection_id, request
    )
    
    # Calculate estimated time
    if request.select_all:
        # Get total count from source collection
        source_count = db.query(database.CompanyCollectionAssociation).filter(
            database.CompanyCollectionAssociation.collection_id == request.source_collection_id
        ).count()
        estimated_seconds = source_count * 0.1  # 100ms per insert
    else:
        estimated_seconds = len(request.company_ids or []) * 0.1
    
    estimated_time = f"{estimated_seconds:.1f} seconds" if estimated_seconds < 60 else f"{estimated_seconds/60:.1f} minutes"
    
    return AddCompaniesResponse(
        job_id=job_id,
        message=f"Job started: {job_name}",
        estimated_time=estimated_time
    )


@router.post("/collections/{dest_collection_id}/undo")
async def undo_last_operation(dest_collection_id: str, db: Session = Depends(database.get_db)):
    """Undo the last bulk operation"""
    success = await job_manager.undo_last_operation(db, dest_collection_id)
    
    if success:
        return {"message": "Last operation undone successfully"}
    else:
        raise HTTPException(status_code=404, detail="No recent operation to undo")


@router.get("/collections/{collection_id}/dry-run")
async def dry_run_add_operation(
    collection_id: str,
    request: AddCompaniesRequest,
    db: Session = Depends(database.get_db)
):
    """Dry run to estimate the number of companies that would be added"""
    
    if request.select_all and request.source_collection_id:
        # Count companies in source collection
        total_count = db.query(database.CompanyCollectionAssociation).filter(
            database.CompanyCollectionAssociation.collection_id == request.source_collection_id
        ).count()
        
        # Count already existing in destination
        existing_count = db.query(database.CompanyCollectionAssociation).filter(
            database.CompanyCollectionAssociation.collection_id == collection_id,
            database.CompanyCollectionAssociation.company_id.in_(
                db.query(database.CompanyCollectionAssociation.company_id).filter(
                    database.CompanyCollectionAssociation.collection_id == request.source_collection_id
                )
            )
        ).count()
        
        new_count = total_count - existing_count
        
    elif request.company_ids:
        # Count how many of the selected companies are not already in destination
        existing_count = db.query(database.CompanyCollectionAssociation).filter(
            database.CompanyCollectionAssociation.collection_id == collection_id,
            database.CompanyCollectionAssociation.company_id.in_(request.company_ids)
        ).count()
        
        new_count = len(request.company_ids) - existing_count
        
    else:
        new_count = 0
    
    return {
        "estimated_new_companies": new_count,
        "already_existing": len(request.company_ids or []) - new_count if request.company_ids else 0,
        "estimated_time": f"{new_count * 0.1:.1f} seconds" if new_count < 600 else f"{new_count * 0.1 / 60:.1f} minutes"
    }
