import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const storage = new Map([
  ["archreactor.translation.source", "int main(void) { return 99; }"],
]);
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.localStorage = { getItem: () => null };

try {
  const { getPreviewState } = await server.ssrLoadModule(
    "/src/pages/Landing/previewState.ts",
  );
  const { learningExamples, getLearningExample } = await server.ssrLoadModule(
    "/src/data/learningExamples.ts",
  );
  const { useFileManager } = await server.ssrLoadModule(
    "/src/pages/Main/hooks/useFileManager.ts",
  );
  const { default: LandingPage } = await server.ssrLoadModule(
    "/src/pages/Landing/index.tsx",
  );

  assert.deepEqual(getPreviewState("single", 0).values, [0, 0, 0]);
  assert.deepEqual(getPreviewState("single", 3).values, [5, 3, 8]);
  assert.equal(getPreviewState("single", 3).stored, false);
  assert.equal(getPreviewState("single", 4).stored, true);
  assert.deepEqual(getPreviewState("pipeline", 4).values, [0, 0, 0]);
  assert.deepEqual(getPreviewState("pipeline", 5).values, [5, 0, 0]);
  assert.deepEqual(getPreviewState("pipeline", 6).values, [5, 3, 0]);
  assert.deepEqual(getPreviewState("pipeline", 7).values, [5, 3, 8]);
  assert.equal(getPreviewState("pipeline", 7).stored, true);
  assert.equal(getPreviewState("pipeline", 8).completed, 4);
  for (const mode of ["single", "pipeline"]) {
    for (let clock = 0; clock <= getPreviewState(mode, 0).maxClock; clock++) {
      assert.ok(getPreviewState(mode, clock).explanation);
    }
  }
  assert.equal(getLearningExample("unknown"), undefined);
  assert.equal(getLearningExample(null), undefined);

  function Capture({ example }) {
    const manager = useFileManager(null, example);
    return React.createElement(
      "pre",
      null,
      encodeURIComponent(
        JSON.stringify({
          source: manager.translationSource,
          content: manager.cContent,
          fileName: manager.cFileName,
          fileId: manager.fileId,
        }),
      ),
    );
  }
  for (const example of learningExamples) {
    const html = renderToStaticMarkup(
      React.createElement(Capture, { example }),
    );
    const state = JSON.parse(decodeURIComponent(html.slice(5, -6)));
    assert.equal(state.fileName, example.fileName);
    assert.equal(state.source, example.source);
    assert.equal(state.content, example.source);
    assert.equal(state.fileId, null);
    assert.equal(
      storage.get("archreactor.translation.source"),
      "int main(void) { return 99; }",
    );
  }
  const resumed = renderToStaticMarkup(React.createElement(Capture, {}));
  assert.equal(
    JSON.parse(decodeURIComponent(resumed.slice(5, -6))).source,
    "int main(void) { return 99; }",
  );

  const html = renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(LandingPage)),
  );
  for (const example of learningExamples)
    assert.ok(html.includes(`/simulator?example=${example.id}`));
  assert.ok(html.includes("실제 작업 화면 불러오기"));
  assert.equal(
    html.includes("<iframe"),
    false,
    "The real workspace must wait for an explicit click.",
  );
  assert.ok(html.includes("재생 버튼을 눌러 보세요"));
  console.log(
    "Landing checks passed: preview states, example entry, draft preservation, example links, and deferred workspace loading.",
  );
  if (process.argv.includes("--examples"))
    console.log(
      JSON.stringify(
        learningExamples.map(({ id, source, result }) => ({
          id,
          source,
          result,
        })),
      ),
    );
} finally {
  await server.close();
}
