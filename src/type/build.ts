export interface BuildCompileRequest {
    file_id?: string;
    content?: string;
    lang?: string;
    compile_profile?: string;
    compiler_opt?: string;
}

export interface BuildCompileResponse {
    build_id: string | null;
    status: string;
    assembly_url: string;
    binary_url: string;
    log: string;
    simulation_token?: string | null;
    simulation_token_expires_in?: number | null;
}
