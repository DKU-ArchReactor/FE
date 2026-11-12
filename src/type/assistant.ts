export interface ExecutionReference {
  execution_id: string;
  result_version: string;
  artifact_sha256: string;
  mode: "single" | "pipeline";
  cycle: number;
}
export interface ExecutionContext extends ExecutionReference {
  memory_addresses: number[];
}
export type ExecutionDescriptor =
  | (Omit<ExecutionReference, "cycle"> & {
      available: true;
      cycle_min: number;
      cycle_max: number;
      expires_at: string;
    })
  | { available: false; code: string };
