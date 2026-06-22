"""AI HR Engine — Fase 1 (rule-based) + Fase 2 (Ollama local LLM).

Fase 1: Promotion Readiness, Skill Gap Analysis, Review Summary, Succession.
Fase 2: AI Performance Review, Training Recommendation (via Ollama).
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles, User
from app.core.config import settings
from app.core.database import get_db

router = APIRouter(prefix="/ai", tags=["AI HR Engine"])

W_JABATAN = 0.70
W_COMPETENCY = 0.20
W_BEHAVIOR = 0.10


# ─────────────────────────── helpers ───────────────────────────

def _compute_kpi_scores(assessment_id: int, db: Session) -> tuple[float, float, float, float]:
    """Return (final_score, kpi_jabatan_score, competency_score, behavior_score)."""
    aspects = db.execute(
        text("SELECT score FROM kpi_aspect_scores WHERE assessment_id = :aid"),
        {"aid": assessment_id},
    ).fetchall()
    quals = db.execute(
        text("SELECT category, manager_score, hrd_score FROM kpi_qual_scores WHERE assessment_id = :aid"),
        {"aid": assessment_id},
    ).fetchall()

    jabatan_score = round(sum(r[0] for r in aspects) / len(aspects), 1) if aspects else 0.0
    comp_items = [(r[1] + r[2]) / 2 for r in quals if r[0] == "competency"]
    beh_items = [(r[1] + r[2]) / 2 for r in quals if r[0] == "behavior"]
    comp_score = round((sum(comp_items) / len(comp_items)) / 5 * 100, 1) if comp_items else 0.0
    beh_score = round((sum(beh_items) / len(beh_items)) / 5 * 100, 1) if beh_items else 0.0
    final = round(jabatan_score * W_JABATAN + comp_score * W_COMPETENCY + beh_score * W_BEHAVIOR, 1)
    return final, jabatan_score, comp_score, beh_score


def _get_latest_kpi(employee_id: int, db: Session, period: str | None = None) -> dict | None:
    q = "SELECT id, period, needs_coaching, notes, compliance_override FROM kpi_assessments WHERE employee_id = :eid AND status = 'final_approved'"
    params: dict = {"eid": employee_id}
    if period:
        q += " AND period = :p"
        params["p"] = period
    q += " ORDER BY period DESC LIMIT 1"
    row = db.execute(text(q), params).fetchone()
    if not row:
        return None
    final, jabatan, competency, behavior = _compute_kpi_scores(row[0], db)
    if row[4]:  # compliance_override
        final = 0.0
    return {
        "id": row[0],
        "period": row[1],
        "needs_coaching": row[2],
        "notes": row[3],
        "final_score": final,
        "jabatan_score": jabatan,
        "competency_score": competency,
        "behavior_score": behavior,
    }


def _get_discipline(employee_id: int, db: Session) -> tuple[int, float]:
    """Return (active_points, discipline_score 0-100)."""
    pts = db.execute(
        text("SELECT COALESCE(SUM(point), 0) FROM disciplinary_actions WHERE employee_id = :eid AND status = 'Aktif'"),
        {"eid": employee_id},
    ).scalar() or 0
    score = max(0.0, 100.0 - (pts / 60.0) * 100.0)
    return int(pts), round(score, 1)


def _get_tenure_months(join_date_val: Any) -> float:
    if not join_date_val:
        return 0.0
    try:
        jd = date.fromisoformat(str(join_date_val))
        return max(0.0, (date.today() - jd).days / 30)
    except Exception:
        return 0.0


# ─────────────────────────── Fase 1: rule-based ───────────────────────────

def _promotion_readiness(employee_id: int, db: Session) -> dict:
    emp = db.execute(
        text("SELECT id, nama, department, position, join_date FROM employees WHERE id = :eid"),
        {"eid": employee_id},
    ).fetchone()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")

    kpi = _get_latest_kpi(employee_id, db)
    kpi_score = kpi["final_score"] if kpi else 0.0
    comp_score = kpi["competency_score"] if kpi else 0.0
    kpi_period = kpi["period"] if kpi else None

    disc_pts, disc_score = _get_discipline(employee_id, db)
    tenure_months = _get_tenure_months(emp[4])
    tenure_score = min(tenure_months / 36, 1.0) * 100.0

    final_score = round(
        kpi_score * 0.40 + comp_score * 0.25 + disc_score * 0.20 + tenure_score * 0.15,
        1,
    )

    if final_score >= 80:
        category, color = "Ready", "green"
        desc = "Karyawan siap untuk dipertimbangkan promosi"
    elif final_score >= 65:
        category, color = "Near Ready", "yellow"
        desc = "Hampir siap — perlu beberapa pengembangan lagi"
    else:
        category, color = "Not Ready", "red"
        desc = "Perlu pengembangan lebih lanjut sebelum promosi"

    gaps = []
    if kpi_score < 85:
        gaps.append(f"KPI Score {kpi_score:.1f} (threshold 85)")
    if comp_score < 70:
        gaps.append(f"Competency Score {comp_score:.1f} (threshold 70)")
    if disc_score < 80:
        gaps.append(f"Disiplin — {disc_pts} poin pelanggaran aktif")
    if tenure_months < 12:
        gaps.append(f"Masa kerja {tenure_months:.0f} bulan (minimum 12 bulan)")

    return {
        "employee_id": employee_id,
        "employee_nama": emp[1],
        "department": emp[2],
        "position": emp[3],
        "final_score": final_score,
        "category": category,
        "category_color": color,
        "description": desc,
        "kpi_period": kpi_period,
        "breakdown": {
            "kpi_score": round(kpi_score, 1),
            "kpi_weight": 40,
            "competency_score": round(comp_score, 1),
            "competency_weight": 25,
            "discipline_score": round(disc_score, 1),
            "discipline_weight": 20,
            "tenure_score": round(tenure_score, 1),
            "tenure_months": round(tenure_months, 0),
            "tenure_weight": 15,
        },
        "discipline_points": disc_pts,
        "gaps": gaps,
        "promotion_eligible": len(gaps) == 0,
    }


def _skill_gap(employee_id: int, db: Session) -> dict:
    emp = db.execute(
        text("SELECT position, department FROM employees WHERE id = :eid"),
        {"eid": employee_id},
    ).fetchone()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")

    pos_name, dept = emp[0], emp[1]

    pos_row = db.execute(
        text("SELECT job_profile_id FROM positions WHERE nama_jabatan = :pos AND department = :dept LIMIT 1"),
        {"pos": pos_name, "dept": dept},
    ).fetchone()

    required: list[dict] = []
    jp_training: dict | None = None
    if pos_row and pos_row[0]:
        jp = db.execute(
            text("SELECT kompetensi, training_mandatory, training_recommended FROM job_profiles WHERE id = :id"),
            {"id": pos_row[0]},
        ).fetchone()
        if jp and jp[0]:
            try:
                required = json.loads(jp[0])
            except Exception:
                pass
        if jp:
            jp_training = {"mandatory": jp[1], "recommended": jp[2]}

    # Actual competency scores from latest final_approved KPI
    kpi = _get_latest_kpi(employee_id, db)
    actual: dict[str, float] = {}
    if kpi:
        quals = db.execute(
            text("SELECT parameter, (manager_score + hrd_score) / 2.0 FROM kpi_qual_scores WHERE assessment_id = :aid AND category = 'competency'"),
            {"aid": kpi["id"]},
        ).fetchall()
        for r in quals:
            actual[r[0].lower()] = round(r[1], 2)

    gaps = []
    for comp in required:
        nama = comp.get("nama", "")
        level_req = float(comp.get("level_required", 3))
        current = actual.get(nama.lower())
        if current is not None:
            gap = round(level_req - current, 2)
            status = "OK" if gap <= 0 else ("Minor" if gap <= 1 else "Major")
        else:
            gap = None
            status = "No Data"
        gaps.append({
            "competency": nama,
            "required": level_req,
            "current": current,
            "gap": gap,
            "status": status,
        })

    profiled = {c.get("nama", "").lower() for c in required}
    extra = [
        {"competency": k, "current": v}
        for k, v in actual.items() if k not in profiled
    ]

    risk = "High" if any(g["status"] == "Major" for g in gaps) else \
           "Medium" if any(g["status"] == "Minor" for g in gaps) else \
           "Low" if gaps else "No Job Profile"

    return {
        "employee_id": employee_id,
        "position": pos_name,
        "department": dept,
        "has_job_profile": bool(required),
        "kpi_period": kpi["period"] if kpi else None,
        "competency_gaps": gaps,
        "extra_competencies": extra,
        "risk_level": risk,
        "job_profile_training": jp_training,
    }


def _review_summary(employee_id: int, period: str, manager_notes: str, db: Session) -> dict:
    emp = db.execute(
        text("SELECT nama, department, position FROM employees WHERE id = :eid"),
        {"eid": employee_id},
    ).fetchone()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")

    nama, dept, pos = emp[0], emp[1], emp[2]

    kpi = _get_latest_kpi(employee_id, db, period=period)
    kpi_score = kpi["final_score"] if kpi else None
    comp_score = kpi["competency_score"] if kpi else None
    beh_score = kpi["behavior_score"] if kpi else None
    needs_coaching = kpi["needs_coaching"] if kpi else False

    talent = db.execute(
        text("SELECT final_label, succession_category, promotion_eligible FROM talent_reviews WHERE employee_id = :eid AND period = :p"),
        {"eid": employee_id, "p": period},
    ).fetchone()
    talent_label = talent[0] if talent else None
    succession = talent[1] if talent else None
    promo_eligible = bool(talent[2]) if talent else False

    disc_pts, disc_score = _get_discipline(employee_id, db)

    if kpi_score is None:
        perf_level = "belum tersedia data KPI"
    elif kpi_score >= 90:
        perf_level = "sangat baik"
    elif kpi_score >= 80:
        perf_level = "baik"
    elif kpi_score >= 70:
        perf_level = "cukup"
    else:
        perf_level = "perlu peningkatan"

    strengths = []
    if kpi_score and kpi_score >= 85:
        strengths.append("pencapaian KPI yang konsisten di atas target")
    if comp_score and comp_score >= 80:
        strengths.append("kompetensi teknis yang kuat")
    if beh_score and beh_score >= 80:
        strengths.append("perilaku kerja yang positif")
    if disc_pts == 0:
        strengths.append("kedisiplinan yang baik tanpa catatan sanksi")
    if talent_label in ["High Performer", "Future Leader"]:
        strengths.append(f"teridentifikasi sebagai {talent_label}")

    dev_areas = []
    if kpi_score and kpi_score < 80:
        dev_areas.append("peningkatan pencapaian target KPI jabatan")
    if comp_score and comp_score < 75:
        dev_areas.append("pengembangan kompetensi teknis sesuai jabatan")
    if beh_score and beh_score < 70:
        dev_areas.append("peningkatan perilaku kerja dan soft skills")
    if needs_coaching:
        dev_areas.append("coaching dan mentoring dari atasan langsung")
    if disc_pts > 0:
        dev_areas.append("perbaikan kedisiplinan kerja")

    ctx = f" Catatan atasan: {manager_notes}." if manager_notes.strip() else ""
    strengths_txt = ", ".join(strengths) if strengths else "belum teridentifikasi kekuatan spesifik"
    dev_txt = ", ".join(dev_areas) if dev_areas else "tidak ada area pengembangan kritis"

    summary = (
        f"{nama} ({pos} — {dept}) menunjukkan performa {perf_level} pada periode {period}.{ctx} "
        f"Kekuatan utama: {strengths_txt}. "
        f"Area pengembangan: {dev_txt}."
    )
    if promo_eligible:
        summary += f" Karyawan ini teridentifikasi sebagai kandidat promosi."

    recommendations = []
    if needs_coaching:
        recommendations.append("Berikan program coaching terstruktur selama 3 bulan ke depan")
    if kpi_score and kpi_score < 75:
        recommendations.append("Tetapkan target KPI terukur dan lakukan monitoring bulanan")
    if comp_score and comp_score < 70:
        recommendations.append("Ikutsertakan dalam pelatihan kompetensi terkait jabatan")
    if talent_label in ["High Performer", "Future Leader"] or promo_eligible:
        recommendations.append("Masukkan dalam talent pool dan pertimbangkan promosi atau rotasi")
    if not recommendations:
        recommendations.append("Pertahankan performa yang ada dan dukung pengembangan diri")

    return {
        "employee_id": employee_id,
        "employee_nama": nama,
        "period": period,
        "performance_summary": summary,
        "performance_level": perf_level,
        "kpi_score": kpi_score,
        "competency_score": comp_score,
        "behavior_score": beh_score,
        "talent_label": talent_label,
        "succession_category": succession,
        "promotion_eligible": promo_eligible,
        "strengths": strengths,
        "development_areas": dev_areas,
        "recommendations": recommendations,
        "source": "rule_based",
    }


def _succession(position_id: int, db: Session) -> dict:
    pos = db.execute(
        text("SELECT nama_jabatan, department, level, job_profile_id FROM positions WHERE id = :pid"),
        {"pid": position_id},
    ).fetchone()
    if not pos:
        raise HTTPException(404, "Posisi tidak ditemukan")

    pos_name, dept, level, jp_id = pos[0], pos[1], pos[2], pos[3]

    emps = db.execute(
        text("SELECT id, nama, department, position, join_date FROM employees WHERE is_active = TRUE"),
    ).fetchall()

    ranked = []
    for emp in emps:
        eid, nama, emp_dept, emp_pos, join_date = emp
        kpi = _get_latest_kpi(eid, db)
        kpi_score = kpi["final_score"] if kpi else 0.0
        comp_score = kpi["competency_score"] if kpi else 0.0

        disc_pts, disc_score = _get_discipline(eid, db)
        tenure_months = _get_tenure_months(join_date)
        tenure_score = min(tenure_months / 36, 1.0) * 100.0

        succession_score = round(
            kpi_score * 0.40 + comp_score * 0.30 + disc_score * 0.20 + tenure_score * 0.10,
            1,
        )

        talent_row = db.execute(
            text("SELECT final_label FROM talent_reviews WHERE employee_id = :eid ORDER BY period DESC LIMIT 1"),
            {"eid": eid},
        ).fetchone()
        talent_label = talent_row[0] if talent_row else None

        if succession_score >= 80:
            readiness = "Ready Now"
        elif succession_score >= 65:
            readiness = "Ready < 1 Tahun"
        elif succession_score >= 50:
            readiness = "Ready 1-2 Tahun"
        else:
            readiness = "Not Ready"

        ranked.append({
            "employee_id": eid,
            "nama": nama,
            "department": emp_dept,
            "current_position": emp_pos,
            "kpi_score": round(kpi_score, 1),
            "competency_score": round(comp_score, 1),
            "discipline_score": round(disc_score, 1),
            "tenure_months": round(tenure_months, 0),
            "succession_score": succession_score,
            "readiness": readiness,
            "talent_label": talent_label,
        })

    ranked.sort(key=lambda x: -x["succession_score"])
    return {
        "position_id": position_id,
        "position_name": pos_name,
        "department": dept,
        "level": level,
        "candidates": ranked[:10],
    }


# ─────────────────────────── Fase 2: Ollama ───────────────────────────

def _call_ollama(prompt: str, model: str = "qwen2.5") -> str:
    try:
        import requests as req
        resp = req.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except ImportError:
        raise HTTPException(503, "Library 'requests' tidak tersedia — jalankan: pip install requests")
    except Exception as e:
        raise HTTPException(503, f"Ollama tidak tersedia: {e}")


def _build_employee_context(employee_id: int, db: Session, period: str | None = None) -> str:
    emp = db.execute(
        text("SELECT nama, department, position, join_date FROM employees WHERE id = :eid"),
        {"eid": employee_id},
    ).fetchone()
    if not emp:
        return ""

    nama, dept, pos, join_date = emp
    tenure_months = _get_tenure_months(join_date)

    kpi = _get_latest_kpi(employee_id, db, period=period)
    disc_pts, disc_score = _get_discipline(employee_id, db)

    disc_rows = db.execute(
        text("SELECT jenis_sanksi, kategori_pelanggaran, deskripsi, tanggal_pelanggaran FROM disciplinary_actions WHERE employee_id = :eid ORDER BY tanggal_pelanggaran DESC LIMIT 3"),
        {"eid": employee_id},
    ).fetchall()

    train_rows = db.execute(
        text("SELECT nama, tanggal, nilai FROM training_records WHERE employee_id = :eid ORDER BY tanggal DESC LIMIT 5"),
        {"eid": employee_id},
    ).fetchall()

    talent = db.execute(
        text("SELECT final_label, succession_category, leadership_score FROM talent_reviews WHERE employee_id = :eid ORDER BY period DESC LIMIT 1"),
        {"eid": employee_id},
    ).fetchone()

    ctx = f"""=== DATA KARYAWAN ===
