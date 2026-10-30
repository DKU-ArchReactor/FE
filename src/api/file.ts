import apiConfig from "@/api/config";
import type { FileSummary, FileSaveRequest, FileDetail } from "@/type/file";

export const getFiles = async (): Promise<FileSummary[]> => {
    const response = await apiConfig.get<FileSummary[]>("/api/v1/files");
    return response.data;
};

export const saveFile = async (data: FileSaveRequest): Promise<FileDetail> => {
    const response = await apiConfig.post<FileDetail>("/api/v1/files", data);
    return response.data;
};

export const getFileById = async (fileId: string): Promise<FileDetail> => {
    const response = await apiConfig.get<FileDetail>(`/api/v1/files/${fileId}`);
    return response.data;
};

export const deleteFile = async (fileId: string): Promise<void> => {
    await apiConfig.delete(`/api/v1/files/${fileId}`);
};

