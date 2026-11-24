import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import BuildStatusBar from '../../src/pages/Main/components/BuildStatusBar';
import apiConfig from '../../src/api/config';
import type { BuildCompileResponse } from '../../src/type/build';
import '../../src/index.css';
apiConfig.defaults.adapter = async config => {
  if (config.url !== '/api/v1/build/logs') throw new Error('Unexpected fixture request');
  return {data:{build_id:'saved',log:'old combined log',stdout:'compiler output',stderr:'compiler warning',streams_available:config.params.build_id === 'saved'},status:200,statusText:'OK',headers:{},config};
};
function Harness() {
  const [result,setResult] = useState<BuildCompileResponse|null>({status:'success',build_id:'saved',log:'inline log',analysis_error:'inspection unavailable'});
  return <><button onClick={()=>setResult({status:'failed',build_id:null,log:'syntax failure'})}>Failed build</button><button onClick={()=>setResult({status:'success',build_id:'legacy',log:'legacy inline'})}>Legacy build</button><BuildStatusBar result={result} busy={false} hasSimulation={false}/></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
