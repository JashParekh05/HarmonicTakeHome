# app/database.py
import os
import uuid
from datetime import datetime
from typing import Union

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv('DATABASE_URL')

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# SQLAlchemy models
Base = declarative_base()

class Settings(Base):
    __tablename__ = "harmonic_settings"

    setting_name = Column(String, primary_key=True)

class Company(Base):
    __tablename__ = "companies"

    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True)

class CompanyCollection(Base):
    __tablename__ = "company_collections"

    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    id: Column[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_name = Column(String, index=True)

class CompanyCollectionAssociation(Base):
    __tablename__ = "company_collection_associations"

    __table_args__ = (
        UniqueConstraint('company_id', 'collection_id', name='uq_company_collection'),
    )
    
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    collection_id = Column(UUID(as_uuid=True), ForeignKey("company_collections.id"))


class Job(Base):
    __tablename__ = "jobs"
    
    id: Column[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    state = Column(String, nullable=False)  # 'queued', 'running', 'completed', 'failed'
    done = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False, onupdate=datetime.utcnow
    )
    params = Column(String)  # JSON string for job parameters
    idempotency_key = Column(String, unique=True, nullable=True)
    error_message = Column(String, nullable=True)


class Event(Base):
    __tablename__ = "events"
    
    id: Column[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False)  # 'add_companies', 'remove_companies'
    dest_collection_id = Column(UUID(as_uuid=True), ForeignKey("company_collections.id"))
    source_collection_id = Column(UUID(as_uuid=True), ForeignKey("company_collections.id"), nullable=True)
    company_ids = Column(String)  # JSON array of company IDs
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )


class SavedSearch(Base):
    __tablename__ = "saved_searches"
    
    id: Column[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    filters = Column(String, nullable=False)  # JSON filter criteria
    sort_by = Column(String, nullable=True)
    sort_order = Column(String, nullable=True)  # 'asc', 'desc'
    created_by = Column(String, nullable=True)  # user identifier
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False, onupdate=datetime.utcnow
    )
    is_public = Column(String, nullable=False, default='false')  # 'true', 'false'
    shareable_link = Column(String, nullable=True, unique=True)


class ActivityFeed(Base):
    __tablename__ = "activity_feed"
    
    id: Column[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    event_type = Column(String, nullable=False)  # 'bulk_add', 'bulk_remove', 'undo', 'cancel'
    actor = Column(String, nullable=True)  # user identifier
    description = Column(String, nullable=False)
    metadata = Column(String, nullable=True)  # JSON with additional context
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )


class SLOMetrics(Base):
    __tablename__ = "slo_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)  # 'bulk_add_selected', 'bulk_add_all'
    record_count = Column(Integer, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    chunk_size = Column(Integer, nullable=False)
    throughput_per_second = Column(Integer, nullable=False)
    created_at: Union[datetime, Column[datetime]] = Column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )

