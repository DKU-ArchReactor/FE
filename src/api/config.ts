import axios from "axios";
import { getAccessToken } from "@/api/authSession";

const apiConfig = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: { "Content-Type": "application/json" }
});

apiConfig.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiConfig;