Nama: {nama}
Jabatan: {pos}
Departemen: {dept}
Lama Bekerja: {tenure_months:.0f} bulan

"""
    if kpi:
        ctx += f"""=== KPI (Periode {kpi["period"]}) ===
Final Score: {kpi["final_score"]:.1f} / 100
KPI Jabatan: {kpi["jabatan_score"]:.1f}
Kompetensi: {kpi["competency_score"]:.1f}
Perilaku Kerja: {kpi["behavior_score"]:.1f}
Butuh Coaching: {"Ya" if kpi["needs_coaching"] else "Tidak"}
Catatan HRD: {kpi["notes"] or "-"}

"""
    else:
        ctx += "=== KPI ===\nBelum ada data KPI final.\n\n"

    if talent:
        ctx += f"""=== TALENT ASSESSMENT ===
Label: {talent[0]}
Succession: {talent[1] or "-"}
Leadership Score: {talent[2] or "Belum dinilai"}

"""

    ctx += f"""=== DISIPLIN ===
Poin Pelanggaran Aktif: {disc_pts}
Discipline Score: {disc_score:.1f} / 100
"""
    if disc_rows:
        for r in disc_rows:
            ctx += f"- {r[0]} | {r[1]} | {r[2]} ({r[3]})\n"
    ctx += "\n"

    if train_rows:
        ctx += "=== TRAINING ===\n"
        for r in train_rows:
            ctx += f"- {r[0]} ({r[1] or 'TBD'}) — Nilai: {r[2] or 'N/A'}\n"
        ctx += "\n"

    return ctx


def _ollama_performance_review(employee_id: int, period: str | None, manager_notes: str, model: str, db: Session) -> dict:
    ctx = _build_employee_context(employee_id, db, period=period)
    emp = db.execute(text("SELECT nama FROM employees WHERE id = :eid"), {"eid": employee_id}).fetchone()
    nama = emp[0] if emp else "Karyawan"

    prompt = f"""Kamu adalah AI HR Analyst. Analisis data karyawan berikut dan buat laporan Performance Review dalam Bahasa Indonesia yang profesional.

