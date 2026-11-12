import { seedTutor } from "@/pages/Main/utils/tutorAnalysis";
import apiConfig from "@/api/config";
import type { BuildCompileRequest, BuildCompileResponse } from "@/type/build";

export const compileCode = async (data: BuildCompileRequest, signal?: AbortSignal): Promise<BuildCompileResponse> => {
    const response = await apiConfig.post<BuildCompileResponse>('/api/v1/build/compile', data, { signal });
    seedTutor(response.data.tutor);
    return response.data;
};
