import apiConfig from "@/api/config";
import type {
    SignupRequest,
    SignupResponse,
    LoginRequest,
    LoginResponse,
    UserMeResponse,
} from "@/type/auth";

export const signup = async (data: SignupRequest): Promise<SignupResponse> => {
    const response = await apiConfig.post<SignupResponse>("/auth/signup", data);
    return response.data;
};

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiConfig.post<LoginResponse>("/auth/login", data);
    return response.data;
};

export const getMe = async (): Promise<UserMeResponse> => {
    const response = await apiConfig.get<UserMeResponse>("/auth/me");
    return response.data;
};