{ctx}
Catatan dari Atasan: {manager_notes or "-"}

Buat laporan dengan format:
**RINGKASAN PERFORMA**
[2-3 kalimat ringkasan performa keseluruhan]

**KEKUATAN**
- [poin 1]
- [poin 2]
- [poin 3]

**AREA PENGEMBANGAN**
- [poin 1]
- [poin 2]

**REKOMENDASI**
- [rekomendasi konkret 1]
- [rekomendasi konkret 2]
- [rekomendasi konkret 3]

**KESIMPULAN**
[1-2 kalimat kesimpulan dan langkah selanjutnya]

Gunakan data aktual yang diberikan. Jangan mengarang data yang tidak ada. Tulis dalam nada profesional dan konstruktif."""

    response = _call_ollama(prompt, model)
    return {
        "employee_id": employee_id,
        "employee_nama": nama,
        "period": period,
        "manager_notes": manager_notes,
        "ai_response": response,
        "model": model,
        "source": "ollama",
    }


def _ollama_training_recommendation(employee_id: int, model: str, db: Session) -> dict:
    ctx = _build_employee_context(employee_id, db)
    emp = db.execute(text("SELECT nama, position FROM employees WHERE id = :eid"), {"eid": employee_id}).fetchone()
    nama = emp[0] if emp else "Karyawan"
    pos = emp[1] if emp else ""

    jp_info = ""
    pos_row = db.execute(text("SELECT job_profile_id FROM positions WHERE nama_jabatan = :pos LIMIT 1"), {"pos": pos}).fetchone()
    if pos_row and pos_row[0]:
        jp = db.execute(text("SELECT kompetensi, training_mandatory, training_recommended, career_path_naik FROM job_profiles WHERE id = :id"), {"id": pos_row[0]}).fetchone()
        if jp:
            jp_info = f"\n=== JOB PROFILE ===\nKompetensi yang dibutuhkan: {jp[0] or '-'}\nTraining Wajib: {jp[1] or '-'}\nTraining Direkomendasikan: {jp[2] or '-'}\nCareer Path: {jp[3] or '-'}\n"

    prompt = f"""Kamu adalah AI Learning & Development Specialist. Berikan rekomendasi training yang tepat sasaran untuk karyawan berikut.

