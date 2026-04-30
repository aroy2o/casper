import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginThunk } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";

export const Login = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const { isAuthenticated, status, error } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState("admin@casper.gov.in");
  const [password, setPassword] = useState("CasperAdmin@2024");

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void dispatch(loginThunk({ email, password }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-center text-2xl font-bold tracking-wide text-casper-blue">CASPER</h1>
        <p className="mt-1 text-center text-sm text-slate-400">Procurement intelligence platform</p>

        <label className="mt-5 block text-xs text-slate-400">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-casper-blue focus:ring-1"
          required
        />

        <label className="mt-4 block text-xs text-slate-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-casper-blue focus:ring-1"
          required
        />

        <button
          type="submit"
          className="mt-5 flex w-full items-center justify-center rounded-lg bg-casper-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Signing in..." : "Login"}
        </button>

        {error ? <p className="mt-3 text-sm text-casper-red">{error}</p> : null}
        <p className="mt-4 text-xs text-slate-500">Demo: admin@casper.gov.in / CasperAdmin@2024</p>
      </form>
    </div>
  );
};
