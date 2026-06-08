import { useState } from "react";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { changePassword } from "../services/api";

export default function ChangePasswordPage() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    if (newPw.length < 6) { setErr("Password baru minimal 6 karakter."); return; }
    if (newPw !== confirmPw) { setErr("Konfirmasi password tidak sama."); return; }
    setBusy(true); setErr(null);
    try {
      await changePassword(oldPw, newPw);
      setOk(true);
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengganti password.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Ganti Password</h1>
        <p className="text-sm text-slate-400">Ubah password akun Anda sendiri.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 max-w-md">
        {ok && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} /> Password berhasil diganti. Gunakan password baru saat login berikutnya.
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Password Lama</label>
            <div className="relative">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="password" className={`${inputCls} pl-9`} value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Password Baru</label>
            <input type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="minimal 6 karakter" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Konfirmasi Password Baru</label>
            <input type="password" className={inputCls} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center justify-center gap-2 disabled:opacity-60 mt-1 w-40">
            {busy && <Loader2 size={14} className="animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
