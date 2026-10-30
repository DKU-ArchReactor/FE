import apiConfig from "@/api/config";
import type { BuildCompileRequest, BuildCompileResponse } from "@/type/build";

export const compileCode = async (data: BuildCompileRequest): Promise<BuildCompileResponse> => {
    const response = await apiConfig.post<BuildCompileResponse>('/api/v1/build/compile', data);
    return response.data;
};
