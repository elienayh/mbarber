import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
      return;
    }

    setUpdated(true);
    await supabase.auth.signOut();
  };

  return (
    <div className="auth-page min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="auth-card w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
            MB
          </div>
          <h2 className="text-2xl font-black text-white">Redefinir senha</h2>
          <p className="text-xs text-slate-400 mt-1">Crie uma nova senha para acessar sua conta.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-300 leading-relaxed">{error}</span>
          </div>
        )}

        {updated ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-emerald-300">Senha atualizada com sucesso.</p>
            <button
              type="button"
              onClick={() => navigate("/auth/login", { replace: true })}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              Ir para o login
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nova senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Confirme a nova senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Atualizando..." : "Atualizar senha"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-400">
          <Link to="/auth/login" className="text-amber-400 font-bold hover:underline">Voltar para o login</Link>
        </div>
      </div>
    </div>
  );
};