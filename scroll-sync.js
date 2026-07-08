(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.GlowEditScrollSync = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getScrollProgress(current, maxScroll) {
    if (maxScroll <= 0) return 0;
    return clamp(current / maxScroll, 0, 1);
  }

  function getScrollTopForProgress(progress, maxScroll) {
    if (maxScroll <= 0) return 0;
    return clamp(progress, 0, 1) * maxScroll;
  }

  // Token types that marked's Parser does not turn into a top-level DOM node
  // (blank-line separators and link/image reference definitions are consumed
  // silently), so they must not advance the block index.
  const NON_RENDERING_TOKEN_TYPES = new Set(['space', 'def']);

  // Builds a line -> blockIndex map where blockIndex corresponds 1:1 with the
  // top-level child elements marked.parse() will render into previewOutput.
  // Uses marked's own lexer so the mapping tracks marked's actual block
  // splitting (tables, multi-line blockquotes, lists, etc.) instead of an
  // approximation that can drift from what is actually rendered.
  function buildLineBlockMap(markdown, lexer) {
    const lines = markdown.split('\n');
    const blockMap = new Array(lines.length).fill(0);
    if (typeof lexer !== 'function' || lines.length === 0) {
      return blockMap;
    }

    // Absolute character offset where each line begins within `markdown`.
    const lineStarts = new Array(lines.length);
    let acc = 0;
    for (let i = 0; i < lines.length; i += 1) {
      lineStarts[i] = acc;
      acc += lines[i].length + 1;
    }

    const tokens = lexer(markdown);
    let offset = 0;
    let blockIndex = 0;
    let lineIdx = 0;

    for (const token of tokens) {
      const raw = typeof token.raw === 'string' ? token.raw : '';
      if (raw === '') continue;

      const tokenEnd = offset + raw.length;
      const assignedIndex = blockIndex;

      while (lineIdx < lines.length && lineStarts[lineIdx] < tokenEnd) {
        blockMap[lineIdx] = assignedIndex;
        lineIdx += 1;
      }

      offset = tokenEnd;
      if (!NON_RENDERING_TOKEN_TYPES.has(token.type)) {
        blockIndex += 1;
      }
    }

    // Any trailing lines the lexer didn't account for stay attached to the
    // last rendered block instead of defaulting back to block 0.
    const lastIndex = Math.max(0, blockIndex - 1);
    while (lineIdx < lines.length) {
      blockMap[lineIdx] = lastIndex;
      lineIdx += 1;
    }

    return blockMap;
  }

  function findNearestLineForBlockIndex(blockIndex, lineBlockMap) {
    if (!Array.isArray(lineBlockMap) || lineBlockMap.length === 0) return 0;
    let nearestLine = 0;

    for (let i = 0; i < lineBlockMap.length; i += 1) {
      if (lineBlockMap[i] <= blockIndex) {
        nearestLine = i;
      }
    }

    return nearestLine;
  }

  return {
    clamp,
    getScrollProgress,
    getScrollTopForProgress,
    buildLineBlockMap,
    findNearestLineForBlockIndex
  };
});
