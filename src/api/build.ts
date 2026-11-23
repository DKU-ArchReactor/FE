import { seedTutor } from "@/api/tutorCache";
import apiConfig from "@/api/config";
import type { BuildCompileRequest, BuildCompileResponse, BuildLog } from "@/type/build";

export const compileCode = async (data: BuildCompileRequest, signal?: AbortSignal): Promise<BuildCompileResponse> => {
    const response = await apiConfig.post<BuildCompileResponse>('/api/v1/build/compile', data, { signal });
    seedTutor(response.data.tutor);
    return response.data;
};

export const getBuildLog = async (buildId: string, signal?: AbortSignal): Promise<BuildLog> => {
    const response = await apiConfig.get<BuildLog>('/api/v1/build/logs', { params: { build_id: buildId }, signal });
    return response.data;
};
