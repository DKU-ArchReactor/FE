export interface FileSummary {
    file_id: string;
    title: string;
    lang: string;
    updated_at: string;
}

export interface FileSaveRequest {
    title: string;
    content: string;
    lang: string;
}

export interface FileDetail {
    file_id: string;
    title: string;
    lang: string;
    content: string;
    updated_at: string;
}

