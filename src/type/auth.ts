export interface SignupRequest {
    user_id: string;
    email: string;
    password: string;
    name: string;
}

export interface SignupResponse {
    user_id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
}

export type UserMeResponse = SignupResponse;

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface ValidationErrorDetail {
    loc: (string | number)[];
    msg: string;
    type: string;
}

export interface ValidationErrorResponse {
    detail?: ValidationErrorDetail[] | string;
}

