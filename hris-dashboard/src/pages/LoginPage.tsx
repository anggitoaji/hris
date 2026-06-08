import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { login, type LoginResult } from "../services/api";

export default function LoginPage({ onSuccess }: { onSuccess: (r: LoginResult) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!username.trim() || !password) { setErr("Isi username dan password."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await login(username.trim(), password);
      onSuccess(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="flex items-center justify-center rounded-xl mb-3" style={{ width: 44, height: 44, background: "linear-gradient(135deg,#06b6d4,#2563eb)" }}>
            <span className="text-white font-bold text-xl">a</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800">Workspace Management</h1>
          <p className="text-sm text-slate-400">Masuk untuk melanjutkan</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Username</label>
            <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300"
              placeholder="mis. admin" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300"
              placeholder="password" />
          </div>

          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>}

          <button onClick={submit} disabled={busy}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 mt-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Masuk
          </button>
        </div>
      </div>
    </div>
  );
}
