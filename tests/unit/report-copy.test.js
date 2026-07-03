import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function withoutComments(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('report copy privacy', () => {
  it('does not expose internal prompt or implementation copy in user-visible report text', () => {
    const visibleSource = withoutComments(indexHtml);
    const forbiddenFragments = [
      '下图以官方功能医学矩阵 PDF 转出的矢量图',
      '官方几何原样内嵌',
      '非重绘',
      'PC / 手机 / 打印 / PDF',
      'SKILL ENGINE',
      '内置功能医学 skill',
      'skill / 规则引擎',
      'LLM',
    ];

    for (const fragment of forbiddenFragments) {
      expect(visibleSource).not.toContain(fragment);
    }
  });

  it('keeps the report matrix caption patient-facing', () => {
    expect(indexHtml).toContain('下图为官方功能医学矩阵图式');
    expect(indexHtml).toContain('你的资料填写在「复述您的故事」与「可改善的生活方式」两组区域中');
  });
});
