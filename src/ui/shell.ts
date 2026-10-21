import { el, input } from './dom.js';

interface ShellHost {
  showLeft(view: 'source' | 'structure' | 'assets'): void;
  showPreview(): void;
  showSettings(detail?: string): void;
  focusPaper(): void;
  edit(command: 'ruby' | 'emphasis' | 'page-break' | 'recto' | 'range' | 'center'): void;
}
interface Command { label: string; keywords: string; icon: string; desktopOnly?: boolean; run(): void; }

/** Navigation and appearance only. Commands use the same editing and export paths as the visible controls. */
export function workbenchShell(host: ShellHost): void {
  const dialog = el<HTMLDialogElement>('command-dialog'), search = input('command-search'), results = el('command-results');
  let filtered: Command[] = [], active = 0;
  let manuscriptSelection: {value: string;from: number;to: number;scroll: number} | undefined;
  const edit = (command: Parameters<ShellHost['edit']>[0]) => {
    const editor=el<HTMLTextAreaElement>('manuscript'),saved=manuscriptSelection;
    if(saved&&editor.value===saved.value){host.showLeft('source');editor.focus({preventScroll:true});editor.setSelectionRange(saved.from,saved.to);editor.scrollTop=saved.scroll;}
    host.edit(command);
  };
  const click = (id: string) => el<HTMLButtonElement>(id).click();
  const view = (id: string) => { host.showPreview(); click(id); };
  const theme = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const toggle = el('toggle-theme'); toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'ライトモード' : 'ダークモード'); toggle.title = dark ? 'ライトモードに切り替える' : 'ダークモードに切り替える';
    toggle.querySelector<HTMLElement>('[data-icon]')!.dataset.icon = dark ? 'sun' : 'moon';
    try { localStorage.setItem('bookmaker-appearance-v1', dark ? 'dark' : 'light'); } catch { /* Appearance never prevents book recovery. */ }
  };
  try { if (localStorage.getItem('bookmaker-appearance-v1') === 'dark') theme(); } catch { /* Default to light. */ }
  el('toggle-theme').addEventListener('click', theme);
  const help = el<HTMLDialogElement>('help-dialog');
  const showHelp = () => { if (!help.open) help.showModal(); };
  for (const id of ['open-help', 'status-help']) el(id).addEventListener('click', showHelp);
  el('close-help').addEventListener('click', () => help.close());
  el('help-notation').addEventListener('click', () => {
    help.close(); host.showLeft('source'); const details = document.querySelector<HTMLDetailsElement>('.notation-help')!;
    details.open = true; details.querySelector<HTMLElement>('summary')!.focus();
  });
  const commands: Command[] = [
    { label: '原稿を開く', keywords: '本文 manuscript', icon: 'file-text', run: () => { host.showLeft('source'); el('manuscript').focus(); } },
    { label: '本文を検索・置換', keywords: '原稿 find replace 検索 置換 Ctrl F', icon: 'search', run: () => click('open-source-find') },
    { label: '構成を開く', keywords: '章 扉 奥付 structure', icon: 'list-tree', run: () => { host.showLeft('structure'); el('add-book-item').focus(); } },
    { label: '素材を開く', keywords: '画像 挿絵 assets', icon: 'images', run: () => { host.showLeft('assets'); el('add-asset').focus(); } },
    { label: 'ファイルを読み込む', keywords: 'import TXT Word DOCX Markdown JSON', icon: 'folder-open', run: () => { host.showLeft('source'); click('import-trigger'); } },
    { label: '本の設定', keywords: '判型 余白 ページ 本文全体', icon: 'book-open', run: () => host.showSettings() },
    { label: '設定テンプレート', keywords: '本 プリセット 再利用 設定保存', icon: 'book-open', run: () => click('settings-presets') },
    { label: '文字・見出しの書式', keywords: '本文全体 文字サイズ 太字 圏点 揃え', icon: 'type', run: () => host.showSettings('typography') },
    { label: '見開きで表示', keywords: 'view spread プレビュー', icon: 'book-open', desktopOnly: true, run: () => view('view-spread') },
    { label: '単ページで表示', keywords: 'view single プレビュー', icon: 'file', run: () => view('view-single') },
    { label: 'ページ一覧を表示', keywords: 'view gallery プレビュー 複数選択', icon: 'grid-2x2', run: () => view('view-gallery') },
    { label: '紙面に集中', keywords: 'focus 表示 パネル', icon: 'maximize-2', desktopOnly: true, run: () => { host.showPreview(); host.focusPaper(); } },
    { label: '章・ページを追加', keywords: '表題紙 目次 奥付 扉 構成', icon: 'plus', run: () => { host.showLeft('structure'); click('add-book-item'); } },
    { label: '版面の詳細', keywords: '字数 行数 段組 横書き 綴じ方 左綴じ 右綴じ 白 紙色 pt mm', icon: 'type', run: () => host.showSettings('detail-layout') },
    { label: 'ページ番号', keywords: 'ノンブル folio 設定', icon: 'file', run: () => host.showSettings('detail-folio') },
    { label: '柱を設定', keywords: '見出し ページ上部 header', icon: 'pilcrow', run: () => host.showSettings('detail-heads') },
    { label: '共通スタイルを編集', keywords: '段落 文字 見出し 書式 style', icon: 'type', run: () => {
      host.showSettings('shared-styles'); const details = el('catalog-editor').querySelector<HTMLDetailsElement>('details');
      if (details) { details.open = true; details.querySelector<HTMLElement>('summary')!.focus(); details.scrollIntoView({ block: 'nearest' }); }
    } },
    { label: '作品情報', keywords: '書名 著者 名前 title', icon: 'book-open', run: () => click('edit-project-information') },
    { label: '作業ファイルを保存', keywords: 'save JSON バックアップ 再開', icon:'download', run:()=>click('file-save') },
    { label: 'ルビを付ける', keywords:'ruby 読み ふりがな',icon:'type',run:()=>edit('ruby') },
    { label: '選んだ文字に圏点', keywords:'emphasis 強調 ごま 丸',icon:'type',run:()=>edit('emphasis') },
    { label: '選択範囲を中央揃え', keywords:'center 中央寄せ',icon:'pilcrow',run:()=>edit('center') },
    { label: '範囲の書式を変更', keywords:'range 揃え 段落',icon:'pilcrow',run:()=>edit('range') },
    { label: '改ページを入れる', keywords:'page break',icon:'file',run:()=>edit('page-break') },
    { label: '改丁を入れる', keywords:'recto 奇数 左ページ',icon:'book-open',run:()=>edit('recto') },
    { label: '書き出し', keywords: 'export PNG PDF ZIP 作業 保存 JSON', icon: 'download', run: () => click('open-export') },
    { label: '表示テーマを切り替える', keywords: 'dark light ダーク ライト', icon: 'moon', run: theme },
    { label: '操作ガイド', keywords: 'help ショートカット 使い方', icon: 'circle-help', run: showHelp },
  ];
  function highlight(): void {
    const buttons = results.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button, index) => { button.dataset.active = String(index === active); button.setAttribute('aria-selected', String(index === active)); });
    const selectedButton = buttons[active];
    if (selectedButton) { search.setAttribute('aria-activedescendant', selectedButton.id); selectedButton.scrollIntoView({ block: 'nearest' }); }
    else search.removeAttribute('aria-activedescendant');
  }
  function run(index: number): void { const command = filtered[index]; if (command) { dialog.close(); command.run(); } }
  function render(): void {
    const query = search.value.trim().toLocaleLowerCase('ja-JP');
    filtered = commands.filter(c => (!c.desktopOnly || matchMedia('(min-width:761px)').matches) && `${c.label} ${c.keywords}`.toLocaleLowerCase('ja-JP').includes(query)); active = 0; results.replaceChildren();
    for (const [index, command] of filtered.entries()) {
      const row = document.createElement('li'), button = document.createElement('button'), icon = document.createElement('span'), label = document.createElement('span');
      row.setAttribute('role', 'none'); button.type = 'button'; button.setAttribute('role', 'option'); button.id = `command-${index}`; icon.className = 'icon'; icon.dataset.icon = command.icon; icon.setAttribute('aria-hidden', 'true'); label.textContent = command.label;
      button.append(icon, label); button.addEventListener('click', () => run(index)); row.append(button); results.append(row);
    }
    el('command-empty').hidden = filtered.length !== 0; highlight();
  }
  function open(): void { if (dialog.open) return; const editor=el<HTMLTextAreaElement>('manuscript');manuscriptSelection={value:editor.value,from:editor.selectionStart,to:editor.selectionEnd,scroll:editor.scrollTop}; search.value = ''; render(); dialog.showModal(); search.focus(); }
  el('open-command').addEventListener('click', open); el('close-command').addEventListener('click', () => dialog.close());
  search.addEventListener('input', render);
  search.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = filtered.length ? (active + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0; highlight(); }
    else if (event.key === 'Enter') { event.preventDefault(); run(active); }
  });
  document.addEventListener('keydown', event => {
    if (event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const modal = document.querySelector('dialog[open]');
    if (!modal && !event.shiftKey && event.key.toLowerCase()==='s') {event.preventDefault();click('file-save');}
    else if (!modal && !event.shiftKey && event.key.toLowerCase()==='o') {event.preventDefault();click('file-open');}
    else if (event.key.toLowerCase() === 'k' && !event.shiftKey && (!modal || modal === dialog)) { event.preventDefault(); if (dialog.open) dialog.close(); else open(); }
    else if (event.key.toLowerCase() === 'f' && event.shiftKey && !modal) { event.preventDefault(); host.showPreview(); host.focusPaper(); }
  });
  // Native dialogs trap focus and return it to their opener; clicking the backdrop is also dismissible.
  for (const modal of document.querySelectorAll<HTMLDialogElement>('dialog')) modal.addEventListener('click', event => {
    if (event.target !== modal) return; const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
  });
}
