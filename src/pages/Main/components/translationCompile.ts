import { compileCode } from "@/api/build";

export type MappedAssemblyRow = { sourceLine: number; text: string };

export async function compileTranslation(source: string): Promise<string> {
  const result = await compileCode({
    content: source,
    lang: "c",
    compile_profile: "rv32im",
    compiler_opt: "-O0 -g",
  });
  if (result.status !== "success") {
    throw new Error(result.log || "컴파일에 실패했습니다.");
  }
  if (!result.assembly_url) throw new Error("어셈블리 결과를 찾을 수 없습니다.");

  const response = await fetch(result.assembly_url);
  if (!response.ok) throw new Error(`어셈블리 파일을 불러오지 못했습니다. (HTTP ${response.status})`);
  return response.text();
}

export function mapAssembly(assembly: string, sourceLineCount: number): MappedAssemblyRow[] {
  const sourceFiles = new Map<number, string>();
  let sourceLine: number | null = null;
  let executable = false;
  const mapped: MappedAssemblyRow[] = [];

  for (const raw of assembly.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const file = line.match(/^\.file\s+(\d+)\s+(.+)$/);
    if (file) {
      const names = [...file[2].matchAll(/"((?:\\.|[^"\\])*)"/g)];
      const name = names.at(-1)?.[1];
      if (name) sourceFiles.set(Number(file[1]), name.replace(/\\\\/g, "/").split("/").at(-1) || name);
      continue;
    }
    const section = line.match(/^\.(?:section\s+)?([^\s,]+)/);
    if (section && (section[1] === ".text" || section[1].startsWith(".text."))) {
      executable = true;
      sourceLine = null;
      continue;
    }
    if (/^\.(?:data|bss|rodata)\b/.test(line)) {
      executable = false;
      sourceLine = null;
      continue;
    }
    const location = line.match(/^\.loc\s+(\d+)\s+(\d+)\b/);
    if (location) {
      const candidate = Number(location[2]);
      sourceLine = sourceFiles.get(Number(location[1])) === "source.c" && candidate > 0 && candidate <= sourceLineCount ? candidate : null;
      continue;
    }
    if (!executable || !line || line.startsWith(".")) continue;
    if (/^[.$\w]+:$/.test(line)) continue;
    if (/^[a-zA-Z][\w.]*\s*[^=]*$/.test(line) && sourceLine !== null) {
      mapped.push({ sourceLine, text: line });
    }
  }
  return mapped;
}
