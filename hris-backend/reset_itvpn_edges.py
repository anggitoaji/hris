"""
Reset semua edge IT VPN dan buat ulang sesuai struktur hierarki:
- Garis Komando (solid, navy): semua garis perintah langsung
- Garis Koordinasi (dashed, gray): SPV Network -> ENOS Monitoring (kewenangan fungsional)
"""

import requests

BASE = "http://localhost:8000/api"
DIVISION = "itvpn"

def login():
    r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
    r.raise_for_status()
    return r.json()["token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def main():
    print("[*] Login...")
    token = login()

    # Hapus semua edge lama
    print("[*] Hapus semua edge lama...")
    edges = requests.get(f"{BASE}/orgchart/edges/{DIVISION}", headers=auth(token)).json()
    for e in edges:
        requests.delete(f"{BASE}/orgchart/edges/{e['id']}", headers=auth(token))
        print(f"    Hapus edge [{e['id']}]")

    # Ambil semua node dan buat mapping title -> id
    print("[*] Ambil node list...")
    nodes = requests.get(f"{BASE}/orgchart/nodes/{DIVISION}", headers=auth(token)).json()
    # Mapping: title lower (stripped) -> id
    node_map = {n["title"].strip().lower(): str(n["id"]) for n in nodes}
    for t, i in node_map.items():
        print(f"    [{i}] '{t}'")

    def nid(title_key):
        """Cari node id dari sebagian judul"""
        for t, i in node_map.items():
            if title_key.lower() in t:
                return i
        raise ValueError(f"Node tidak ditemukan: {title_key}")

    # Definisi edge yang benar sesuai hierarki
    EDGES = [
        # === Garis Komando (solid, navy, ada panah) ===
        ("direksi",              "head it",      "reporting", "solid", "arrow"),
        ("direksi",              "head ops",     "reporting", "solid", "arrow"),
        ("head it",              "mgr",          "reporting", "solid", "arrow"),
        ("head ops",             "mgr",          "reporting", "solid", "arrow"),
        ("mgr",                  "spv network",  "reporting", "solid", "arrow"),
        ("mgr",                  "spv monitoring","reporting","solid", "arrow"),
        ("mgr",                  "spv production","reporting","solid", "arrow"),
        ("mgr",                  "spv sla",      "reporting", "solid", "arrow"),
        ("spv network",          "infra",        "reporting", "solid", "arrow"),
        ("spv monitoring",       "enos monitoring","reporting","solid","arrow"),
        ("spv monitoring",       "enos  operation","reporting","solid","arrow"),
        ("spv production",       "staff production","reporting","solid","arrow"),
        ("spv sla",              "staff admin",  "reporting", "solid", "arrow"),
        # === Garis Koordinasi (dashed, gray, tanpa panah) ===
        ("spv network",          "enos monitoring","reference","dashed","none"),
    ]

    print("\n[*] Buat edge baru...")
    created = 0
    for (src_key, tgt_key, edge_type, line_type, arrow_end) in EDGES:
        try:
            src_id = nid(src_key)
            tgt_id = nid(tgt_key)
            r = requests.post(f"{BASE}/orgchart/edges", json={
                "division_key": DIVISION,
                "source_id": src_id,
                "target_id": tgt_id,
                "edge_type": edge_type,
                "line_type": line_type,
                "arrow_end": arrow_end,
                "routing_type": "smoothstep",
                "label": "",
            }, headers=auth(token))
            r.raise_for_status()
            eid = r.json()["id"]
            lbl = "---" if line_type == "dashed" else "--->"
            print(f"    [{eid}] '{src_key}' {lbl} '{tgt_key}' ({edge_type})")
            created += 1
        except Exception as ex:
            print(f"    [!] GAGAL: {src_key} -> {tgt_key}: {ex}")

    print(f"\n[+] Selesai! {created}/{len(EDGES)} edge dibuat. Refresh browser.")

if __name__ == "__main__":
    main()
