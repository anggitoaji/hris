"""
Update warna aksen node IT VPN sesuai referensi org chart:
- DIREKSI          : #1F4E78 (navy gelap)
- HEAD level       : #2F5496 (biru medium)
- MANAGER level    : #4472C4 (biru muda)
- SPV level        : #ED7D31 (oranye)
- STAFF/subordinat : #70AD47 (hijau)

Juga fix: SPV NETWORK -> ENOS MONITORING = garis koordinasi (reference, dashed)
"""

import requests
import sys

BASE = "http://localhost:8000/api"
DIVISION = "itvpn"

def login():
    r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
    r.raise_for_status()
    return r.json()["token"]

def get_nodes(token, division):
    r = requests.get(f"{BASE}/orgchart/nodes/{division}",
                     headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()

def get_edges(token, division):
    r = requests.get(f"{BASE}/orgchart/edges/{division}",
                     headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()

def update_node(token, nid, payload):
    r = requests.patch(f"{BASE}/orgchart/nodes/{nid}", json=payload,
                       headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()

def update_edge(token, eid, payload):
    r = requests.patch(f"{BASE}/orgchart/edges/{eid}", json=payload,
                       headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()

# Mapping: title keyword (lower) -> accent color
TITLE_TO_COLOR = {
    "direksi":     "#1F4E78",
    "head":        "#2F5496",
    "mgr":         "#4472C4",
    "manager":     "#4472C4",
    "spv":         "#ED7D31",
    "supervisor":  "#ED7D31",
    "infra":       "#70AD47",
    "enos":        "#70AD47",
    "staff":       "#70AD47",
}

def assign_color(title: str) -> str:
    t = title.lower()
    for kw, color in TITLE_TO_COLOR.items():
        if kw in t:
            return color
    return "#334155"  # fallback: slate


def main():
    print("[*] Login...")
    token = login()

    print("[*] Ambil nodes...")
    nodes = get_nodes(token, DIVISION)
    print(f"    {len(nodes)} node ditemukan")

    # Update warna tiap node
    for n in nodes:
        new_color = assign_color(n["title"])
        old_color = n.get("color", "")
        if old_color != new_color:
            update_node(token, n["id"], {"color": new_color, "text_color": "#1e293b"})
            print(f"    [{n['id']}] {n['title']!r:35s} {old_color} -> {new_color}")
        else:
            print(f"    [{n['id']}] {n['title']!r:35s} sudah benar ({new_color})")

    print("\n[*] Ambil edges...")
    edges = get_edges(token, DIVISION)
    print(f"    {len(edges)} edge ditemukan")

    # Temukan node INFRA & CLOUD dan ENOS MONITORING berdasarkan title
    node_by_id = {str(n["id"]): n for n in nodes}

    for e in edges:
        src = node_by_id.get(e["source_id"], {})
        tgt = node_by_id.get(e["target_id"], {})
        src_t = src.get("title", "").lower()
        tgt_t = tgt.get("title", "").lower()

        # SPV NETWORK -> INFRA & CLOUD = reporting (garis komando, solid)
        # SPV NETWORK -> ENOS MONITORING = reference (garis koordinasi, dashed, tanpa panah)
        is_coord = ("spv network" in src_t or "network" in src_t) and ("enos monitoring" in tgt_t or "monitoring" in tgt_t)

        if is_coord:
            update_edge(token, e["id"], {
                "edge_type": "reference",
                "line_type": "dashed",
                "arrow_end": "none",
            })
            print(f"    Edge [{e['id']}] {src.get('title','?')} -> {tgt.get('title','?')}: set REFERENCE (dashed, no arrow)")

    print("\n[+] Selesai! Refresh browser untuk melihat perubahan.")

if __name__ == "__main__":
    main()
