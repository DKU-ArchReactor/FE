import apiConfig from "@/api/config";
import type { BuildCompileRequest } from "@/type/Build";

export const compileCode = async (data: BuildCompileRequest) => {
    const response = await apiConfig.post('/api/v1/build/compile', data);
    return response.data;
};
