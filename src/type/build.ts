import type { TutorBundle } from "@/pages/Main/utils/tutorAnalysis";
export interface SourceDiagnostic {
    code: string;
    message: string;
    line: number;
    column: number;
}

export interface BasicCValidation {
    policy: 'basic-c-v1';
    valid: boolean;
    diagnostics: SourceDiagnostic[];
}
export interface BuildCompileRequest {
    file_id?: string;
    content?: string;
    lang?: string;
    compile_profile?: string;
    compiler_opt?: string;
}

export interface BuildCompileResponse {
    diagnostics?: SourceDiagnostic[];
    analysis?: BuildAnalysis | null;
    analysis_error?: string | null;
    tutor?: TutorBundle | null;
    build_id: string | null;
    status: string;
    assembly_url?: string | null;
    binary_url?: string | null;
    log: string;
    simulation_token?: string | null;
    simulation_token_expires_in?: number | null;
}

export interface BuildAnalysis {
  disassembly: string;
  instructions: { pc: string; assembly: string; source_line: number | null; source_file?: string | null }[];
  source_map: Record<string, string[]>;
  sections: { name: string; size: number; address: string }[];
  mapping_available: boolean;
}
export interface BuildLog {
  build_id: string;
  log: string;
  stdout: string | null;
  stderr: string | null;
  streams_available: boolean;
}
