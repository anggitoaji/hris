import { useEffect, useState } from "react";
import {
  Building2, Palette, Info, Users, Lock, Bell, Shield,
  GitBranch, FileBarChart, Mail, Database, Plug, Activity,
  Wrench, CheckCircle, Loader2, ChevronRight,
} from "lucide-react";
import { fetchAppSettings, updateAppSettings } from "../services/api";

type Section =
  | "org"
  | "tampilan"
  | "users"
  | "password"
  | "role"
  | "workflow"
  | "notif"
  | "audit"
  | "email"
  | "integrasi"
  | "backup"
  | "security"
  | "tentang";

interface NavItem {
  key: Section;
  label: string;
  icon: typeof Building2;
  built: boolean;
  desc: string;
}

const NAV: NavItem[] = [
  { key: "org",       label: "Profil Perusahaan",      icon: Building2,    built: true,  desc: "Nama, alamat, kontak perusahaan" },
  { key: "tampilan",  label: "Tampilan & Tema",         icon: Palette,      built: true,  desc: "Warna, font, mode kompak" },
  { key: "users",     label: "User Management",         icon: Users,        built: true,  desc: "Kelola akun pengguna sistem" },
  { key: "password",  label: "Ganti Password",          icon: Lock,         built: true,  desc: "Ubah password akun kamu" },
  { key: "role",      label: "Role & Permission",       icon: Shield,       built: false, desc: "Konfigurasi hak akses per role" },
  { key: "workflow",  label: "Workflow Approval",       icon: GitBranch,    built: false, desc: "Atur alur persetujuan" },
  { key: "notif",     label: "Notifikasi",              icon: Bell,         built: false, desc: "In-app, email, WhatsApp" },
  { key: "audit",     label: "Audit Log",               icon: Activity,     built: false, desc: "Riwayat aktivitas sistem" },
  { key: "email",     label: "Email Configuration",     icon: Mail,         built: false, desc: "SMTP dan konfigurasi email" },
  { key: "integrasi", label: "Integrasi",               icon: Plug,         built: false, desc: "Google, M365, WhatsApp API" },
  { key: "backup",    label: "Backup & Restore",        icon: Database,     built: false, desc: "Cadangkan dan pulihkan data" },
  { key: "security",  label: "Security Center",         icon: Shield,       built: false, desc: "2FA, IP restriction, session" },
  { key: "tentang",   label: "Tentang Sistem",          icon: Info,         built: true,  desc: "Versi, build, lisensi" },
];

const ACCENT_COLORS: { label: string; value: string; tw: string }[] = [
  { label: "Sky Blue",  value: "sky",    tw: "bg-sky-500" },
  { label: "Violet",    value: "violet", tw: "bg-violet-500" },
  { label: "Emerald",   value: "emerald",tw: "bg-emerald-500" },
  { label: "Rose",      value: "rose",   tw: "bg-rose-500" },
  { label: "Amber",     value: "amber",  tw: "bg-amber-500" },
  { label: "Slate",     value: "slate",  tw: "bg-slate-600" },
];

const FONT_SIZES = ["Kecil", "Sedang", "Besar"];
const DISPLAY_MODES = ["Comfortable", "Compact"];

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Wrench size={28} className="text-slate-400" />
      </div>
      <div className="text-center">
        <div className="font-semibold text-slate-700 mb-1">{label}</div>
        <div className="text-sm text-slate-400">Fitur ini sedang dalam pengembangan</div>
        <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">
          Segera Hadir
        </span>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 transition"
      />
    </div>
  );
}

