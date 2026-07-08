const test = require('node:test');
const assert = require('node:assert/strict');
const marked = require('./libs/marked.min.js');
const { getScrollProgress, getScrollTopForProgress, buildLineBlockMap, findNearestLineForBlockIndex } = require('./scroll-sync.js');

test('scroll progress stays in range', () => {
  assert.equal(getScrollProgress(0, 100), 0);
  assert.equal(getScrollProgress(50, 100), 0.5);
  assert.equal(getScrollProgress(100, 100), 1);
  assert.equal(getScrollProgress(200, 100), 1);
});

test('scroll top is reconstructed from progress', () => {
  assert.equal(getScrollTopForProgress(0.25, 200), 50);
  assert.equal(getScrollTopForProgress(0.5, 200), 100);
  assert.equal(getScrollTopForProgress(1, 200), 200);
});

test('markdown blocks are mapped to line ranges using the real marked lexer', () => {
  const markdown = ['# Heading', '', 'First paragraph', 'continues', '', '- item', ''].join('\n');
  const map = buildLineBlockMap(markdown, marked.lexer);
  assert.deepEqual(map, [0, 0, 1, 1, 2, 2, 2]);
});

test('nearest line can be resolved from a block index', () => {
  const map = [0, 1, 1, 1, 2, 2, 2];
  assert.equal(findNearestLineForBlockIndex(1, map), 3);
  assert.equal(findNearestLineForBlockIndex(2, map), 6);
});

test('a multi-line table collapses into a single block, matching the single <table> marked renders', () => {
  const markdown = [
    '# Title',
    '',
    '| a | b |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    'after table'
  ].join('\n');

  const map = buildLineBlockMap(markdown, marked.lexer);
  const tokens = marked.lexer(markdown).filter(t => t.type !== 'space' && t.type !== 'def');
  assert.equal(tokens.map(t => t.type).join(','), 'heading,table,paragraph');

  // All 3 table rows must share one block index, distinct from the heading and the trailing paragraph.
  assert.equal(map[2], map[3]);
  assert.equal(map[3], map[4]);
  assert.notEqual(map[2], map[0]);
  assert.notEqual(map[6], map[2]);
});

test('a multi-line blockquote collapses into a single block', () => {
  const markdown = ['> line one', '> line two', '> line three'].join('\n');
  const map = buildLineBlockMap(markdown, marked.lexer);
  assert.deepEqual(map, [0, 0, 0]);
});

test('link reference definitions do not consume a block index (they render nothing)', () => {
  const markdown = [
    '![alt][ref-img1]',
    '',
    '[ref-img1]: glowedit-img-ref-1',
    '',
    'next paragraph'
  ].join('\n');

  const map = buildLineBlockMap(markdown, marked.lexer);
  const tokens = marked.lexer(markdown).filter(t => t.type !== 'space' && t.type !== 'def');
  assert.equal(tokens.map(t => t.type).join(','), 'paragraph,paragraph');

  // The paragraph after the reference definition must be the 2nd rendered block (index 1),
  // not drift ahead because the non-rendering "def" line was miscounted as a block.
  assert.equal(map[4], 1);
});

test('the number of distinct block indices matches the number of tokens marked will actually render', () => {
  const markdown = [
    '# Title',
    '',
    'para text',
    'more',
    '',
    '> quote line1',
    '> quote line2',
    '',
    '| a | b |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '- item1',
    '- item2',
    '',
    'end para'
  ].join('\n');

  const map = buildLineBlockMap(markdown, marked.lexer);
  const renderedTokenCount = marked.lexer(markdown).filter(t => t.type !== 'space' && t.type !== 'def').length;
  const distinctBlocks = new Set(map).size;
  assert.equal(distinctBlocks, renderedTokenCount);
});
