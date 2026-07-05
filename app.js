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

  // File Indicators & Title
  const currentFilenameSpan = document.getElementById('current-filename');
  const saveIndicator = document.getElementById('save-indicator');

  // Stats Elements
  const statWords = document.getElementById('stat-words');
  const statChars = document.getElementById('stat-chars');
  const statReadTime = document.getElementById('stat-read-time');

  // Toolbar Actions
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnSaveAs = document.getElementById('btn-save-as');
  const btnExportHtml = document.getElementById('btn-export-html');
  const btnPrint = document.getElementById('btn-print');

  const btnBold = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const btnHeading = document.getElementById('btn-heading');
  const btnLink = document.getElementById('btn-link');
  const btnImage = document.getElementById('btn-image');
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

    if (window.marked && window.DOMPurify) {
      const parsedHtml = marked.parse(rawMarkdown);
      const cleanHtml = DOMPurify.sanitize(parsedHtml);
      previewOutput.innerHTML = cleanHtml;

      // Apply PrismJS syntax highlighting
      if (window.Prism) {
        Prism.highlightAllUnder(previewOutput);
      }
    } else {
      previewOutput.textContent = rawMarkdown;
    }

    // Update document statistics
    updateStatistics(rawMarkdown);

    // Save content (even empty strings are saved to properly reflect clear states)
    storage.set(STORAGE_KEYS.CONTENT, rawMarkdown);
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

  textarea.addEventListener('input', queuePreviewUpdate);

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
  function syncScroll(source, destination) {
    if (!isScrollSyncActive || isSyncing) return;
    isSyncing = true;
    
    const sourcePercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
    const targetScrollTop = sourcePercentage * (destination.scrollHeight - destination.clientHeight);
    
    destination.scrollTop = targetScrollTop;

    // Release sync lock on next frame
    requestAnimationFrame(() => {
      isSyncing = false;
    });
  }

  textarea.addEventListener('scroll', () => {
    syncScroll(textarea, previewContainer);
  });

  previewContainer.addEventListener('scroll', () => {
    syncScroll(previewContainer, textarea);
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

  btnImage.addEventListener('click', () => insertFormat('![', '](https://example.com/image.jpg)', '画像の説明'));
  
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
        
        textarea.value = await file.text();
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
          textarea.value = event.target.result;
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
        await writable.write(textarea.value);
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
      const blob = new Blob([textarea.value], { type: 'text/markdown;charset=utf-8;' });
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
    const parsedHtml = window.marked ? marked.parse(rawMarkdown) : rawMarkdown;
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

  // Bind Buttons
  btnOpen.addEventListener('click', openFile);
  btnSave.addEventListener('click', () => saveFile(false));
  btnSaveAs.addEventListener('click', () => saveFile(true));
  btnExportHtml.addEventListener('click', exportHtml);
  btnPrint.addEventListener('click', () => window.print());

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
     8. Keyboard Shortcuts Integration (OS/Browser compatibility)
     ========================================================================== */

  window.addEventListener('keydown', (e) => {
    const isMeta = e.ctrlKey || e.metaKey;
    if (!isMeta) return;

    const activeEl = document.activeElement;
    const isEditorFocused = activeEl === textarea;

    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        saveFile(false);
        break;
      case 'o':
        e.preventDefault();
        openFile();
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
     9. Initial Content / Draft Restore
     ========================================================================== */

  function loadInitialContent() {
    const savedContent = storage.get(STORAGE_KEYS.CONTENT);
    const savedFilename = storage.get(STORAGE_KEYS.FILENAME);
    
    if (savedContent !== null) {
      textarea.value = savedContent;
      currentFilenameSpan.textContent = savedFilename || '新規ドキュメント.md';
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

  // Run initialization
  initTheme();
  loadInitialContent();
});
