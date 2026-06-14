"""Migration v3: Add edge_type and routing_type columns"""
from sqlalchemy import text
from app.core.database import SessionLocal

def migrate():
    db = SessionLocal()
    try:
        # Check if columns exist before adding
        inspector_result = db.execute(
            text("PRAGMA table_info(org_edges)")
        ).fetchall()
        column_names = [col[1] for col in inspector_result]

        if "edge_type" not in column_names:
            db.execute(
                text("ALTER TABLE org_edges ADD COLUMN edge_type VARCHAR(20) DEFAULT 'reporting'")
            )
            print("[+] Added edge_type column")

        if "routing_type" not in column_names:
            db.execute(
                text("ALTER TABLE org_edges ADD COLUMN routing_type VARCHAR(20) DEFAULT 'smoothstep'")
            )
            print("[+] Added routing_type column")

        db.commit()
        print("[+] Migration v3 complete: org_edges enhanced with edge_type and routing_type")
    except Exception as e:
        print(f"[!] Migration error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
