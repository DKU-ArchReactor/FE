import axios from "axios";
import type { ValidationErrorResponse } from "@/type/auth";

export function parseApiError(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError<ValidationErrorResponse>(error)) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg).join(", ");
    }
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    return fallbackMessage;
  }
  return "서버와 통신 중 오류가 발생했습니다.";
}
