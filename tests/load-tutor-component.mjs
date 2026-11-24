import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';

// Exercise evidence builders without mounting the interactive detail reader.
export function loadTutor(file,{details=true}={}){
  const native=createRequire(import.meta.url);
  const modules=new Map();
  function load(filename){
    if(modules.has(filename))return modules.get(filename);
    const exports={};modules.set(filename,exports);
    const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const require=id=>{
      if(id.endsWith('TutorDetailPages'))return {default:({title,pages})=>createElement('section',null,title,details?JSON.stringify(typeof pages==='function'?pages():pages):null)};
      if(id.endsWith('.css'))return {};
      if(id.startsWith('.')){const base=path.resolve(path.dirname(filename),id);const target=['.ts','.tsx'].map(ext=>base+ext).find(existsSync);if(target)return load(target);}
      return native(id);
    };
    vm.runInNewContext(source,{exports,require});return exports;
  }
  return load(path.resolve('src/pages/Main/components',file));
}
