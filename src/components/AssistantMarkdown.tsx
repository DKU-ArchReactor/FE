import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './AssistantMarkdown.css';

// SOLID also emits LaTeX delimiters. Preserve code (including unfinished fences
// during streaming) instead of interpreting code examples as formulas.
function normalizeMathDelimiters(text: string): string {
  return text.replace(
    /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[^\S\n]*(?=\n|$)|$(?![\s\S])))|(`+)[^`]*?\3|\\\[([\s\S]*?)\\\]|\\\(([^\n]*?)\\\)/gm,
    (match, fence, _marker, inlineCode, displayMath, inlineMath) => {
      if (fence || inlineCode) return match;
      if (displayMath !== undefined) return `\n\n$$\n${displayMath.trim()}\n$$\n\n`;
      return `$${inlineMath}$`;
    },
  );
}

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 10 }]]}
        skipHtml
        components={{
          // Never load model-provided remote images or execute raw HTML.
          img: ({ alt }) => <span>{alt ? `[이미지: ${alt}]` : '[이미지]'}</span>,
          a: ({ href, children }) => href && /^https?:\/\//i.test(href)
            ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>,
          table: ({ children }) => <div className="assistant-table-scroll"><table>{children}</table></div>,
        }}
      >
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
}
