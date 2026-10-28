import axios from "axios";

const apiConfig = axios.create({
    baseURL: '',
    headers: { "Content-Type": "application/json" }
});

export default apiConfig;
