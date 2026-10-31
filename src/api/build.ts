import apiConfig from "@/api/config";
import type { BuildCompileRequest } from "@/type/build";

export const compileCode = async (data: BuildCompileRequest, signal?: AbortSignal) => {
    const response = await apiConfig.post('/api/v1/build/compile', data, { signal });
    return response.data;
};
