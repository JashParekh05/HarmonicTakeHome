import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


class MoveCompaniesRequest(BaseModel):
    """Request model for moving companies between collections"""
    company_ids: List[int]
    target_collection_id: uuid.UUID


class MoveCompaniesResponse(BaseModel):
    """Response model for company movement operations"""
    success: bool
    message: str
    companies_moved: int
    estimated_completion_time: str


@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .get(collection_id)
        .collection_name,
        companies=companies,
        total=total_count,
    )


@router.post("/{source_collection_id}/move-companies", response_model=MoveCompaniesResponse)
def move_companies_to_collection(
    source_collection_id: uuid.UUID,
    request: MoveCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    """
    Move companies from source collection to target collection.
    
    This endpoint handles the movement of companies between collections,
    with consideration for the database throttling (100ms per insert).
    The operation is designed to be non-blocking and provides progress feedback.
    """
    # Validate source collection exists
    source_collection = db.query(database.CompanyCollection).get(source_collection_id)
    if not source_collection:
        raise HTTPException(status_code=404, detail="Source collection not found")
    
    # Validate target collection exists
    target_collection = db.query(database.CompanyCollection).get(request.target_collection_id)
    if not target_collection:
        raise HTTPException(status_code=404, detail="Target collection not found")
    
    # Validate companies exist in source collection
    existing_associations = (
        db.query(database.CompanyCollectionAssociation)
        .filter(
            database.CompanyCollectionAssociation.collection_id == source_collection_id,
            database.CompanyCollectionAssociation.company_id.in_(request.company_ids)
        )
        .all()
    )
    
    existing_company_ids = {assoc.company_id for assoc in existing_associations}
    missing_company_ids = set(request.company_ids) - existing_company_ids
    
    if missing_company_ids:
        raise HTTPException(
            status_code=400, 
            detail=f"Companies {list(missing_company_ids)} not found in source collection"
        )
    
    # Check for existing associations in target collection to avoid duplicates
    existing_target_associations = (
        db.query(database.CompanyCollectionAssociation)
        .filter(
            database.CompanyCollectionAssociation.collection_id == request.target_collection_id,
            database.CompanyCollectionAssociation.company_id.in_(request.company_ids)
        )
        .all()
    )
    
    existing_target_company_ids = {assoc.company_id for assoc in existing_target_associations}
    new_company_ids = set(request.company_ids) - existing_target_company_ids
    
    if not new_company_ids:
        return MoveCompaniesResponse(
            success=True,
            message="All companies already exist in target collection",
            companies_moved=0,
            estimated_completion_time="0 seconds"
        )
    
    # Create new associations (this will trigger the throttling)
    new_associations = [
        database.CompanyCollectionAssociation(
            company_id=company_id,
            collection_id=request.target_collection_id
        )
        for company_id in new_company_ids
    ]
    
    # Add associations to database (throttling will apply here)
    db.bulk_save_objects(new_associations)
    db.commit()
    
    # Calculate estimated completion time based on throttling
    # Each insert has a 100ms delay, so total time = number_of_companies * 0.1 seconds
    estimated_seconds = len(new_company_ids) * 0.1
    
    return MoveCompaniesResponse(
        success=True,
        message=f"Successfully moved {len(new_company_ids)} companies to {target_collection.collection_name}",
        companies_moved=len(new_company_ids),
        estimated_completion_time=f"{estimated_seconds:.1f} seconds"
    )


@router.post("/{source_collection_id}/move-all", response_model=MoveCompaniesResponse)
def move_all_companies_to_collection(
    source_collection_id: uuid.UUID,
    target_collection_id: uuid.UUID,
    db: Session = Depends(database.get_db),
):
    """
    Move ALL companies from source collection to target collection.
    
    This endpoint handles moving all companies from one collection to another.
    Due to database throttling, this operation may take significant time
    for large collections (e.g., 10,000 companies = ~16.7 minutes).
    """
    # Validate source collection exists
    source_collection = db.query(database.CompanyCollection).get(source_collection_id)
    if not source_collection:
        raise HTTPException(status_code=404, detail="Source collection not found")
    
    # Validate target collection exists
    target_collection = db.query(database.CompanyCollection).get(target_collection_id)
    if not target_collection:
        raise HTTPException(status_code=404, detail="Target collection not found")
    
    # Get all company IDs from source collection
    source_associations = (
        db.query(database.CompanyCollectionAssociation)
        .filter(database.CompanyCollectionAssociation.collection_id == source_collection_id)
        .all()
    )
    
    if not source_associations:
        return MoveCompaniesResponse(
            success=True,
            message="Source collection is empty",
            companies_moved=0,
            estimated_completion_time="0 seconds"
        )
    
    source_company_ids = [assoc.company_id for assoc in source_associations]
    
    # Check for existing associations in target collection
    existing_target_associations = (
        db.query(database.CompanyCollectionAssociation)
        .filter(
            database.CompanyCollectionAssociation.collection_id == target_collection_id,
            database.CompanyCollectionAssociation.company_id.in_(source_company_ids)
        )
        .all()
    )
    
    existing_target_company_ids = {assoc.company_id for assoc in existing_target_associations}
    new_company_ids = set(source_company_ids) - existing_target_company_ids
    
    if not new_company_ids:
        return MoveCompaniesResponse(
            success=True,
            message="All companies already exist in target collection",
            companies_moved=0,
            estimated_completion_time="0 seconds"
        )
    
    # Create new associations for all companies
    new_associations = [
        database.CompanyCollectionAssociation(
            company_id=company_id,
            collection_id=target_collection_id
        )
        for company_id in new_company_ids
    ]
    
    # Add associations to database (throttling will apply here)
    db.bulk_save_objects(new_associations)
    db.commit()
    
    # Calculate estimated completion time
    estimated_seconds = len(new_company_ids) * 0.1
    estimated_minutes = estimated_seconds / 60
    
    return MoveCompaniesResponse(
        success=True,
        message=f"Successfully moved {len(new_company_ids)} companies to {target_collection.collection_name}",
        companies_moved=len(new_company_ids),
        estimated_completion_time=f"{estimated_minutes:.1f} minutes" if estimated_minutes >= 1 else f"{estimated_seconds:.1f} seconds"
    )
