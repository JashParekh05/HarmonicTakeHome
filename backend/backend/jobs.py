# backend/jobs.py
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db import database


class JobManager:
    """Advanced job management with progress tracking and SSE support"""
    
    def __init__(self):
        self._subscribers: Dict[str, asyncio.Queue] = {}
    
    def push_progress(self, job_id: str, payload: dict):
        """Push progress update to SSE subscribers"""
        queue = self._subscribers.get(job_id)
        if queue:
            queue.put_nowait(payload)
    
    async def create_job(self, db: Session, name: str, params: dict, idempotency_key: str = None) -> str:
        """Create a new job with idempotency support"""
        if idempotency_key:
            existing_job = db.query(database.Job).filter(
                database.Job.idempotency_key == idempotency_key
            ).first()
            if existing_job:
                return str(existing_job.id)
        
        job = database.Job(
            name=name,
            state='queued',
            params=json.dumps(params),
            idempotency_key=idempotency_key
        )
        db.add(job)
        db.commit()
        return str(job.id)
    
    async def update_job_progress(self, db: Session, job_id: str, done: int, total: int, state: str = 'running'):
        """Update job progress and push to subscribers"""
        job = db.query(database.Job).get(job_id)
        if job:
            job.done = done
            job.total = total
            job.state = state
            job.updated_at = datetime.utcnow()
            db.commit()
            
            # Push progress to SSE subscribers
            self.push_progress(job_id, {
                "done": done,
                "total": total,
                "state": state,
                "progress": (done / total * 100) if total > 0 else 0
            })
    
    async def complete_job(self, db: Session, job_id: str, success: bool = True, error_message: str = None):
        """Mark job as completed or failed"""
        job = db.query(database.Job).get(job_id)
        if job:
            job.state = 'completed' if success else 'failed'
            job.error_message = error_message
            job.updated_at = datetime.utcnow()
            db.commit()
            
            # Push final update
            self.push_progress(job_id, {
                "done": job.done,
                "total": job.total,
                "state": job.state,
                "progress": 100 if success else 0,
                "error": error_message
            })
    
    async def cancel_job(self, db: Session, job_id: str):
        """Cancel a running job"""
        job = db.query(database.Job).get(job_id)
        if job and job.state in ['queued', 'running']:
            job.state = 'cancelled'
            job.updated_at = datetime.utcnow()
            db.commit()
            
            # Push cancellation update
            self.push_progress(job_id, {
                "done": job.done,
                "total": job.total,
                "state": "cancelled",
                "progress": (job.done / job.total * 100) if job.total > 0 else 0
            })
            return True
        return False
    
    async def get_optimal_chunk_size(self, db: Session, operation_type: str, record_count: int) -> int:
        """Get optimal chunk size based on SLO metrics"""
        try:
            # Get recent performance data
            sql = text("""
                SELECT chunk_size, AVG(throughput_per_second) as avg_throughput
                FROM slo_metrics 
                WHERE operation_type = :op_type 
                AND record_count BETWEEN :count * 0.8 AND :count * 1.2
                AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY chunk_size
                ORDER BY avg_throughput DESC
                LIMIT 1
            """)
            result = db.execute(sql, {"op_type": operation_type, "count": record_count}).first()
            
            if result and result.avg_throughput > 0:
                return result.chunk_size
            else:
                # Default chunk sizes based on operation type
                if operation_type == "bulk_add_all":
                    return 10000  # Large for set-based operations
                else:
                    return 2000   # Smaller for individual inserts
        except Exception:
            return 2000  # Fallback
    
    async def add_all_companies_set_based(self, db: Session, job_id: str, dest_id: str, source_id: str) -> int:
        """Set-based SQL for Select All - much faster than individual inserts"""
        try:
            # Update job to running
            await self.update_job_progress(db, job_id, 0, 1, 'running')
            
            # Single SQL statement to move all companies
            sql = text("""
                INSERT INTO company_collection_associations (collection_id, company_id, created_at)
                SELECT :dest, cc.company_id, NOW()
                FROM company_collection_associations cc
                WHERE cc.collection_id = :src
                ON CONFLICT (company_id, collection_id) DO NOTHING
            """)
            
            result = db.execute(sql, {"dest": dest_id, "src": source_id})
            db.commit()
            
            # Get count of affected rows (approximate)
            count_sql = text("""
                SELECT COUNT(*) FROM company_collection_associations 
                WHERE collection_id = :dest
            """)
            total_count = db.execute(count_sql, {"dest": dest_id}).scalar()
            
            await self.update_job_progress(db, job_id, total_count, total_count, 'running')
            await self.complete_job(db, job_id, True)
            
            return total_count
            
        except Exception as e:
            await self.complete_job(db, job_id, False, str(e))
            raise
    
    async def add_selected_companies_chunked(self, db: Session, job_id: str, dest_id: str, company_ids: List[int]) -> int:
        """Chunked insert for selected companies with progress tracking"""
        try:
            CHUNK_SIZE = 1000  # Optimized chunk size
            total_ids = len(company_ids)
            inserted = 0
            
            await self.update_job_progress(db, job_id, 0, total_ids, 'running')
            
            for i in range(0, total_ids, CHUNK_SIZE):
                chunk = company_ids[i:i + CHUNK_SIZE]
                
                # Use unnest for efficient batch insert
                sql = text("""
                    INSERT INTO company_collection_associations (collection_id, company_id, created_at)
                    SELECT :dest, x, NOW()
                    FROM unnest(:ids::int[]) AS t(x)
                    ON CONFLICT (company_id, collection_id) DO NOTHING
                """)
                
                db.execute(sql, {"dest": dest_id, "ids": chunk})
                db.commit()
                
                inserted += len(chunk)
                await self.update_job_progress(db, job_id, inserted, total_ids, 'running')
                
                # Small delay to respect throttling simulation
                await asyncio.sleep(0.1)
            
            await self.complete_job(db, job_id, True)
            return inserted
            
        except Exception as e:
            await self.complete_job(db, job_id, False, str(e))
            raise
    
    async def create_event(self, db: Session, event_type: str, dest_collection_id: str, 
                         source_collection_id: str, company_ids: List[int]):
        """Create an event record for undo functionality"""
        event = database.Event(
            type=event_type,
            dest_collection_id=dest_collection_id,
            source_collection_id=source_collection_id,
            company_ids=json.dumps(company_ids)
        )
        db.add(event)
        db.commit()
        return str(event.id)
    
    async def undo_last_operation(self, db: Session, dest_collection_id: str) -> bool:
        """Undo the last bulk operation"""
        try:
            # Get the most recent event for this collection
            event = db.query(database.Event).filter(
                database.Event.dest_collection_id == dest_collection_id
            ).order_by(database.Event.created_at.desc()).first()
            
            if not event:
                return False
            
            company_ids = json.loads(event.company_ids)
            
            # Remove the associations
            delete_sql = text("""
                DELETE FROM company_collection_associations 
                WHERE collection_id = :dest AND company_id = ANY(:ids)
            """)
            db.execute(delete_sql, {"dest": dest_collection_id, "ids": company_ids})
            db.commit()
            
            return True
            
        except Exception as e:
            print(f"Undo failed: {e}")
            return False


# Global job manager instance
job_manager = JobManager()
