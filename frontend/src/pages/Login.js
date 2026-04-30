import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginThunk } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
export const Login = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from ?? "/";
    const { isAuthenticated, status, error } = useAppSelector((state) => state.auth);
    const [email, setEmail] = useState("admin@casper.gov.in");
    const [password, setPassword] = useState("CasperAdmin@2024");
    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);
    const onSubmit = (event) => {
        event.preventDefault();
        void dispatch(loginThunk({ email, password }));
    };
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-950 p-4", children: _jsxs("form", { onSubmit: onSubmit, className: "w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl", children: [_jsx("h1", { className: "text-center text-2xl font-bold tracking-wide text-casper-blue", children: "CASPER" }), _jsx("p", { className: "mt-1 text-center text-sm text-slate-400", children: "Procurement intelligence platform" }), _jsx("label", { className: "mt-5 block text-xs text-slate-400", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (event) => setEmail(event.target.value), className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-casper-blue focus:ring-1", required: true }), _jsx("label", { className: "mt-4 block text-xs text-slate-400", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value), className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-casper-blue focus:ring-1", required: true }), _jsx("button", { type: "submit", className: "mt-5 flex w-full items-center justify-center rounded-lg bg-casper-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-60", disabled: status === "loading", children: status === "loading" ? "Signing in..." : "Login" }), error ? _jsx("p", { className: "mt-3 text-sm text-casper-red", children: error }) : null, _jsx("p", { className: "mt-4 text-xs text-slate-500", children: "Demo: admin@casper.gov.in / CasperAdmin@2024" })] }) }));
};
