import axios from "axios";
import httpStatus from "http-status";
import { createContext, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext({});

const client = axios.create({
  baseURL: `${server}/api/v1`,
});

let onUnauthorized = () => {};

// Send the token on every request; drop an expired/invalid one.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthForm = url.endsWith("/login") || url.endsWith("/register");
    if (error.response?.status === httpStatus.UNAUTHORIZED && !isAuthForm) {
      onUnauthorized(Boolean(error.config?.skipRedirect));
    }
    return Promise.reject(error);
  },
);

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);

  const router = useNavigate();

  // The API client (module level) calls this when the server says our token is no longer valid.
  useEffect(() => {
    onUnauthorized = (skipRedirect) => {
      localStorage.removeItem("token");
      setUserData(null);
      if (!skipRedirect) router("/auth");
    };
    return () => {
      onUnauthorized = () => {};
    };
  }, [router]);

  const handleRegister = async (name, username, password) => {
    const request = await client.post("/users/register", {
      name,
      username,
      password,
    });
    if (request.status === httpStatus.CREATED) {
      return request.data.message;
    }
  };

  const handleLogin = async (username, password) => {
    const request = await client.post("/users/login", { username, password });
    if (request.status === httpStatus.OK) {
      localStorage.setItem("token", request.data.token);
      setUserData(request.data.user);
      router("/home");
    }
  };

  const handleLogout = async () => {
    try {
      await client.post("/users/logout");
    } catch {
      /* token already invalid - nothing to revoke */
    }
    localStorage.removeItem("token");
    setUserData(null);
    router("/auth");
  };

  // silent = don't redirect to the login page on 401 (used by the meeting room,
  // where an expired login should simply fall back to joining as a guest)
  const getMe = useCallback(async (silent = false) => {
    const { data } = await client.get("/users/me", { skipRedirect: silent });
    setUserData(data);
    return data;
  }, []);

  const updateProfile = async (name) => {
    const { data } = await client.put("/users/me", { name });
    setUserData(data);
    return data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const { data } = await client.put("/users/me/password", {
      currentPassword,
      newPassword,
    });
    return data.message;
  };

  const getHistoryOfUser = async () => {
    const request = await client.get("/users/get_all_activity");
    return request.data;
  };

  const addToUserHistory = async (meetingCode) => {
    return client.post("/users/add_to_activity", { meeting_code: meetingCode });
  };

  /* ----- meetings ----- */
  const createMeeting = async () => {
    const { data } = await client.post("/meetings");
    return data.code;
  };
  const getMeeting = async (code) => {
    const { data } = await client.get(`/meetings/${encodeURIComponent(code)}`);
    return data;
  };

  /* ----- contacts ----- */
  const getContacts = async () => (await client.get("/users/contacts")).data;
  const searchUsers = async (q) =>
    (await client.get("/users/search", { params: { q } })).data;
  const addContact = async (username) =>
    (await client.post("/users/contacts", { username })).data;
  const removeContact = async (username) =>
    client.delete(`/users/contacts/${encodeURIComponent(username)}`);

  const data = {
    userData,
    setUserData,
    addToUserHistory,
    getHistoryOfUser,
    handleRegister,
    handleLogin,
    handleLogout,
    getMe,
    updateProfile,
    changePassword,
    createMeeting,
    getMeeting,
    getContacts,
    searchUsers,
    addContact,
    removeContact,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