// ===================== Section: Organization =====================
function OrgSection() {
  const [form, setForm] = useState({ company_name: "", company_address: "", company_email: "", company_phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAppSettings().then(d => {
      setForm({
        company_name: d.company_name ?? "",
        company_address: d.company_address ?? "",
        company_email: d.company_email ?? "",
        company_phone: d.company_phone ?? "",
      });
    }).catch(() => setErr("Gagal memuat pengaturan")).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setErr(null); setSaved(false);
    try {
      await updateAppSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat...</div>;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Identitas Perusahaan">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <InputField label="Nama Perusahaan" value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="PT. Solusi Group" />
          </div>
          <InputField label="Email Perusahaan" value={form.company_email} onChange={v => setForm(f => ({ ...f, company_email: v }))} placeholder="info@perusahaan.com" type="email" />
          <InputField label="Nomor Telepon" value={form.company_phone} onChange={v => setForm(f => ({ ...f, company_phone: v }))} placeholder="021-xxxxxxx" />
          <div className="col-span-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Alamat</label>
            <textarea
              value={form.company_address}
              onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))}
              rows={3}
              placeholder="Jl. ..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 transition resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</div>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50 transition">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Simpan Perubahan
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle size={15} /> Tersimpan
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Section: Tampilan =====================
const LS_KEY = "hris_display_prefs";
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function TampilanSection() {
  const prefs = loadPrefs();
  const [accentColor, setAccentColor] = useState<string>(prefs.accentColor ?? "sky");
  const [fontSize, setFontSize] = useState<string>(prefs.fontSize ?? "Sedang");
  const [displayMode, setDisplayMode] = useState<string>(prefs.displayMode ?? "Comfortable");
  const [animation, setAnimation] = useState<boolean>(prefs.animation ?? true);
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify({ accentColor, fontSize, displayMode, animation }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Warna Utama">
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(c => (
            <button key={c.value} onClick={() => setAccentColor(c.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition ${accentColor === c.value ? "border-slate-800 shadow-sm" : "border-slate-100 hover:border-slate-200"}`}>
              <span className={`w-4 h-4 rounded-full ${c.tw}`} />
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">Perubahan warna akan diterapkan penuh di update berikutnya.</p>
      </SectionCard>

      <SectionCard title="Mode Tampilan">
        <div className="flex gap-3">
          {DISPLAY_MODES.map(m => (
            <button key={m} onClick={() => setDisplayMode(m)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition ${displayMode === m ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-100 text-slate-600 hover:border-slate-200"}`}>
              {m}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          <b>Comfortable</b>: lebih longgar — <b>Compact</b>: lebih padat, cocok untuk layar kecil.
        </p>
      </SectionCard>

      <SectionCard title="Ukuran Font">
        <div className="flex gap-3">
          {FONT_SIZES.map(s => (
            <button key={s} onClick={() => setFontSize(s)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition ${fontSize === s ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-100 text-slate-600 hover:border-slate-200"}`}>
              {s}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Animasi">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-700">Efek Animasi</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Transisi halus saat berpindah halaman dan membuka panel</div>
          </div>
          <button onClick={() => setAnimation(!animation)}
            className={`relative w-12 h-6 rounded-full transition-colors ${animation ? "bg-sky-500" : "bg-slate-200"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${animation ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition">
          Simpan Preferensi
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle size={15} /> Tersimpan di browser ini
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Section: Tentang =====================
function TentangSection() {
  return (
    <SectionCard title="Tentang Sistem">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <div>
            <div className="font-bold text-slate-800 text-lg">HRIS — Solusi Group</div>
            <div className="text-sm text-slate-400">Human Resource Information System</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Versi", "1.0.0"],
            ["Build", "2026.06"],
            ["Release", "Juni 2026"],
            ["Stack Backend", "FastAPI + SQLAlchemy"],
            ["Stack Frontend", "React 18 + Vite + Tailwind"],
            ["Database", "SQLite (dev) / PostgreSQL (prod)"],
            ["Lisensi", "Internal — Solusi Group"],
            ["Pengembang", "Internal Dev Team"],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">{k}</div>
              <div className="text-slate-700 font-medium">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ===================== Main Page =====================
export default function SettingsPage({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const [active, setActive] = useState<Section>("org");
  const current = NAV.find(n => n.key === active)!;
  const Icon = current.icon;

  function renderContent() {
    if (active === "org") return <OrgSection />;
    if (active === "tampilan") return <TampilanSection />;
    if (active === "tentang") return <TentangSection />;
    if (active === "users") {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Users size={40} className="text-sky-400" />
          <div className="text-center">
            <div className="font-semibold text-slate-700 mb-1">User Management</div>
            <div className="text-sm text-slate-400 mb-4">Kelola akun pengguna, reset password, dan status aktif</div>
            <button onClick={() => onNavigate?.("users.manage")}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium">
              Buka User Management <ChevronRight size={15} />
            </button>
          </div>
        </div>
      );
    }
    if (active === "password") {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Lock size={40} className="text-violet-400" />
          <div className="text-center">
            <div className="font-semibold text-slate-700 mb-1">Ganti Password</div>
            <div className="text-sm text-slate-400 mb-4">Ubah password akun kamu sekarang</div>
            <button onClick={() => onNavigate?.("settings.password")}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium">
              Buka Ganti Password <ChevronRight size={15} />
            </button>
          </div>
        </div>
      );
    }
    return <ComingSoon label={current.label} />;
  }

  return (
    <div className="flex gap-5 min-h-screen items-start">
      {/* Left nav */}
      <div className="w-60 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
        <div className="px-4 py-4 border-b border-slate-50">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pengaturan Sistem</div>
        </div>
        <nav className="py-2">
          {NAV.map(item => {
            const ItemIcon = item.icon;
            const isActive = active === item.key;
            return (
              <button key={item.key} onClick={() => setActive(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <ItemIcon size={16} className={isActive ? "text-sky-600" : "text-slate-400"} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {!item.built && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-500 font-semibold border border-amber-100 shrink-0">Soon</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <Icon size={20} className="text-sky-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">{current.label}</h2>
            <p className="text-xs text-slate-400">{current.desc}</p>
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
