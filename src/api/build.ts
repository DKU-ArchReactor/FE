import { seedTutor } from "@/pages/Main/utils/tutorAnalysis";
import apiConfig from "@/api/config";
import type { BasicCValidation, BuildCompileRequest, BuildCompileResponse, BuildLog } from "@/type/build";

/** Same admission policy used by compilation; never compiles or stores the example. */
export const validateBasicC = async (content: string, signal?: AbortSignal): Promise<BasicCValidation> => {
    try {
        const { data } = await apiConfig.post<BasicCValidation>('/api/v1/build/validate-c', { content }, { signal, timeout: 10000 });
        if (data.policy !== 'basic-c-v1' || typeof data.valid !== 'boolean' || !Array.isArray(data.diagnostics)
            || (data.valid && data.diagnostics.length > 0)) throw new Error('Invalid validation response');
        return data;
    } catch {
        throw new Error('C 코드 지원 범위를 확인하지 못해 적용하지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }
};

export const compileCode = async (data: BuildCompileRequest, signal?: AbortSignal): Promise<BuildCompileResponse> => {
    const response = await apiConfig.post<BuildCompileResponse>('/api/v1/build/compile', data, { signal });
    seedTutor(response.data.tutor);
    return response.data;
};

export const getBuildLog = async (buildId: string, signal?: AbortSignal): Promise<BuildLog> => {
    const response = await apiConfig.get<BuildLog>('/api/v1/build/logs', { params: { build_id: buildId }, signal });
    return response.data;
};
