import katex from 'katex';

/** KaTeX 수식 하나를 HTML로 (빌드 시점에 렌더링) */
export function tex(src: string, display = false): string {
  return katex.renderToString(src, { throwOnError: false, displayMode: display, output: 'html' });
}

/** "$...$"가 섞인 문장을 HTML로. 수식 밖 텍스트는 이스케이프한다. */
export function texText(s: string): string {
  return s
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith('$') && part.endsWith('$') && part.length > 1
        ? tex(part.slice(1, -1))
        : part.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!),
    )
    .join('');
}
