export type CField = { name: string; type: string; pointer: boolean; array: string; line: number };
export type CStruct = { name: string; line: number; fields: CField[]; instances: string[] };
export type CArray = { name: string; type: string; dimensions: string[]; line: number };
export type CPointerLink = { from: string; field: string; to: string; line: number };
export type CStructure = { structs: CStruct[]; arrays: CArray[]; links: CPointerLink[] };

function maskCommentsAndLiterals(source: string): string {
  const chars = [...source];
  let mode: 'code' | 'line' | 'block' | 'string' | 'char' = 'code';
  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];
    if (mode === 'code') {
      if (current === '/' && next === '/') { chars[i] = chars[i + 1] = ' '; i += 1; mode = 'line'; }
      else if (current === '/' && next === '*') { chars[i] = chars[i + 1] = ' '; i += 1; mode = 'block'; }
      else if (current === '"' || current === "'") { chars[i] = ' '; mode = current === '"' ? 'string' : 'char'; }
    } else if (mode === 'line') {
      if (current === '\n') mode = 'code'; else chars[i] = ' ';
    } else if (mode === 'block') {
      if (current === '*' && next === '/') { chars[i] = chars[i + 1] = ' '; i += 1; mode = 'code'; }
      else if (current !== '\n') chars[i] = ' ';
    } else if (current === '\\' && i + 1 < chars.length) {
      chars[i] = ' ';
      if (chars[i + 1] !== '\n') chars[i + 1] = ' ';
      i += 1;
    } else if ((mode === 'string' && current === '"') || (mode === 'char' && current === "'")) {
      chars[i] = ' ';
      mode = 'code';
    } else if (current !== '\n') chars[i] = ' ';
  }
  return chars.join('');
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '{') braces += 1;
    else if (char === '}') braces -= 1;
    else if (char === '[') brackets += 1;
    else if (char === ']') brackets -= 1;
    else if (char === '(') parens += 1;
    else if (char === ')') parens -= 1;
    else if (char === ',' && braces === 0 && brackets === 0 && parens === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

function initializerValues(initializer: string | undefined): string[] {
  if (!initializer) return [];
  const body = initializer.trim().replace(/^\{/, '').replace(/\}$/, '');
  return splitTopLevel(body).map(item => item.replace(/^\.\w+\s*=\s*/, '').trim());
}

/** Reads explicit aggregate declarations. It deliberately does not interpret runtime pointer state. */
export function analyzeCStructures(source: string): CStructure {
  const masked = maskCommentsAndLiterals(source);
  const structs: CStruct[] = [];
  const ranges: Array<[number, number]> = [];
  const definitions = /\bstruct\s+([A-Za-z_]\w*)\s*\{/g;
  let definition: RegExpExecArray | null;

  while ((definition = definitions.exec(masked)) !== null) {
    const open = masked.indexOf('{', definition.index);
    let depth = 1;
    let close = open + 1;
    for (; close < masked.length && depth > 0; close += 1) {
      if (masked[close] === '{') depth += 1;
      if (masked[close] === '}') depth -= 1;
    }
    if (depth !== 0) continue;
    const bodyEnd = close - 1;
    const fields: CField[] = [];
    const body = masked.slice(open + 1, bodyEnd);
    let cursor = 0;
    for (const segment of body.split(';')) {
      const clean = segment.trim();
      if (!clean) { cursor += segment.length + 1; continue; }
      const declarators = splitTopLevel(clean);
      const sharedType = declarators[0]?.match(/^([\w\s]+\*?\s*)\*?\s*[A-Za-z_]\w*\s*(?:\[[^\]]*\])?$/)?.[1]?.trim() || '';
      for (const [index, declarator] of declarators.entries()) {
        const prefix = index === 0 ? '' : declarators.slice(0, index).join(',') + ',';
        const original = (prefix + declarator).trim();
        const name = declarator.match(/([A-Za-z_]\w*)\s*((?:\[[^\]]*\]\s*)*)$/);
        if (!name || /^\s*(?:return|case|break)\b/.test(original)) continue;
        const fieldName = name[1];
        const array = name[2].trim().replace(/\s+/g, '');
        const localPrefix = declarator.slice(0, name.index).trim();
        const fieldType = localPrefix || (sharedType ? `${sharedType}${declarator.trim().startsWith('*') ? ' *' : ''}` : '');
        if (!fieldType) continue;
        fields.push({ name: fieldName, type: fieldType, pointer: /\*/.test(fieldType), array, line: lineAt(source, open + 1 + cursor) });
      }
      cursor += segment.length + 1;
    }
    structs.push({ name: definition[1], line: lineAt(source, definition.index), fields, instances: [] });
    ranges.push([definition.index, close]);
    definitions.lastIndex = close;
  }

  const declarationChars = [...masked];
  for (const [start, end] of ranges) for (let i = start; i < end; i += 1) if (declarationChars[i] !== '\n') declarationChars[i] = ' ';
  const declarations = declarationChars.join('');
  const links: CPointerLink[] = [];

  for (const type of structs) {
    const instances: Array<{ name: string; initializer: string | undefined; line: number }> = [];
    const pattern = new RegExp(`^[\\t ]*(?:(?:static|const|volatile|register|auto|extern)\\s+)*struct\\s+${type.name}\\s+([^;]+);`, 'gm');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(declarations)) !== null) {
      for (const declarator of splitTopLevel(match[1])) {
        const item = declarator.match(/^\s*\**\s*([A-Za-z_]\w*)\s*(?:\[\s*[^\]]*\s*\]\s*)*(?:=\s*([\s\S]*))?$/);
        if (!item) continue;
        instances.push({ name: item[1], initializer: item[2], line: lineAt(source, match.index) });
      }
    }
    type.instances = instances.map(instance => instance.name);
    for (const instance of instances) {
      const values = initializerValues(instance.initializer);
      const assigned = new Map<string, string>();
      values.forEach((value, index) => {
        const named = value.match(/^\.(\w+)\s*=\s*(.*)$/);
        const field = named ? type.fields.find(candidate => candidate.name === named[1]) : type.fields[index];
        const target = value.match(/^&\s*([A-Za-z_]\w*)\s*$/);
        if (field?.pointer && target) assigned.set(field.name, target[1]);
      });
      for (const [field, to] of assigned) {
        if (instances.some(candidate => candidate.name === to)) links.push({ from: instance.name, field, to, line: instance.line });
      }
    }
  }

  const arrays: CArray[] = [];
  const arrayPattern = /^[\t ]*(?:(?:static|const|volatile|unsigned|signed|long|short|register|auto)\s+)*(?:struct\s+[A-Za-z_]\w*|[A-Za-z_]\w*(?:\s*\*+)?)\s+[*\s]*([A-Za-z_]\w*)\s*((?:\[\s*[^\]\n]*\s*\]\s*)+)(?:=\s*[^;\n]*)?;/gm;
  let arrayMatch: RegExpExecArray | null;
  while ((arrayMatch = arrayPattern.exec(declarations)) !== null) {
    const declaration = arrayMatch[0].trim();
    const typeName = declaration.match(/(?:struct\s+[A-Za-z_]\w*|[A-Za-z_]\w*(?:\s*\*+)?)\s+[*\s]*[A-Za-z_]\w*/)?.[0] || 'array';
    arrays.push({ name: arrayMatch[1], type: typeName.replace(/\s+[A-Za-z_]\w*$/, '').trim(), dimensions: [...arrayMatch[2].matchAll(/\[\s*([^\]]*)\s*\]/g)].map(item => item[1].trim() || '?'), line: lineAt(source, arrayMatch.index) });
  }

  return { structs, arrays, links };
}
