import { useEffect, useMemo, useState } from "react";
import { Search, X, Loader2, Plus, Trash2, UserCog, KeyRound } from "lucide-react";
import {
  fetchUsers, createUser, updateUser, deleteUser, fetchRoles,
  fetchEmployees, type AuthUser,
} from "../services/api";
import type { Employee } from "../types";

const ROLE_COLOR: Record<string, string> = {
  "Super Admin": "bg-violet-100 text-violet-700",
  Direksi: "bg-indigo-100 text-indigo-700",
  HR: "bg-sky-100 text-sky-700",
  Manager: "bg-emerald-100 text-emerald-700",
  Finance: "bg-amber-100 text-amber-700",
  NOC: "bg-cyan-100 text-cyan-700",
  Karyawan: "bg-slate-100 text-slate-600",
};

type UForm = { username: string; password: string; role: string; employeeId: string; is_active: boolean };
function emptyForm(): UForm {
  return { username: "", password: "", role: "Karyawan", employeeId: "", is_active: true };
}

export default function UserManagementPage() {
  const [rows, setRows] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<UForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setRows(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetchRoles().then(setRoles).catch(() => setRoles(["Super Admin", "Direksi", "HR", "Manager", "Finance", "NOC", "Karyawan"]));
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => !s || [r.username, r.role, r.employee_nama].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm());
    setFormErr(null); setFormOpen(true);
  }
  function openEdit(u: AuthUser) {
    setFormMode("edit"); setFormId(u.id);
    setF({ username: u.username, password: "", role: u.role, employeeId: u.employee_id ? String(u.employee_id) : "", is_active: u.is_active });
    setFormErr(null); setFormOpen(true);
  }
  const set = (k: keyof UForm, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (formMode === "create") {
      if (f.username.trim().length < 3) { setFormErr("Username minimal 3 karakter."); return; }
      if (f.password.length < 6) { setFormErr("Password minimal 6 karakter."); return; }
    }
    setSaving(true); setFormErr(null);
    try {
      const empId = f.employeeId ? Number(f.employeeId) : null;
      if (formMode === "create") {
        await createUser({ username: f.username.trim(), password: f.password, role: f.role, employee_id: empId });
      } else if (formId != null) {
        const payload: Record<string, unknown> = { role: f.role, employee_id: empId, is_active: f.is_active };
        if (f.password.trim()) payload.password = f.password.trim();
        await updateUser(formId, payload);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow() {
    if (formId == null) return;
    if (!window.confirm("Hapus akun ini? Tindakan ini permanen.")) return;
    setSaving(true); setFormErr(null);
    try {
      await deleteUser(formId);
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Manajemen User</h1>
          <p className="text-sm text-slate-400">Kelola akun login & hak akses (role). Khusus Super Admin.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
          <Plus size={16} /> Tambah User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="relative mb-3 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari username, role, karyawan..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" />
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat data...
          </div>
        )}
        {err && !loading && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            Gagal memuat data: {err}. (Hanya Super Admin yang bisa membuka halaman ini.)
          </div>
        )}
        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">Username</th>
                  <th className="py-2 px-2 font-bold">Role</th>
                  <th className="py-2 px-2 font-bold">Karyawan Terkait</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} onClick={() => openEdit(u)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                    <td className="py-2.5 px-2 font-medium text-slate-800">{u.username}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">{u.employee_nama || <span className="text-slate-300">-</span>}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-slate-400 py-8">Belum ada akun.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form drawer */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !saving && setFormOpen(false)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: 420, maxWidth: "94vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <UserCog size={18} className="text-sky-600" />
                {formMode === "create" ? "Tambah User" : "Edit User"}
              </div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Username {formMode === "create" && <span className="text-red-400">*</span>}</label>
                {formMode === "create" ? (
                  <input className={inputCls} value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="mis. desy.hr" />
                ) : (
                  <div className="text-sm font-medium text-slate-700 px-1 py-2">{f.username}</div>
                )}
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  {formMode === "create" ? <>Password <span className="text-red-400">*</span></> : <>Reset Password <span className="text-slate-400">(kosongkan bila tak diubah)</span></>}
                </label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" className={`${inputCls} pl-9`} value={f.password} onChange={(e) => set("password", e.target.value)}
                    placeholder={formMode === "create" ? "minimal 6 karakter" : "ketik password baru"} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Role / Hak Akses</label>
                <select className={inputCls} value={f.role} onChange={(e) => set("role", e.target.value)}>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Kaitkan ke Karyawan <span className="text-slate-400">(opsional)</span></label>
                <select className={inputCls} value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
                  <option value="">- tidak dikaitkan -</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.nama} ({e.department})</option>)}
                </select>
                <div className="text-[11px] text-slate-400 mt-1">Berguna agar akun terhubung ke data karyawan (mis. untuk slip gaji sendiri).</div>
              </div>

              {formMode === "edit" && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                  Akun aktif (bisa login)
                </label>
              )}

              {formMode === "edit" && (
                <button onClick={removeRow} disabled={saving}
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={15} /> Hapus akun
                </button>
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 sticky bottom-0 bg-white">
              {formErr && <div className="text-sm text-red-600 mb-2">{formErr}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setFormOpen(false)} disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-2 disabled:opacity-60">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {formMode === "create" ? "Simpan" : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
