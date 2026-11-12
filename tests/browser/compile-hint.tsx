import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MainPage from '../../src/pages/Main';
import { ThemeProvider } from '../../src/context/ThemeContext';
import apiConfig from '../../src/api/config';
import single from './fixtures/single.json';
import pipeline from './fixtures/pipeline.json';
import '../../src/index.css';

// All application requests are local mocks; no backend or SOLID calls.
let failBuild = false;
apiConfig.defaults.adapter = async config => {
  let data: unknown;
  if (config.url === '/api/v1/build/compile') {
    data = failBuild ? { status: 'failed', log: '테스트 컴파일 실패' }
      : { status: 'success', build_id: 'local-compile-hint' };
  } else if (config.url === '/api/v1/simulation/run') {
    data = JSON.parse(config.data).mode === 'single' ? single : pipeline;
  } else if (config.url?.startsWith('/api/v1/files')) {
    data = [];
  } else {
    throw new Error(`Local fixture blocks request: ${config.url}`);
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
window.fetch = async input => {
  if (String(input).endsWith('/assistant/status')) {
    return Response.json({ enabled: false, code: 'LOCAL_FIXTURE' });
  }
  throw new Error('Local fixture blocks external requests');
};

createRoot(document.getElementById('root')!).render(
  <div className="flex h-screen flex-col">
    <div className="p-2 text-sm shrink-0 bg-white">
      컴파일 안내 검증 · 모의 API
      <label className="ml-4"><input type="checkbox" onChange={event => { failBuild = event.target.checked; }} /> 컴파일 실패 재현</label>
    </div>
    <ThemeProvider><MemoryRouter initialEntries={['/simulator?example=addition']}><MainPage /></MemoryRouter></ThemeProvider>
  </div>,
);
