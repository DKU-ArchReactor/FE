import { parser } from '@lezer/cpp';
import type { SyntaxNode } from '@lezer/common';
export type CField = { name: string; type: string; pointer: boolean; array: string; line: number };
export type CStruct = { name: string; line: number; fields: CField[]; instances: string[] };
export type CArray = { name: string; type: string; dimensions: string[]; line: number; container?: { kind: 'stack' | 'queue'; primary: string; secondary?: string } };
export type CPointerLink = { from: string; field: string; to: string; line: number };
export type CFunction = { name: string; line: number; end: number };
export type CStructure = { structs: CStruct[]; arrays: CArray[]; links: CPointerLink[]; functions: CFunction[]; diagnostics: string[] };
function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}
function find(node: SyntaxNode, names: string[]): SyntaxNode | undefined {
  if (names.includes(node.name)) return node;
  for (const child of children(node)) { const match = find(child, names); if (match) return match; }
}
export function analyzeCStructures(source: string): CStructure {
  const tree = parser.parse(source);
  const text = (node: SyntaxNode) => source.slice(node.from, node.to);
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  const line = (offset: number) => { let lo = 0, hi = starts.length; while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; } return lo + 1; };
  const nodes: SyntaxNode[] = [];
  tree.iterate({ enter(ref) { nodes.push(ref.node); } });
  const diagnostics = [...new Set(nodes.filter(node => node.type.isError).map(node => `C ${line(node.from)}행: 구문을 완전히 분석하지 못했습니다. 컴파일 결과를 확인하세요.`))].slice(0, 8);
  if (/^\s*#\s*(?:if|ifdef|ifndef|define|include)\b/m.test(source)) diagnostics.push('전처리 전 소스를 분석합니다. 매크로 확장과 조건부 선언은 컴파일 결과와 다를 수 있습니다.');
  const aliases = new Map<string, string>();
  const structs: CStruct[] = [];
  const structNames = new Map<number, string>();
  const functions: CFunction[] = [];
  const kinds = ['Identifier', 'FieldIdentifier', 'PointerDeclarator', 'ArrayDeclarator', 'ParenthesizedDeclarator', 'InitDeclarator'];
  const baseType = (node: SyntaxNode) => children(node).find(child => ['PrimitiveType', 'TypeIdentifier', 'SizedTypeSpecifier', 'StructSpecifier', 'EnumSpecifier'].includes(child.name));
  const dimensions = (node: SyntaxNode): string[] => {
    if (node.name === 'InitDeclarator') return dimensions(node.firstChild!);
    if (node.name !== 'ArrayDeclarator') return [];
    const parts = children(node); const open = parts.findIndex(child => child.name === '[');
    return [...dimensions(parts[0]), parts.slice(open + 1).filter(child => child.name !== ']').map(text).join('') || '?'];
  };
  for (const node of nodes.filter(node => node.name === 'StructSpecifier' && node.getChild('FieldDeclarationList'))) {
    const alias = node.parent?.name === 'TypeDefinition' ? children(node.parent).filter(child => child.name === 'TypeIdentifier').at(-1) : undefined;
    const name = node.getChild('TypeIdentifier') ? text(node.getChild('TypeIdentifier')!) : alias ? text(alias) : `익명 구조체@${line(node.from)}`;
    structNames.set(node.from, name);
    const fields: CField[] = [];
    for (const declaration of children(node.getChild('FieldDeclarationList')!).filter(child => child.name === 'FieldDeclaration')) {
      const base = baseType(declaration); if (!base) continue;
      for (const item of children(declaration).filter(child => kinds.includes(child.name))) {
        const id = find(item, ['FieldIdentifier', 'Identifier']); if (!id) continue;
        const prefix = source.slice(item.from, id.from);
        fields.push({ name: text(id), type: `${text(base)}${prefix.includes('*') ? ' *' : ''}`, pointer: prefix.includes('*'), array: dimensions(item).map(size => `[${size}]`).join(''), line: line(id.from) });
      }
    }
    structs.push({ name, line: line(node.from), fields, instances: [] });
  }
  for (const node of nodes.filter(node => node.name === 'TypeDefinition')) {
    const base = baseType(node);
    const alias = children(node).filter(child => child.name === 'TypeIdentifier' && child.from !== base?.from).at(-1);
    if (base && alias) aliases.set(text(alias), structNames.get(base.from) || text(base).replace(/^struct\s+/, ''));
  }
  const resolve = (input: string): string => { let name = input; const visited = new Set<string>(); while (aliases.has(name) && !visited.has(name)) { visited.add(name); name = aliases.get(name)!; } return name; };
  for (const node of nodes.filter(node => node.name === 'FunctionDefinition')) {
    const id = find(node.getChild('FunctionDeclarator') || node, ['Identifier']);
    if (id) functions.push({ name: text(id), line: line(node.from), end: line(node.to) });
  }
  const arrays: CArray[] = [];
  const objects: { name: string; type: CStruct; initializer?: SyntaxNode; line: number; scope: string }[] = [];
  for (const node of nodes.filter(node => node.name === 'Declaration')) {
    const base = baseType(node); if (!base) continue;
    const baseName = resolve(structNames.get(base.from) || text(base).replace(/^struct\s+/, ''));
    const scope = functions.find(fn => line(node.from) >= fn.line && line(node.from) <= fn.end)?.name || '<global>';
    for (const item of children(node).filter(child => kinds.includes(child.name))) {
      const id = find(item, ['Identifier']); if (!id) continue;
      const name = text(id); const sizes = dimensions(item);
      if (sizes.length) arrays.push({ name, type: text(base), dimensions: sizes, line: line(id.from) });
      const type = structs.find(candidate => candidate.name === baseName);
      if (type && !source.slice(item.from, id.from).includes('*') && !sizes.length) {
        type.instances.push(name);
        objects.push({ name, type, initializer: item.name === 'InitDeclarator' ? children(item).at(-1) : undefined, line: line(id.from), scope });
      }
    }
  }
  for (const array of arrays) {
    const escaped = array.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\s*\\[\\s*(?:\\+\\+\\s*top|top\\s*\\+\\+|top\\s*[-+]\\s*1|top)\\s*\\]`).test(source) && /\btop\b/.test(source)) {
      array.container = { kind: 'stack', primary: 'top' };
    } else if (new RegExp(`\\b${escaped}\\s*\\[\\s*(?:front|rear)\\s*\\]`).test(source) && /\bfront\b/.test(source) && /\brear\b/.test(source)) {
      array.container = { kind: 'queue', primary: 'front', secondary: 'rear' };
    }
  }
  const links: CPointerLink[] = [];
  for (const object of objects) {
    if (object.initializer?.name !== 'InitializerList') continue;
    const values = children(object.initializer).filter(child => !['{', '}', ','].includes(child.name));
    let position = 0;
    for (const value of values) {
      const designated = value.name === 'InitializerPair' ? find(value, ['FieldIdentifier']) : undefined;
      const index = designated ? object.type.fields.findIndex(field => field.name === text(designated)) : position;
      position = index + 1;
      const field = object.type.fields[index];
      const expression = value.name === 'InitializerPair' ? children(value).at(-1)! : value;
      const target = text(expression).match(/^&\s*([A-Za-z_]\w*)$/);
      if (field?.pointer && target && objects.some(candidate => candidate.name === target[1] && (candidate.scope === object.scope || candidate.scope === '<global>'))) links.push({ from: object.name, field: field.name, to: target[1], line: object.line });
    }
  }
  return { structs, arrays, links, functions, diagnostics };
}
