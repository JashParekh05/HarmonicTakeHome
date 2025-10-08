# backend/routes/activity.py
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, desc

from backend.db import database

router = APIRouter(
    prefix="/activity",
    tags=["activity"],
)

class ActivityItem(BaseModel):
    id: str
    job_id: Optional[str]
    event_type: str
    actor: Optional[str]
    description: str
    metadata: Optional[dict]
    created_at: str

class ActivityFeedResponse(BaseModel):
    activities: List[ActivityItem]
    total: int
    has_more: bool

class SlackWebhookRequest(BaseModel):
    webhook_url: str
    job_id: str

@router.get("/", response_model=ActivityFeedResponse)
def get_activity_feed(
    db: Session = Depends(database.get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None)
):
    """Get activity feed with optional filtering"""
    query = db.query(database.ActivityFeed)
    
    if event_type:
        query = query.filter(database.ActivityFeed.event_type == event_type)
    
    total = query.count()
    activities = query.order_by(desc(database.ActivityFeed.created_at)).offset(offset).limit(limit + 1).all()
    
    has_more = len(activities) > limit
    if has_more:
        activities = activities[:-1]
    
    activity_items = []
    for activity in activities:
        metadata = json.loads(activity.metadata) if activity.metadata else None
        activity_items.append(ActivityItem(
            id=str(activity.id),
            job_id=str(activity.job_id) if activity.job_id else None,
            event_type=activity.event_type,
            actor=activity.actor,
            description=activity.description,
            metadata=metadata,
            created_at=activity.created_at.isoformat()
        ))
    
    return ActivityFeedResponse(
        activities=activity_items,
        total=total,
        has_more=has_more
    )

@router.get("/job/{job_id}", response_model=List[ActivityItem])
def get_job_activity(
    job_id: str,
    db: Session = Depends(database.get_db)
):
    """Get activity for a specific job"""
    activities = db.query(database.ActivityFeed).filter(
        database.ActivityFeed.job_id == job_id
    ).order_by(desc(database.ActivityFeed.created_at)).all()
    
    activity_items = []
    for activity in activities:
        metadata = json.loads(activity.metadata) if activity.metadata else None
        activity_items.append(ActivityItem(
            id=str(activity.id),
            job_id=str(activity.job_id) if activity.job_id else None,
            event_type=activity.event_type,
            actor=activity.actor,
            description=activity.description,
            metadata=metadata,
            created_at=activity.created_at.isoformat()
        ))
    
    return activity_items

@router.post("/slack-webhook")
def setup_slack_webhook(
    request: SlackWebhookRequest,
    db: Session = Depends(database.get_db)
):
    """Setup Slack webhook for job notifications"""
    # In a real implementation, you'd store this in a settings table
    # For now, we'll just return success
    return {
        "message": "Slack webhook configured",
        "webhook_url": request.webhook_url,
        "job_id": request.job_id
    }

@router.get("/stats")
def get_activity_stats(
    db: Session = Depends(database.get_db),
    days: int = Query(7, ge=1, le=30)
):
    """Get activity statistics"""
    sql = text("""
        SELECT 
            event_type,
            COUNT(*) as count,
            DATE(created_at) as date
        FROM activity_feed 
        WHERE created_at > NOW() - INTERVAL ':days days'
        GROUP BY event_type, DATE(created_at)
        ORDER BY date DESC, count DESC
    """)
    
    result = db.execute(sql, {"days": days})
    stats = []
    
    for row in result:
        stats.append({
            "event_type": row.event_type,
            "count": row.count,
            "date": row.date.isoformat()
        })
    
    return {
        "period_days": days,
        "stats": stats
    }
