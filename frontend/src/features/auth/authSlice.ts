import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  status: "idle" | "loading" | "failed";
  error: string | null;
};

type LoginPayload = { email: string; password: string };
type RegisterPayload = { name: string; email: string; password: string; organization: string };

const tokenKey = "casper_access_token";
const refreshTokenKey = "casper_refresh_token";
const userKey = "casper_user";

const initialState: AuthState = {
  accessToken: localStorage.getItem("casper_access_token") ?? null,
  refreshToken: localStorage.getItem("casper_refresh_token") ?? null,
  user: (() => {
    try {
      const u = localStorage.getItem("casper_user");
      return u ? (JSON.parse(u) as AuthUser) : null;
    } catch {
      return null;
    }
  })(),
  isAuthenticated: !!localStorage.getItem("casper_access_token"),
  status: "idle",
  error: null
};

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (payload: LoginPayload, { rejectWithValue }) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as {
      success: boolean;
      data?: { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
      error?: { message: string };
    };

    if (!response.ok || !json.success || !json.data) {
      return rejectWithValue(json.error?.message ?? "Login failed");
    }

    return {
      user: json.data.user,
      accessToken: json.data.tokens.accessToken,
      refreshToken: json.data.tokens.refreshToken
    };
  }
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (payload: RegisterPayload, { rejectWithValue }) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as {
      success: boolean;
      data?: { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
      error?: { message: string };
    };

    if (!response.ok || !json.success || !json.data) {
      return rejectWithValue(json.error?.message ?? "Registration failed");
    }

    return {
      user: json.data.user,
      accessToken: json.data.tokens.accessToken,
      refreshToken: json.data.tokens.refreshToken
    };
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: AuthUser; accessToken: string; refreshToken: string }>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem(tokenKey, action.payload.accessToken);
      localStorage.setItem(refreshTokenKey, action.payload.refreshToken);
      localStorage.setItem(userKey, JSON.stringify(action.payload.user));
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem(tokenKey, action.payload);
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(refreshTokenKey);
      localStorage.removeItem(userKey);
    },
    setStatus: (state, action: PayloadAction<AuthState["status"]>) => {
      state.status = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = "idle";
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        localStorage.setItem(tokenKey, action.payload.accessToken);
        localStorage.setItem(refreshTokenKey, action.payload.refreshToken);
        localStorage.setItem(userKey, JSON.stringify(action.payload.user));
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = String(action.payload ?? "Login failed");
      })
      .addCase(registerThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.status = "idle";
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        localStorage.setItem(tokenKey, action.payload.accessToken);
        localStorage.setItem(refreshTokenKey, action.payload.refreshToken);
        localStorage.setItem(userKey, JSON.stringify(action.payload.user));
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = String(action.payload ?? "Registration failed");
      });
  }
});

export const { setCredentials, setAccessToken, clearCredentials, setStatus } = authSlice.actions;
export default authSlice.reducer;