{ctx}{jp_info}

Buat rekomendasi dengan format:
**PRIORITAS TRAINING**
1. [Nama Training] — [Alasan berdasarkan data] — [Estimasi durasi]
2. [Nama Training] — [Alasan] — [Estimasi durasi]
3. [Nama Training] — [Alasan] — [Estimasi durasi]

**PENGEMBANGAN KOMPETENSI**
- [Kompetensi yang perlu ditingkatkan dan cara pengembangannya]

**SERTIFIKASI YANG DIREKOMENDASIKAN**
- [Sertifikasi relevan dengan jabatan saat ini atau career path]

**RENCANA PENGEMBANGAN 6 BULAN**
[Rencana konkret pengembangan dalam 6 bulan ke depan]

Fokus pada gap yang teridentifikasi dari data KPI dan kompetensi. Gunakan Bahasa Indonesia yang profesional."""

    response = _call_ollama(prompt, model)
    return {
        "employee_id": employee_id,
        "employee_nama": nama,
        "ai_response": response,
        "model": model,
        "source": "ollama",
    }


# ─────────────────────────── Endpoints ───────────────────────────

class ReviewSummaryRequest(BaseModel):
    employee_id: int
    period: str
    manager_notes: str = ""


class OllamaRequest(BaseModel):
    employee_id: int
    period: str | None = None
    manager_notes: str = ""
    model: str = "qwen2.5"


class TrainingRequest(BaseModel):
    employee_id: int
    model: str = "qwen2.5"


@router.get("/ollama/status")
def ollama_status():
    """Cek apakah Ollama berjalan di localhost:11434."""
    try:
        import requests as req
        resp = req.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        models = [m["name"] for m in resp.json().get("models", [])]
        return {"online": True, "models": models}
    except Exception:
        return {"online": False, "models": []}


@router.get("/promotion-readiness/{employee_id}")
def get_promotion_readiness(
    employee_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _promotion_readiness(employee_id, db)


@router.get("/skill-gap/{employee_id}")
def get_skill_gap(
    employee_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _skill_gap(employee_id, db)


@router.post("/review-summary")
def get_review_summary(
    payload: ReviewSummaryRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _review_summary(payload.employee_id, payload.period, payload.manager_notes, db)


@router.get("/succession/{position_id}")
def get_succession(
    position_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("HR")),
):
    return _succession(position_id, db)


@router.post("/ollama/performance-review")
def ollama_performance_review(
    payload: OllamaRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _ollama_performance_review(payload.employee_id, payload.period, payload.manager_notes, payload.model, db)


@router.post("/ollama/training-recommendation")
def ollama_training_recommendation(
    payload: TrainingRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _ollama_training_recommendation(payload.employee_id, payload.model, db)
