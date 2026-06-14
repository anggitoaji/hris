from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import Base, get_db
from app.auth import get_current_user


# ─── Models ──────────────────────────────────────────────────────────────────

class OrgNode(Base):
    __tablename__ = "org_nodes"
    id            = Column(Integer, primary_key=True, index=True)
    division_key  = Column(String(50),  nullable=False, index=True)
    title         = Column(String(200), default="")
    employee_name = Column(String(200), default="")
    department    = Column(String(200), default="")
    color         = Column(String(20),  default="#ffffff")
    text_color    = Column(String(20),  default="#1e293b")
    x             = Column(Float, default=100.0)
    y             = Column(Float, default=100.0)
    width         = Column(Float, default=180.0)
    height        = Column(Float, default=80.0)
    notes         = Column(Text,  default="")
    text_align    = Column(String(10), default="center")  # left | center | right
    title_color   = Column(String(20), default="")        # kosong = ikut text_color
    name_color    = Column(String(20), default="")        # kosong = ikut text_color
    updated_at    = Column(DateTime, default=datetime.utcnow)


class OrgEdge(Base):
    __tablename__ = "org_edges"
    id           = Column(Integer, primary_key=True, index=True)
    division_key = Column(String(50), nullable=False, index=True)
    source_id    = Column(String(50), nullable=False)
    target_id    = Column(String(50), nullable=False)
    line_type    = Column(String(20), default="solid")   # solid | dashed
    arrow_end    = Column(String(20), default="arrow")   # arrow | none
    edge_type    = Column(String(20), default="reporting")  # reporting | reference | connection
    routing_type = Column(String(20), default="smoothstep")  # smoothstep | straight
    label        = Column(String(200), default="")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class NodeCreate(BaseModel):
    division_key: str
    title: str = ""
    employee_name: str = ""
    department: str = ""
    color: str = "#ffffff"
    text_color: str = "#1e293b"
    x: float = 100.0
    y: float = 100.0
    width: float = 180.0
    height: float = 80.0
    notes: str = ""
    text_align: str = "center"
    title_color: str = ""
    name_color: str = ""

class NodeUpdate(BaseModel):
    title: Optional[str] = None
    employee_name: Optional[str] = None
    department: Optional[str] = None
    color: Optional[str] = None
    text_color: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    notes: Optional[str] = None
    text_align: Optional[str] = None
    title_color: Optional[str] = None
    name_color: Optional[str] = None

class NodeOut(BaseModel):
    id: int; division_key: str; title: str; employee_name: str
    department: str; color: str; text_color: str
    x: float; y: float; width: float; height: float
    notes: str; text_align: str; title_color: str; name_color: str
    updated_at: datetime
    class Config: from_attributes = True

class EdgeCreate(BaseModel):
    division_key: str; source_id: str; target_id: str
    line_type: str = "solid"; arrow_end: str = "arrow"
    edge_type: str = "reporting"; routing_type: str = "smoothstep"; label: str = ""

class EdgeUpdate(BaseModel):
    line_type: Optional[str] = None
    arrow_end: Optional[str] = None
    edge_type: Optional[str] = None
    routing_type: Optional[str] = None
    label: Optional[str] = None

class EdgeOut(BaseModel):
    id: int; division_key: str; source_id: str; target_id: str
    line_type: str; arrow_end: str; edge_type: str; routing_type: str; label: str
    class Config: from_attributes = True


# ─── Router ──────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/orgchart")

# --- Nodes ---
@router.get("/nodes/{division_key}", response_model=List[NodeOut])
def list_nodes(division_key: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(OrgNode).filter(OrgNode.division_key == division_key).all()

@router.post("/nodes", response_model=NodeOut)
def create_node(data: NodeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    n = OrgNode(**data.model_dump())
    db.add(n); db.commit(); db.refresh(n)
    return n

@router.patch("/nodes/{nid}", response_model=NodeOut)
def update_node(nid: int, data: NodeUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    n = db.query(OrgNode).filter(OrgNode.id == nid).first()
    if not n: raise HTTPException(404, "Node not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(n, k, v)
    n.updated_at = datetime.utcnow()
    db.commit(); db.refresh(n); return n

@router.delete("/nodes/{nid}")
def delete_node(nid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    n = db.query(OrgNode).filter(OrgNode.id == nid).first()
    if not n: raise HTTPException(404)
    db.query(OrgEdge).filter(
        (OrgEdge.source_id == str(nid)) | (OrgEdge.target_id == str(nid))
    ).delete(synchronize_session=False)
    db.delete(n); db.commit(); return {"ok": True}

# --- Edges ---
@router.get("/edges/{division_key}", response_model=List[EdgeOut])
def list_edges(division_key: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(OrgEdge).filter(OrgEdge.division_key == division_key).all()

@router.post("/edges", response_model=EdgeOut)
def create_edge(data: EdgeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = OrgEdge(**data.model_dump())
    db.add(e); db.commit(); db.refresh(e); return e

@router.patch("/edges/{eid}", response_model=EdgeOut)
def update_edge(eid: int, data: EdgeUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = db.query(OrgEdge).filter(OrgEdge.id == eid).first()
    if not e: raise HTTPException(404)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(e, k, v)
    db.commit(); db.refresh(e); return e

@router.delete("/edges/{eid}")
def delete_edge(eid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = db.query(OrgEdge).filter(OrgEdge.id == eid).first()
    if not e: raise HTTPException(404)
    db.delete(e); db.commit(); return {"ok": True}
