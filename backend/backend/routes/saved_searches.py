# backend/routes/saved_searches.py
import uuid
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.db import database

router = APIRouter(
    prefix="/saved-searches",
    tags=["saved-searches"],
)

class SavedSearchCreate(BaseModel):
    name: str
    description: Optional[str] = None
    filters: dict
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"
    is_public: bool = False

class SavedSearchResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    filters: dict
    sort_by: Optional[str]
    sort_order: Optional[str]
    created_by: Optional[str]
    created_at: str
    updated_at: str
    is_public: bool
    shareable_link: Optional[str]
    match_count: Optional[int] = None

class SavedSearchListResponse(BaseModel):
    searches: List[SavedSearchResponse]
    total: int

@router.post("/", response_model=SavedSearchResponse)
def create_saved_search(
    search: SavedSearchCreate,
    db: Session = Depends(database.get_db),
    created_by: str = "user@example.com"  # In real app, get from auth
):
    """Create a new saved search"""
    # Generate shareable link if public
    shareable_link = None
    if search.is_public:
        shareable_link = f"search-{uuid.uuid4().hex[:8]}"
    
    saved_search = database.SavedSearch(
        name=search.name,
        description=search.description,
        filters=json.dumps(search.filters),
        sort_by=search.sort_by,
        sort_order=search.sort_order,
        created_by=created_by,
        is_public=str(search.is_public).lower(),
        shareable_link=shareable_link
    )
    
    db.add(saved_search)
    db.commit()
    db.refresh(saved_search)
    
    # Get match count
    match_count = _get_search_match_count(db, search.filters)
    
    return SavedSearchResponse(
        id=str(saved_search.id),
        name=saved_search.name,
        description=saved_search.description,
        filters=json.loads(saved_search.filters),
        sort_by=saved_search.sort_by,
        sort_order=saved_search.sort_order,
        created_by=saved_search.created_by,
        created_at=saved_search.created_at.isoformat(),
        updated_at=saved_search.updated_at.isoformat(),
        is_public=saved_search.is_public == 'true',
        shareable_link=saved_search.shareable_link,
        match_count=match_count
    )

@router.get("/", response_model=SavedSearchListResponse)
def list_saved_searches(
    db: Session = Depends(database.get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    public_only: bool = Query(False)
):
    """List saved searches with optional filtering"""
    query = db.query(database.SavedSearch)
    
    if public_only:
        query = query.filter(database.SavedSearch.is_public == 'true')
    
    total = query.count()
    searches = query.offset(offset).limit(limit).all()
    
    search_responses = []
    for search in searches:
        filters = json.loads(search.filters)
        match_count = _get_search_match_count(db, filters)
        
        search_responses.append(SavedSearchResponse(
            id=str(search.id),
            name=search.name,
            description=search.description,
            filters=filters,
            sort_by=search.sort_by,
            sort_order=search.sort_order,
            created_by=search.created_by,
            created_at=search.created_at.isoformat(),
            updated_at=search.updated_at.isoformat(),
            is_public=search.is_public == 'true',
            shareable_link=search.shareable_link,
            match_count=match_count
        ))
    
    return SavedSearchListResponse(
        searches=search_responses,
        total=total
    )

@router.get("/{search_id}", response_model=SavedSearchResponse)
def get_saved_search(
    search_id: str,
    db: Session = Depends(database.get_db)
):
    """Get a specific saved search"""
    search = db.query(database.SavedSearch).get(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    filters = json.loads(search.filters)
    match_count = _get_search_match_count(db, filters)
    
    return SavedSearchResponse(
        id=str(search.id),
        name=search.name,
        description=search.description,
        filters=filters,
        sort_by=search.sort_by,
        sort_order=search.sort_order,
        created_by=search.created_by,
        created_at=search.created_at.isoformat(),
        updated_at=search.updated_at.isoformat(),
        is_public=search.is_public == 'true',
        shareable_link=search.shareable_link,
        match_count=match_count
    )

@router.get("/link/{shareable_link}", response_model=SavedSearchResponse)
def get_saved_search_by_link(
    shareable_link: str,
    db: Session = Depends(database.get_db)
):
    """Get a saved search by shareable link"""
    search = db.query(database.SavedSearch).filter(
        database.SavedSearch.shareable_link == shareable_link
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    filters = json.loads(search.filters)
    match_count = _get_search_match_count(db, filters)
    
    return SavedSearchResponse(
        id=str(search.id),
        name=search.name,
        description=search.description,
        filters=filters,
        sort_by=search.sort_by,
        sort_order=search.sort_order,
        created_by=search.created_by,
        created_at=search.created_at.isoformat(),
        updated_at=search.updated_at.isoformat(),
        is_public=search.is_public == 'true',
        shareable_link=search.shareable_link,
        match_count=match_count
    )

@router.post("/{search_id}/select-all")
def select_all_from_search(
    search_id: str,
    target_collection_id: str,
    db: Session = Depends(database.get_db)
):
    """Select all companies matching a saved search"""
    search = db.query(database.SavedSearch).get(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    filters = json.loads(search.filters)
    
    # Build WHERE clause from filters
    where_conditions = []
    params = {}
    
    if filters.get('liked') is not None:
        if filters['liked']:
            where_conditions.append("c.id IN (SELECT company_id FROM company_collection_associations cca JOIN company_collections cc ON cca.collection_id = cc.id WHERE cc.collection_name = 'Liked Companies List')")
        else:
            where_conditions.append("c.id NOT IN (SELECT company_id FROM company_collection_associations cca JOIN company_collections cc ON cca.collection_id = cc.id WHERE cc.collection_name = 'Liked Companies List')")
    
    if filters.get('company_name'):
        where_conditions.append("c.company_name ILIKE :name_filter")
        params['name_filter'] = f"%{filters['company_name']}%"
    
    where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
    
    # Get matching company IDs
    sql = text(f"""
        SELECT c.id FROM companies c
        WHERE {where_clause}
        ORDER BY c.{search.sort_by or 'id'} {search.sort_order or 'asc'}
    """)
    
    result = db.execute(sql, params)
    company_ids = [row[0] for row in result.fetchall()]
    
    return {
        "search_id": search_id,
        "search_name": search.name,
        "target_collection_id": target_collection_id,
        "matching_companies": len(company_ids),
        "company_ids": company_ids[:1000],  # Limit for safety
        "message": f"Found {len(company_ids)} companies matching '{search.name}'"
    }

def _get_search_match_count(db: Session, filters: dict) -> int:
    """Get count of companies matching the search filters"""
    where_conditions = []
    params = {}
    
    if filters.get('liked') is not None:
        if filters['liked']:
            where_conditions.append("c.id IN (SELECT company_id FROM company_collection_associations cca JOIN company_collections cc ON cca.collection_id = cc.id WHERE cc.collection_name = 'Liked Companies List')")
        else:
            where_conditions.append("c.id NOT IN (SELECT company_id FROM company_collection_associations cca JOIN company_collections cc ON cca.collection_id = cc.id WHERE cc.collection_name = 'Liked Companies List')")
    
    if filters.get('company_name'):
        where_conditions.append("c.company_name ILIKE :name_filter")
        params['name_filter'] = f"%{filters['company_name']}%"
    
    where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
    
    sql = text(f"SELECT COUNT(*) FROM companies c WHERE {where_clause}")
    result = db.execute(sql, params)
    return result.scalar()
