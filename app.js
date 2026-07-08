/**
 * GlowEdit - Premium Markdown Editor Logic (Optimized)
 * Localized for Japanese & Structured for 100% Offline execution
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const textarea = document.getElementById('markdown-textarea');
  const previewContainer = document.getElementById('preview-container');
  const previewOutput = document.getElementById('preview-output');
  const themeToggle = document.getElementById('theme-toggle');
  const darkIcon = themeToggle.querySelector('.theme-icon-dark');
  const lightIcon = themeToggle.querySelector('.theme-icon-light');

  // Keyboard Shortcuts Help Modal
  const btnShortcuts = document.getElementById('btn-shortcuts');
  const shortcutsModal = document.getElementById('shortcuts-modal');
  const btnShortcutsClose = document.getElementById('btn-shortcuts-close');

  // File Indicators & Title
  const currentFilenameSpan = document.getElementById('current-filename');
  const saveIndicator = document.getElementById('save-indicator');

  // Stats Elements
  const statWords = document.getElementById('stat-words');
  const statChars = document.getElementById('stat-chars');
  const statReadTime = document.getElementById('stat-read-time');

  // Toolbar Actions
  const btnNew = document.getElementById('btn-new');
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnSaveAs = document.getElementById('btn-save-as');
  const btnExportHtml = document.getElementById('btn-export-html');
  const btnPrint = document.getElementById('btn-print');
  const btnCopy = document.getElementById('btn-copy');

  const btnBold = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const btnHeading = document.getElementById('btn-heading');
  const btnLink = document.getElementById('btn-link');
  const btnImage = document.getElementById('btn-image');
  const imageFileInput = document.getElementById('image-file-input');
  const btnCode = document.getElementById('btn-code');
  const btnQuote = document.getElementById('btn-quote');
  const btnListUl = document.getElementById('btn-list-ul');
  const btnListOl = document.getElementById('btn-list-ol');

  // Sync Toggle
  const scrollSyncToggle = document.getElementById('scroll-sync-toggle');
  const toggleLabel = scrollSyncToggle.querySelector('.toggle-label');

  // Mobile Tabs
  const tabEdit = document.getElementById('tab-edit');
  const tabPreview = document.getElementById('tab-preview');
  const appMain = document.querySelector('.app-main');

  // Resizer Splitter
  const resizer = document.getElementById('pane-resizer');

  // --- App State & Storage Wrapper (file:// Sandbox Safety) ---
  let fileHandle = null;
  let isUnsaved = false;
  let isScrollSyncActive = true;
  let themePreference = 'dark'; // Default premium theme

  // Image Placeholder Cache for Scroll Sync Optimization
  const imageCache = new Map();
  let imageRefCounter = 0;
  const BASE64_IMAGE_REGEX = /data:image\/[a-zA-Z0-9-+.]+;base64,[A-Za-z0-9+/=]+/g;
  const PLACEHOLDER_PREFIX = 'glowedit-img-ref-';
  const PLACEHOLDER_REGEX = /glowedit-img-ref-\d+/g;

  function importMarkdown(text) {
    if (!text) return text;
    return text.replace(BASE64_IMAGE_REGEX, (match) => {
      for (const [key, val] of imageCache.entries()) {
        if (val === match) return key;
      }
      const placeholder = `${PLACEHOLDER_PREFIX}${++imageRefCounter}`;
      imageCache.set(placeholder, match);
      return placeholder;
    });
  }

  function exportMarkdown(text) {
    if (!text) return text;
    return text.replace(PLACEHOLDER_REGEX, (match) => {
      return imageCache.get(match) || match;
    });
  }

  function cleanImageCache(text) {
    if (!text) {
      imageCache.clear();
      return;
    }
    const activeRefs = new Set();
    let match;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      activeRefs.add(match[0]);
    }
    for (const key of imageCache.keys()) {
      if (!activeRefs.has(key)) {
        imageCache.delete(key);
      }
    }
  }
  
  const STORAGE_KEYS = {
    CONTENT: 'glowedit-draft-content',
    THEME: 'glowedit-theme-preference',
    FILENAME: 'glowedit-draft-filename'
  };

  // Safe wrapper for localStorage to prevent SecurityError crash on file:// sandboxes
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('Storage read blocked (file:// sandbox or privacy settings).');
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Storage write blocked (file:// sandbox or privacy settings).');
      }
    }
  };

  /* ==========================================================================
     1. Theme Management
     ========================================================================== */

  function initTheme() {
    const savedTheme = storage.get(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themePreference = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(themePreference);
  }

  function applyTheme(theme) {
    document.documentElement.style.colorScheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    themePreference = theme;
    storage.set(STORAGE_KEYS.THEME, theme);

    if (theme === 'dark') {
      darkIcon.style.display = 'none';
      lightIcon.style.display = 'block';
    } else {
      darkIcon.style.display = 'block';
      lightIcon.style.display = 'none';
    }
  }

  themeToggle.addEventListener('click', () => {
    const nextTheme = themePreference === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // Watch system settings for reactive updates
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!storage.get(STORAGE_KEYS.THEME)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  /* ==========================================================================
     2. Markdown Rendering & Statistics (Debounced)
     ========================================================================== */

  // Configure marked options
  if (window.marked) {
    marked.use({
      gfm: true,
      breaks: true,
      headerIds: true,
      mangle: false
    });
  }

  function updatePreview() {
    const rawMarkdown = textarea.value;

    // Clean unused image cache to prevent memory leaks
    cleanImageCache(rawMarkdown);
    updateLineBlockMap();

    if (window.marked && window.DOMPurify) {
      // Export markdown with restored Base64 data for rendering
      const previewMarkdown = exportMarkdown(rawMarkdown);
      const parsedHtml = marked.parse(previewMarkdown);
      const cleanHtml = DOMPurify.sanitize(parsedHtml);
      previewOutput.innerHTML = cleanHtml;

      // Apply PrismJS syntax highlighting
      if (window.Prism) {
        Prism.highlightAllUnder(previewOutput);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          syncCursorToPreview();
        });
      });
    } else {
      previewOutput.textContent = rawMarkdown;
    }

    // Update document statistics
    updateStatistics(rawMarkdown);

    // Save content with restored Base64 data to localStorage
    const fullMarkdown = exportMarkdown(rawMarkdown);
    storage.set(STORAGE_KEYS.CONTENT, fullMarkdown);
    setUnsavedStatus(rawMarkdown.trim() !== '');
  }

  // Performance Optimization: Debounce updatePreview (250ms delay) to prevent typing lag
  let debounceTimeout;
  function queuePreviewUpdate() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(updatePreview, 250);
  }

  function updateStatistics(text) {
    // Character count (including spaces/newlines)
    const charCount = text.length;
    statChars.textContent = charCount;

    // Word count (clean text of markdown characters, split by spaces)
    const cleanText = text.replace(/[#*`_\[\]()\-+]/g, '');
    const words = cleanText.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    statWords.textContent = wordCount;

    // Read time (estimate: ~400 Japanese characters or ~200 words per minute)
    const jpChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g) || []).length;
    const enWords = Math.max(0, wordCount - Math.floor(jpChars / 2));

    const jpTime = jpChars / 400;
    const enTime = enWords / 200;
    const totalTime = Math.max(1, Math.ceil(jpTime + enTime));
    statReadTime.textContent = totalTime;
  }

  function setUnsavedStatus(unsaved) {
    isUnsaved = unsaved;
    saveIndicator.style.display = unsaved ? 'inline-block' : 'none';
  }

  /* ==========================================================================
     3. Scroll Synchronization (rAF Frame-Locked to prevent jitter)
     ========================================================================== */

  // Enable/disable toggle
  scrollSyncToggle.addEventListener('click', () => {
    isScrollSyncActive = !isScrollSyncActive;
    scrollSyncToggle.classList.toggle('active', isScrollSyncActive);
    toggleLabel.textContent = isScrollSyncActive ? '同期オン' : '同期オフ';
  });

  let isSyncing = false;
  let activeScrollSource = null; // Track which pane is actively scrolled by user
  let scrollSyncFrame = null;
  let lineBlockMap = [];
  let lastCursorLine = 0;
  let activePreviewBlock = null;

  // Track active window by hover, touch, & focus to prevent sync feedback loops
  textarea.addEventListener('mouseenter', () => { activeScrollSource = 'editor'; });
  textarea.addEventListener('focus', () => { activeScrollSource = 'editor'; });
  textarea.addEventListener('touchstart', () => { activeScrollSource = 'editor'; }, { passive: true });

  previewContainer.addEventListener('mouseenter', () => { activeScrollSource = 'preview'; });
  previewContainer.addEventListener('touchstart', () => { activeScrollSource = 'preview'; }, { passive: true });

  function scheduleScrollSync(callback) {
    if (scrollSyncFrame) {
      cancelAnimationFrame(scrollSyncFrame);
    }

    scrollSyncFrame = requestAnimationFrame(() => {
      scrollSyncFrame = null;
      callback();
    });
  }

  function updateLineBlockMap() {
    lineBlockMap = window.GlowEditScrollSync.buildLineBlockMap(textarea.value, window.marked && marked.lexer);
  }

  function clearActivePreviewBlock() {
    if (activePreviewBlock) {
      activePreviewBlock.classList.remove('preview-block-active');
      activePreviewBlock = null;
    }
  }

  function getCursorViewportAnchor(targetElement, cursorProgress) {
    const viewportHeight = previewContainer.clientHeight || 500;
    const blockTop = targetElement.offsetTop;
    const blockHeight = targetElement.offsetHeight || 80;
    const previewMaxScroll = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);

    let anchorRatio = 0.18;
    if (cursorProgress <= 0.15) {
      anchorRatio = 0.08;
    } else if (cursorProgress <= 0.4) {
      anchorRatio = 0.2;
    } else if (cursorProgress <= 0.7) {
      anchorRatio = 0.35;
    } else if (cursorProgress <= 0.9) {
      anchorRatio = 0.6;
    } else {
      anchorRatio = 0.8;
    }

    const targetScrollTop = Math.max(0, blockTop - Math.max(12, viewportHeight * anchorRatio) + (cursorProgress > 0.9 ? blockHeight * 0.25 : 0));
    return Math.min(targetScrollTop, previewMaxScroll);
  }

  function syncCursorToPreview() {
    if (!isScrollSyncActive) return;
    updateLineBlockMap();

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursorPosition);
    const cursorLine = textBeforeCursor.split('\n').length - 1;
    const totalLines = Math.max(1, textarea.value.split('\n').length);
    const cursorProgress = totalLines > 1 ? cursorLine / (totalLines - 1) : 0;
    lastCursorLine = cursorLine;

    const blockIndex = lineBlockMap[cursorLine] ?? 0;
    const previewElements = Array.from(previewOutput.children);
    if (previewElements.length === 0) return;

    const targetIndex = Math.min(blockIndex, previewElements.length - 1);
    const targetElement = previewElements[targetIndex];
    if (!targetElement) return;

    clearActivePreviewBlock();
    targetElement.classList.add('preview-block-active');
    activePreviewBlock = targetElement;

    previewContainer.scrollTop = getCursorViewportAnchor(targetElement, cursorProgress);
  }

  function syncEditorToPreview() {
    if (!isScrollSyncActive || isSyncing) return;
    isSyncing = true;

    const editorMaxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    const previewMaxScroll = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
    const progress = window.GlowEditScrollSync.getScrollProgress(textarea.scrollTop, editorMaxScroll);

    previewContainer.scrollTop = window.GlowEditScrollSync.getScrollTopForProgress(progress, previewMaxScroll);

    requestAnimationFrame(() => {
      isSyncing = false;
    });
  }

  function syncPreviewToEditor() {
    if (!isScrollSyncActive || isSyncing) return;
    isSyncing = true;

    const previewMaxScroll = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
    const editorMaxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    const progress = window.GlowEditScrollSync.getScrollProgress(previewContainer.scrollTop, previewMaxScroll);

    textarea.scrollTop = window.GlowEditScrollSync.getScrollTopForProgress(progress, editorMaxScroll);

    requestAnimationFrame(() => {
      isSyncing = false;
    });
  }

  textarea.addEventListener('scroll', () => {
    if (activeScrollSource === 'editor') {
      scheduleScrollSync(syncEditorToPreview);
    }
  });

  textarea.addEventListener('keyup', syncCursorToPreview);
  textarea.addEventListener('click', syncCursorToPreview);
  textarea.addEventListener('select', syncCursorToPreview);
  textarea.addEventListener('input', queuePreviewUpdate);

  previewContainer.addEventListener('scroll', () => {
    if (activeScrollSource === 'preview') {
      scheduleScrollSync(syncPreviewToEditor);
    }
  });

  // Initialize toggle UI active state
  scrollSyncToggle.classList.add('active');

  /* ==========================================================================
     4. Toolbar Formatting Actions (Undo/Redo Preserving)
     ========================================================================== */

  function insertFormat(patternStart, patternEnd = '', placeholder = 'テキスト') {
    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    
    const selectedText = val.substring(start, end);
    const replacement = patternStart + (selectedText || placeholder) + patternEnd;
    
    // execCommand preserves native browser Undo/Redo stack
    const success = document.execCommand('insertText', false, replacement);
    
    // Fallback if execCommand is not supported in environment
    if (!success) {
      textarea.value = val.substring(0, start) + replacement + val.substring(end);
    }
    
    // Restore selection
    const newStart = start + patternStart.length;
    const newEnd = newStart + (selectedText || placeholder).length;
    textarea.setSelectionRange(newStart, newEnd);
    
    queuePreviewUpdate();
  }

  // Bind toolbar buttons
  btnBold.addEventListener('click', () => insertFormat('**', '**', '太字テキスト'));
  btnItalic.addEventListener('click', () => insertFormat('*', '*', '斜体テキスト'));
  
  btnHeading.addEventListener('click', () => {
    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    
    // Find current line boundaries
    const lastNewline = val.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const nextNewline = val.indexOf('\n', start);
    const lineEnd = nextNewline === -1 ? val.length : nextNewline;
    
    const lineContent = val.substring(lineStart, lineEnd);
    let newLineContent = lineContent;
    let cursorShift = 0;

    // Safe toggle heading without accumulating multiple ## symbols
    if (lineContent.startsWith('# ')) {
      newLineContent = '## ' + lineContent.substring(2);
      cursorShift = 1;
    } else if (lineContent.startsWith('## ')) {
      newLineContent = '### ' + lineContent.substring(3);
      cursorShift = 1;
    } else if (lineContent.startsWith('### ')) {
      newLineContent = lineContent.substring(4);
      cursorShift = -4;
    } else {
      newLineContent = '# ' + lineContent;
      cursorShift = 2;
    }
    
    // Select the full line to replace it
    textarea.setSelectionRange(lineStart, lineEnd);
    
    // execCommand preserves Undo stack
    const success = document.execCommand('insertText', false, newLineContent);
    if (!success) {
      textarea.value = val.substring(0, lineStart) + newLineContent + val.substring(lineEnd);
    }
    
    // Keep cursor on selection relative to the header modification
    const restoredCursor = Math.max(lineStart, Math.min(lineEnd + cursorShift, start + cursorShift));
    textarea.setSelectionRange(restoredCursor, restoredCursor);
    
    queuePreviewUpdate();
  });

  btnLink.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const isUrl = /^https?:\/\/[^\s]+$/.test(selected);
    
    if (isUrl) {
      insertFormat('[リンクテキスト](', ')', selected);
    } else {
      insertFormat('[', '](https://example.com)', 'リンクテキスト');
    }
  });

  btnImage.addEventListener('click', () => {
    imageFileInput.value = ''; // Reset input selection
    imageFileInput.click();
  });

  imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show warning for images larger than 3MB to prevent performance drop
    const maxWarningSize = 3 * 1024 * 1024;
    if (file.size > maxWarningSize) {
      const proceed = confirm(`選択した画像は約 ${(file.size / (1024 * 1024)).toFixed(1)}MB あります。大容量の画像をインライン化するとエディタが重くなる可能性がありますが、挿入しますか？`);
      if (!proceed) return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      const altText = file.name.substring(0, file.name.lastIndexOf('.')) || '画像の説明';
      
      const currentContent = textarea.value;
      
      // Generate a unique reference ID (e.g., ref-img1, ref-img2...)
      let refIndex = 1;
      while (currentContent.includes(`[ref-img${refIndex}]`)) {
        refIndex++;
      }
      const refKey = `ref-img${refIndex}`;

      // Reference-style link to insert at cursor: ![alt][ref-img1]
      const linkText = `![${altText}][${refKey}]`;
      
      textarea.focus();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // 1. Insert the reference link at the cursor position (preserving undo history)
      const success = document.execCommand('insertText', false, linkText);
      if (!success) {
        textarea.value = currentContent.substring(0, start) + linkText + currentContent.substring(end);
      }
      
      // 2. Put Base64 data into memory cache and append the lightweight placeholder definition at the bottom
      const placeholder = `${PLACEHOLDER_PREFIX}${++imageRefCounter}`;
      imageCache.set(placeholder, base64Data);

      const updatedContent = textarea.value;
      const spacing = updatedContent.endsWith('\n') ? '\n' : '\n\n';
      const refDefinition = `${spacing}[${refKey}]: ${placeholder}\n`;
      
      textarea.value = updatedContent + refDefinition;
      
      // 3. Restore cursor position to right after the inserted reference link
      const nextCursorPos = start + linkText.length;
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);

      queuePreviewUpdate();
    };
    reader.onerror = () => {
      alert('画像の読み込みに失敗しました。');
    };
    reader.readAsDataURL(file);
  });
  
  btnCode.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    
    if (selected.includes('\n')) {
      insertFormat('```javascript\n', '\n```', selected || 'console.log("Hello, World!");');
    } else {
      insertFormat('`', '`', 'コード');
    }
  });

  btnQuote.addEventListener('click', () => insertFormat('> ', '', '引用テキスト'));
  btnListUl.addEventListener('click', () => insertFormat('- ', '', '箇条書きリスト項目'));
  btnListOl.addEventListener('click', () => insertFormat('1. ', '', '番号付きリスト項目'));

  /* ==========================================================================
     5. File Operations (URL Revoke Safety & file:// detection)
     ========================================================================== */

  // Disable File System Access API on local file:// sandbox contexts to avoid API exceptions
  const isFileProtocol = window.location.protocol === 'file:';
  const hasFileSystemAPI = !isFileProtocol && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;

  // New File
  const DEFAULT_FILENAME = '新規ドキュメント.md';

  function newFile() {
    if (isUnsaved) {
      const proceed = confirm('保存されていない変更があります。新規作成すると現在の内容が失われますが、よろしいですか？');
      if (!proceed) return;
    }

    fileHandle = null;
    imageCache.clear();
    imageRefCounter = 0;
    textarea.value = '';

    currentFilenameSpan.textContent = DEFAULT_FILENAME;
    storage.set(STORAGE_KEYS.FILENAME, DEFAULT_FILENAME);
    setUnsavedStatus(false);
    updatePreview();
    textarea.focus();
  }

  // Open File
  async function openFile() {
    if (hasFileSystemAPI) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'マークダウンファイル',
            accept: { 'text/markdown': ['.md', '.txt', '.markdown'] }
          }],
          excludeAcceptAllOption: true,
          multiple: false
        });
        fileHandle = handle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        // Reset image cache on file open
        imageCache.clear();
        imageRefCounter = 0;
        textarea.value = importMarkdown(text);

        currentFilenameSpan.textContent = file.name;
        storage.set(STORAGE_KEYS.FILENAME, file.name);
        setUnsavedStatus(false);
        updatePreview();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          alert('ファイルの読み込みに失敗しました。');
        }
      }
    } else {
      // Fallback open
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt,.markdown';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          
          // Reset image cache on file open
          imageCache.clear();
          imageRefCounter = 0;
          textarea.value = importMarkdown(text);

          currentFilenameSpan.textContent = file.name;
          storage.set(STORAGE_KEYS.FILENAME, file.name);
          setUnsavedStatus(false);
          updatePreview();
        };
        reader.readAsText(file);
      };
      input.click();
    }
  }

  // Save File
  async function saveFile(isSaveAs = false) {
    if (hasFileSystemAPI) {
      if (!fileHandle || isSaveAs) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: currentFilenameSpan.textContent || 'document.md',
            types: [{
              description: 'マークダウンファイル',
              accept: { 'text/markdown': ['.md'] }
            }]
          });
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.error(err);
          alert('保存先の取得に失敗しました。');
          return;
        }
      }

      // Check write permission
      const opts = { mode: 'readwrite' };
      if ((await fileHandle.queryPermission(opts)) !== 'granted') {
        if ((await fileHandle.requestPermission(opts)) !== 'granted') {
          alert('書き込み権限が拒否されました。');
          return;
        }
      }

      try {
        const writable = await fileHandle.createWritable();
        // Export file with original Base64 data restored
        const fullMarkdown = exportMarkdown(textarea.value);
        await writable.write(fullMarkdown);
        await writable.close();
        
        const file = await fileHandle.getFile();
        currentFilenameSpan.textContent = file.name;
        storage.set(STORAGE_KEYS.FILENAME, file.name);
        setUnsavedStatus(false);
      } catch (err) {
        console.error(err);
        alert('ファイルの書き込みに失敗しました。');
      }
    } else {
      // Fallback download save
      const defaultFilename = currentFilenameSpan.textContent || 'document.md';
      const filename = prompt('保存するファイル名を入力してください:', defaultFilename);
      if (!filename) return;
      
      const finalName = filename.endsWith('.md') ? filename : filename + '.md';
      // Export file with original Base64 data restored
      const fullMarkdown = exportMarkdown(textarea.value);
      const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      a.href = url;
      a.download = finalName;
      a.click();
      
      // Delay revoking URL by 10s to ensure async browser download starts safely
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
      currentFilenameSpan.textContent = finalName;
      storage.set(STORAGE_KEYS.FILENAME, finalName);
      setUnsavedStatus(false);
    }
  }

  // HTML Export
  function exportHtml() {
    const rawMarkdown = textarea.value;
    // Export HTML with original Base64 data restored
    const fullMarkdown = exportMarkdown(rawMarkdown);
    const parsedHtml = window.marked ? marked.parse(fullMarkdown) : fullMarkdown;
    const cleanHtml = window.DOMPurify ? DOMPurify.sanitize(parsedHtml) : parsedHtml;

    const docHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>GlowEdit エクスポートドキュメント</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.7;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #1a1a1a;
        }
        pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
        blockquote { border-left: 4px solid #3b82f6; background: #eff6ff; padding: 10px 16px; margin: 16px 0; color: #4b5563; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        table th, table td { border: 1px solid #e5e7eb; padding: 8px 12px; }
        table th { background: #f9fafb; }
    </style>
</head>
<body>
    <article class="markdown-body">
        ${cleanHtml}
    </article>
</body>
</html>`;

    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    let baseFilename = currentFilenameSpan.textContent;
    if (baseFilename.endsWith('.md')) {
      baseFilename = baseFilename.substring(0, baseFilename.length - 3);
    }
    
    a.href = url;
    a.download = baseFilename + '.html';
    a.click();
    
    // Delay revocation to ensure async download starts safely
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Copy to Clipboard (with fallback for file:// contexts)
  let toastElement = null;
  let toastTimeout = null;

  function showToast(message) {
    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.className = 'toast-notification';
      toastElement.innerHTML = `
        <span class="toast-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </span>
        <span class="toast-message"></span>
      `;
      document.body.appendChild(toastElement);
    }

    toastElement.querySelector('.toast-message').textContent = message;
    
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    
    toastElement.classList.add('show');
    
    toastTimeout = setTimeout(() => {
      toastElement.classList.remove('show');
    }, 2000);
  }

  async function copyToClipboard() {
    // Restore original Base64 data before copying to clipboard
    const textToCopy = exportMarkdown(textarea.value);
    
    // Attempt modern async clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast('クリップボードにコピーしました');
        return;
      } catch (err) {
        console.warn('Async clipboard API failed, trying fallback...', err);
      }
    }
    
    // Fallback: execCommand('copy') for offline file:// contexts
    try {
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = textToCopy;
      tempTextArea.style.position = 'fixed';
      tempTextArea.style.left = '-999999px';
      tempTextArea.style.top = '-999999px';
      document.body.appendChild(tempTextArea);
      
      tempTextArea.focus();
      tempTextArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(tempTextArea);
      
      if (success) {
        showToast('クリップボードにコピーしました');
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      alert('コピーに失敗しました。');
    }
  }

  // Bind Buttons
  btnNew.addEventListener('click', newFile);
  btnOpen.addEventListener('click', openFile);
  btnSave.addEventListener('click', () => saveFile(false));
  btnSaveAs.addEventListener('click', () => saveFile(true));
  btnExportHtml.addEventListener('click', exportHtml);
  btnPrint.addEventListener('click', () => window.print());
  btnCopy.addEventListener('click', copyToClipboard);

  /* ==========================================================================
     6. Desktop Panel Resizer (PointerEvents for touch/mouse & CSS Var allocation)
     ========================================================================== */

  function onPointerMove(e) {
    const appWidth = document.body.clientWidth;
    let newWidth = e.clientX;
    const minWidth = 150;
    
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > appWidth - minWidth) newWidth = appWidth - minWidth;
    
    const percentage = (newWidth / appWidth) * 100;
    // Set custom CSS variable instead of inline styles on elements
    document.documentElement.style.setProperty('--editor-width', `${percentage}%`);
  }

  function onPointerUp() {
    resizer.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Detach listeners immediately on drag release to optimize CPU cycles
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }

  // Pointer events handle both Touch and Mouse inputs
  resizer.addEventListener('pointerdown', (e) => {
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent browser text highlights while dragging
    e.preventDefault();
    
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });

  /* ==========================================================================
     7. Mobile Navigation & Tabs System
     ========================================================================== */

  tabEdit.addEventListener('click', () => {
    tabEdit.classList.add('active');
    tabPreview.classList.remove('active');
    appMain.classList.remove('show-preview');
  });

  tabPreview.addEventListener('click', () => {
    tabPreview.classList.add('active');
    tabEdit.classList.remove('active');
    appMain.classList.add('show-preview');
  });

  /* ==========================================================================
     8. Keyboard Shortcuts Help Modal
     ========================================================================== */

  let shortcutsTriggerEl = null;

  function openShortcutsModal(triggerEl) {
    shortcutsTriggerEl = triggerEl || null;
    shortcutsModal.hidden = false;
    btnShortcutsClose.focus();
  }

  function closeShortcutsModal() {
    if (shortcutsModal.hidden) return;
    shortcutsModal.hidden = true;
    if (shortcutsTriggerEl) {
      shortcutsTriggerEl.focus();
      shortcutsTriggerEl = null;
    }
  }

  function isShortcutsModalOpen() {
    return !shortcutsModal.hidden;
  }

  btnShortcuts.addEventListener('click', () => openShortcutsModal(btnShortcuts));
  btnShortcutsClose.addEventListener('click', closeShortcutsModal);
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) closeShortcutsModal();
  });

  /* ==========================================================================
     9. Keyboard Shortcuts Integration (OS/Browser compatibility)
     ========================================================================== */

  // On Mac, plain Ctrl+<letter> is reserved by the OS/browser for Emacs-style
  // text editing (Ctrl+A/E/F/B/D/H/K/N/P/T/W/Y move or edit within text
  // fields). Only Cmd triggers app shortcuts there, so those native bindings
  // keep working while the editor is focused. Windows/Linux have no Cmd key,
  // so Ctrl remains the shortcut modifier there.
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isShortcutsModalOpen()) {
      e.preventDefault();
      closeShortcutsModal();
      return;
    }

    const activeEl = document.activeElement;
    const isEditorFocused = activeEl === textarea;

    // "?" opens the shortcuts help, but only away from the editor so typing
    // a literal question mark while writing markdown is never intercepted.
    if (e.key === '?' && !isEditorFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (isShortcutsModalOpen()) {
        closeShortcutsModal();
      } else {
        openShortcutsModal(null);
      }
      return;
    }

    const isShortcutModifier = isMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey;
    if (!isShortcutModifier) return;

    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        saveFile(false);
        break;
      case 'o':
        e.preventDefault();
        openFile();
        break;
      case 'n':
        e.preventDefault();
        newFile();
        break;
      case 'p':
        e.preventDefault();
        window.print();
        break;
      
      // Formatting shortcuts are only active when text area editor is focused
      case 'b':
        if (isEditorFocused) {
          e.preventDefault();
          insertFormat('**', '**', '太字テキスト');
        }
        break;
      case 'i':
        if (isEditorFocused) {
          e.preventDefault();
          insertFormat('*', '*', '斜体テキスト');
        }
        break;
      case 'd': // Ctrl+D replaces conflicting Ctrl+H / Cmd+H
        if (isEditorFocused) {
          e.preventDefault();
          btnHeading.click();
        }
        break;
      case 'k':
        if (isEditorFocused) {
          e.preventDefault();
          btnLink.click();
        }
        break;
    }
  });

  /* ==========================================================================
     10. Initial Content / Draft Restore
     ========================================================================== */

  function loadInitialContent() {
    const savedContent = storage.get(STORAGE_KEYS.CONTENT);
    const savedFilename = storage.get(STORAGE_KEYS.FILENAME);
    
    if (savedContent !== null) {
      // Reset image cache and import saved content with placeholders
      imageCache.clear();
      imageRefCounter = 0;
      textarea.value = importMarkdown(savedContent);

      currentFilenameSpan.textContent = savedFilename || DEFAULT_FILENAME;
      // Empty check logic correction
      setUnsavedStatus(savedContent.trim() !== '');
    } else {
      // Default Welcome Content in Japanese
      textarea.value = `# GlowEdit へようこそ 📝

GlowEdit は、**HTML, CSS, Vanilla JavaScript** のみで構築された、軽量・高速で美しいデザインのマークダウンエディタです。

サーバーの立ち上げやインターネット接続を必要とせず、\`index.html\` をダブルクリックするだけで**完全にローカル環境（オフライン）**で動作します。

## 主な特徴

1. 💻 **リアルタイム・ライブプレビュー**: 入力した内容がその場で美しく装飾されます。
2. 🔄 **スクロール同期**: エディタとプレビューのスクロールが連動します（「同期オン」ボタンで切替可能）。
3. 📦 **完全ローカル（オフライン）起動**: ダブルクリックで即座に起動し、ネット接続なしでもライブラリ・アイコン・フォントを100%読み込みます。
4. 💾 **ローカルオートセーブ**: 入力内容はブラウザに自動保存され、リロードしても消えません。
5. 🖨️ **印刷・PDF出力**: 余計なUIを省き、マークダウン装飾された文章のみを綺麗に印刷・PDF保存できます。

---

## マークダウン記法のサンプル

### リストとコード
- 箇条書きのリストです。
  - ネストされたリスト。
- 番号付きリストも使用できます。

インラインコードの例: \`const app = "GlowEdit"\`。以下は JavaScript のコードブロックです：

\`\`\`javascript
function greet(user) {
  console.log(\`GlowEdit へようこそ、\${user}さん！\`);
}
greet("ユーザー");
\`\`\`

### 引用 (Blockquote)
> マークダウンは執筆に集中するためのシンプルな仕組みです。GlowEdit はその執筆体験をプレミアムなデザインでサポートします。

### テーブル (表)
| 技術要素 | 実装アプローチ | パフォーマンス |
| :--- | :--- | :--- |
| **CSS** | カスタムプロパティ (Vanilla) | 非常に高速 |
| **JavaScript** | ネイティブ DOM (Vanilla) | 軽量・軽快 |

快適な執筆をお楽しみください！
`;
      currentFilenameSpan.textContent = 'ウェルカムガイド.md';
      setUnsavedStatus(false);
    }
    updatePreview();
  }

  // Displayed shortcut hints default to the Ctrl+ convention (Windows/Linux).
  // On Mac the actual trigger is Cmd (see the keydown handler above), so
  // relabel visible hints to match what will really work, skipping the
  // copy button which already documents both Ctrl+C and Cmd+C explicitly.
  function localizeShortcutHints() {
    if (!isMac) return;
    document.querySelectorAll('[title*="Ctrl+"]').forEach((el) => {
      if (el === btnCopy) return;
      el.title = el.title.replace(/Ctrl\+/g, '⌘');
    });
    document.querySelectorAll('.keyboard-hint, .shortcut-key').forEach((el) => {
      el.textContent = el.textContent.replace(/Ctrl\+/g, '⌘');
    });
  }

  // Run initialization
  initTheme();
  loadInitialContent();
  localizeShortcutHints();
});
