# backend/tasks.py
import asyncio
import json
import time
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from celery.utils.log import get_task_logger
from celery_app import celery
from backend.db import database

log = get_task_logger(__name__)

async def _update_job(session: AsyncSession, job_id: UUID, **fields):
    """Update job with progress and state"""
    sets = ", ".join([f"{k} = :{k}" for k in fields.keys()])
    fields["job_id"] = str(job_id)
    fields["updated_at"] = datetime.utcnow()
    sql = text(f"UPDATE jobs SET {sets}, updated_at=:updated_at WHERE id = :job_id")
    await session.execute(sql, fields)

async def _set_job_state(session: AsyncSession, job_id: UUID, state: str):
    """Set job state"""
    await _update_job(session, job_id, state=state)

async def _add_activity_feed(session: AsyncSession, job_id: UUID, event_type: str, description: str, metadata: dict = None):
    """Add activity feed entry"""
    sql = text("""
        INSERT INTO activity_feed (job_id, event_type, actor, description, event_metadata)
        VALUES (:job_id, :event_type, :actor, :description, :event_metadata)
    """)
    await session.execute(sql, {
        "job_id": str(job_id),
        "event_type": event_type,
        "actor": "system",
        "description": description,
        "event_metadata": json.dumps(metadata) if metadata else None
    })

async def _record_slo_metrics(session: AsyncSession, operation_type: str, record_count: int, duration_seconds: int, chunk_size: int):
    """Record SLO metrics for auto-tuning"""
    throughput = record_count / duration_seconds if duration_seconds > 0 else 0
    sql = text("""
        INSERT INTO slo_metrics (operation_type, record_count, duration_seconds, chunk_size, throughput_per_second)
        VALUES (:operation_type, :record_count, :duration_seconds, :chunk_size, :throughput)
    """)
    await session.execute(sql, {
        "operation_type": operation_type,
        "record_count": record_count,
        "duration_seconds": duration_seconds,
        "chunk_size": chunk_size,
        "throughput": throughput
    })

@celery.task(name="bulk_add_selected", bind=True)
def bulk_add_selected(self, job_id: str, dest_id: int, company_ids: list[int]):
    """
    Durable worker for selected IDs with cancel support
    """
    async def run():
        start_time = time.time()
        async with database.async_session() as s:
            await _set_job_state(s, job_id, "running")
            await _add_activity_feed(s, job_id, "bulk_add", f"Started adding {len(company_ids)} companies")
            await s.commit()

        CHUNK = 2000
        done = 0
        total = len(company_ids)
        
        try:
            async with database.async_session() as s:
                for i in range(0, total, CHUNK):
                    # Check for cancellation
                    if self.is_aborted():
                        await _set_job_state(s, job_id, "cancelled")
                        await _add_activity_feed(s, job_id, "cancel", f"Cancelled at {done}/{total} companies")
                        await s.commit()
                        return
                    
                    chunk = company_ids[i:i+CHUNK]
                    sql = text("""
                      INSERT INTO company_collection_associations (collection_id, company_id, created_at)
                      SELECT :dest, x, NOW()
                      FROM unnest(:ids::int[]) AS t(x)
                      ON CONFLICT (company_id, collection_id) DO NOTHING
                    """)
                    await s.execute(sql, {"dest": dest_id, "ids": chunk})
                    done += len(chunk)
                    await _update_job(s, job_id, done=done, total=total)
                    await s.commit()
                    
                    # Update progress for SSE
                    self.update_state(
                        state='PROGRESS',
                        meta={'done': done, 'total': total, 'progress': (done/total)*100}
                    )
                    
                    # Small delay to respect throttling
                    await asyncio.sleep(0.1)
                
                # Record completion
                duration = time.time() - start_time
                await _set_job_state(s, job_id, "completed")
                await _add_activity_feed(s, job_id, "bulk_add", f"Completed adding {done} companies in {duration:.1f}s")
                await _record_slo_metrics(s, "bulk_add_selected", done, int(duration), CHUNK)
                await s.commit()
                
        except Exception as e:
            log.exception("bulk_add_selected failed")
            async with database.async_session() as s:
                await _set_job_state(s, job_id, "failed")
                await _add_activity_feed(s, job_id, "error", f"Failed: {str(e)}")
                await s.commit()
            raise e

    asyncio.run(run())

@celery.task(name="bulk_add_all", bind=True)
def bulk_add_all(self, job_id: str, dest_id: int, source_id: int):
    """
    Set-based INSERT..SELECT for 'Select All' with cancel support
    """
    async def run():
        start_time = time.time()
        async with database.async_session() as s:
            await _set_job_state(s, job_id, "running")
            await _add_activity_feed(s, job_id, "bulk_add", f"Started Select All from collection {source_id}")
            await s.commit()

        try:
            async with database.async_session() as s:
                # Check for cancellation before starting
                if self.is_aborted():
                    await _set_job_state(s, job_id, "cancelled")
                    await _add_activity_feed(s, job_id, "cancel", "Cancelled before execution")
                    await s.commit()
                    return

                # Get total count
                q = text("""
                    SELECT COUNT(*)::int AS cnt
                    FROM company_collection_associations
                    WHERE collection_id = :src
                """)
                total = (await s.execute(q, {"src": source_id})).scalar_one()
                await _update_job(s, job_id, total=total, done=0)
                await s.commit()

                # Single set-based insert
                sql = text("""
                    INSERT INTO company_collection_associations (collection_id, company_id, created_at)
                    SELECT :dest, cc.company_id, NOW()
                    FROM company_collection_associations cc
                    WHERE cc.collection_id = :src
                    ON CONFLICT (company_id, collection_id) DO NOTHING
                """)
                result = await s.execute(sql, {"dest": dest_id, "src": source_id})
                await _update_job(s, job_id, done=total)
                await _set_job_state(s, job_id, "completed")
                
                # Record metrics
                duration = time.time() - start_time
                await _add_activity_feed(s, job_id, "bulk_add", f"Completed Select All: {total} companies in {duration:.1f}s")
                await _record_slo_metrics(s, "bulk_add_all", total, int(duration), 10000)  # Large chunk for set-based
                await s.commit()
                
        except Exception as e:
            log.exception("bulk_add_all failed")
            async with database.async_session() as s:
                await _set_job_state(s, job_id, "failed")
                await _add_activity_feed(s, job_id, "error", f"Failed: {str(e)}")
                await s.commit()
            raise e

    asyncio.run(run())

@celery.task(name="send_slack_notification")
def send_slack_notification(webhook_url: str, message: str):
    """Send Slack notification for completed jobs"""
    try:
        import requests
        requests.post(webhook_url, json={"text": message}, timeout=10)
    except Exception as e:
        log.error(f"Slack notification failed: {e}")
