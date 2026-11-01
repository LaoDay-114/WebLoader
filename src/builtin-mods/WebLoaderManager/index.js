'use strict';

(function () {
  if (window.top !== window) {
    return;
  }
  if (document.querySelector('[data-webloader-manager]')) {
    return;
  }

  WebLoader.onReady(function () {
    if (document.querySelector('[data-webloader-manager]')) {
      return;
    }

    const STORAGE_KEY = 'welcomeSeen';
    const MOD_ID = 'WebLoaderManager';
    const supportsModManagement =
      typeof WebLoader.getMods === 'function' &&
      typeof WebLoader.setModEnabled === 'function';

    let mods = [];
    let panelMode = 'manager';
    let busy = false;
    let toastTimer = null;
    let welcomeMarked = false;

    function element(tagName, className, text) {
      const node = document.createElement(tagName);
      if (className) {
        node.className = className;
      }
      if (text !== undefined) {
        node.textContent = text;
      }
      return node;
    }

    function button(className, text, label) {
      const node = element('button', className, text);
      node.type = 'button';
      if (label) {
        node.setAttribute('aria-label', label);
      }
      return node;
    }

    function markWelcomeSeen() {
      if (welcomeMarked) {
        return;
      }
      welcomeMarked = true;
      WebLoader.storage.set(STORAGE_KEY, true);
    }

    const host = document.createElement('div');
    host.setAttribute('data-webloader-manager', '');
    host.setAttribute('data-webloader-mod', MOD_ID);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      *, *::before, *::after { box-sizing: border-box; }
      [hidden] { display: none !important; }

      .wl-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 9px 13px 9px 11px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: #14171e;
        color: #f4f6fb;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.32);
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
      }
      .wl-launcher:hover {
        transform: translateY(-1px);
        background: #1c2029;
        border-color: rgba(255, 255, 255, 0.26);
      }
      .wl-launcher:focus-visible,
      .wl-close:focus-visible,
      .wl-primary:focus-visible,
      .wl-secondary:focus-visible,
      .wl-refresh:focus-visible {
        outline: 2px solid #5aa9ff;
        outline-offset: 2px;
      }
      .wl-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.14);
      }
      .wl-launcher-badge {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        font-size: 11px;
        line-height: 18px;
        text-align: center;
      }

      .wl-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: rgba(5, 7, 12, 0.58);
        animation: wl-fade 0.16s ease-out;
      }
      .wl-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        bottom: 20px;
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        width: min(432px, calc(100vw - 40px));
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 18px;
        background: linear-gradient(180deg, #191c23 0%, #111318 100%);
        color: #eef1f7;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        animation: wl-slide 0.2s ease-out;
      }
      .wl-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 20px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .wl-brand {
        display: flex;
        align-items: center;
        gap: 11px;
        min-width: 0;
      }
      .wl-logo {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex: 0 0 auto;
        border-radius: 10px;
        background: linear-gradient(135deg, #56a8ff, #2f66f4);
        color: #fff;
        font: 700 17px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        box-shadow: 0 6px 16px rgba(47, 102, 244, 0.28);
      }
      .wl-eyebrow {
        display: block;
        margin-bottom: 2px;
        color: #7e8ba3;
        font: 600 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        letter-spacing: 0.14em;
      }
      .wl-title {
        margin: 0;
        color: #f7f9fd;
        font: 650 18px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-close {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        flex: 0 0 auto;
        margin: 0;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.04);
        color: #aab4c6;
        font: 400 20px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      .wl-close:hover {
        background: rgba(255, 255, 255, 0.09);
        color: #fff;
      }
      .wl-body {
        flex: 1;
        overflow: auto;
        padding: 18px 20px;
        scrollbar-width: thin;
        scrollbar-color: #3b4250 transparent;
      }
      .wl-lead {
        margin: 0 0 16px;
        color: #c6cedd;
        font: 400 14px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-feature {
        display: flex;
        gap: 11px;
        padding: 12px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
      }
      .wl-feature:last-of-type {
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      }
      .wl-feature-icon {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        flex: 0 0 auto;
        border-radius: 8px;
        background: rgba(90, 169, 255, 0.12);
        color: #7cbcff;
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      }
      .wl-feature strong {
        display: block;
        margin-bottom: 2px;
        color: #edf1f8;
        font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-feature span {
        color: #8e9ab0;
        font: 400 12px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
      .wl-primary,
      .wl-secondary,
      .wl-refresh {
        margin: 0;
        border-radius: 10px;
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        cursor: pointer;
      }
      .wl-primary {
        flex: 1;
        padding: 11px 16px;
        border: 1px solid rgba(120, 180, 255, 0.4);
        background: #2f66f4;
        color: #fff;
        box-shadow: 0 8px 20px rgba(47, 102, 244, 0.24);
      }
      .wl-primary:hover { background: #3d72fa; }
      .wl-secondary {
        padding: 11px 14px;
        border: 1px solid rgba(255, 255, 255, 0.13);
        background: rgba(255, 255, 255, 0.04);
        color: #b9c3d4;
      }
      .wl-secondary:hover { background: rgba(255, 255, 255, 0.08); }
      .wl-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }
      .wl-count {
        color: #99a5ba;
        font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-refresh {
        padding: 6px 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: #aeb9cb;
        font-size: 12px;
      }
      .wl-refresh:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
      .wl-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wl-list.is-busy {
        pointer-events: none;
        opacity: 0.65;
      }
      .wl-mod {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.035);
      }
      .wl-mod.is-disabled { opacity: 0.72; }
      .wl-mod-info {
        flex: 1;
        min-width: 0;
      }
      .wl-mod-line {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }
      .wl-mod-name {
        overflow: hidden;
        color: #f1f4fa;
        font: 600 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wl-builtin {
        flex: 0 0 auto;
        padding: 2px 6px;
        border: 1px solid rgba(90, 169, 255, 0.28);
        border-radius: 999px;
        background: rgba(90, 169, 255, 0.12);
        color: #8ec5ff;
        font: 600 9px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-mod-id {
        margin-top: 1px;
        overflow: hidden;
        color: #758299;
        font: 400 10px/1.4 Consolas, "SFMono-Regular", monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wl-mod-meta {
        margin-top: 3px;
        overflow: hidden;
        color: #9aa6ba;
        font: 400 11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wl-switch {
        position: relative;
        display: inline-flex;
        width: 42px;
        height: 24px;
        flex: 0 0 auto;
        cursor: pointer;
      }
      .wl-switch input {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
      }
      .wl-switch-track {
        position: relative;
        width: 42px;
        height: 24px;
        border-radius: 999px;
        background: #3a4150;
        transition: background 0.16s ease;
      }
      .wl-switch-track::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.16s ease;
      }
      .wl-switch input:checked + .wl-switch-track { background: #2f9e62; }
      .wl-switch input:checked + .wl-switch-track::after { transform: translateX(18px); }
      .wl-switch input:focus-visible + .wl-switch-track {
        outline: 2px solid #5aa9ff;
        outline-offset: 2px;
      }
      .wl-switch input:disabled + .wl-switch-track {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .wl-empty {
        padding: 30px 14px;
        border: 1px dashed rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        color: #8e9ab0;
        font: 400 12px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
        text-align: center;
      }
      .wl-hint {
        margin: 14px 0 0;
        color: #778399;
        font: 400 11px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 11px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        color: #68748a;
        font: 400 10px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-toast {
        position: fixed;
        right: 20px;
        bottom: 74px;
        z-index: 2147483647;
        max-width: min(360px, calc(100vw - 40px));
        padding: 10px 13px;
        border: 1px solid rgba(74, 222, 128, 0.25);
        border-radius: 10px;
        background: #17231c;
        color: #bdf5d1;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        font: 500 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      }
      .wl-toast.is-error {
        border-color: rgba(248, 113, 113, 0.3);
        background: #291719;
        color: #fecaca;
      }
      @keyframes wl-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes wl-slide {
        from { opacity: 0; transform: translateX(18px); }
        to { opacity: 1; transform: none; }
      }
      @media (max-width: 560px) {
        .wl-panel {
          top: 10px;
          right: 10px;
          bottom: 10px;
          width: calc(100vw - 20px);
        }
      }
    `;

    const launcher = button('wl-launcher', '', '打开 WebLoader Mod 管理器');
    const dot = element('span', 'wl-dot');
    const launcherLabel = element('span', '', 'WebLoader');
    const launcherBadge = element('span', 'wl-launcher-badge', '0');
    launcher.append(dot, launcherLabel, launcherBadge);

    const backdrop = element('div', 'wl-backdrop');
    backdrop.hidden = true;

    const panel = element('section', 'wl-panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'webloader-manager-title');

    const head = element('div', 'wl-head');
    const brand = element('div', 'wl-brand');
    const logo = element('span', 'wl-logo', 'W');
    const brandText = element('div');
    const eyebrow = element('span', 'wl-eyebrow', 'WEBLOADER');
    const title = element('h2', 'wl-title', 'Mod 管理');
    title.id = 'webloader-manager-title';
    const closeButton = button('wl-close', '×', '关闭');
    brandText.append(eyebrow, title);
    brand.append(logo, brandText);
    head.append(brand, closeButton);

    const body = element('div', 'wl-body');

    const welcomeView = element('div');
    const lead = element(
      'p',
      'wl-lead',
      '欢迎使用 WebLoader。这个页面现在由 WebLoader 加载，你安装的 Mod 可以在这里统一查看和管理。内置的 Page Toolkit 默认关闭，可在管理器中手动开启。',
    );
    const features = [
      ['01', '统一管理', '查看已安装的 Mod，并随时启用或禁用。'],
      ['02', '即时生效', '切换 Mod 状态后，页面会自动重新加载。'],
      ['03', '内置管理器', 'WebLoaderManager 受保护，内置 Page Toolkit 可以手动开关。'],
    ].map(function (item) {
      const feature = element('div', 'wl-feature');
      const icon = element('span', 'wl-feature-icon', item[0]);
      const text = element('div');
      text.append(element('strong', '', item[1]), element('span', '', item[2]));
      feature.append(icon, text);
      return feature;
    });
    const welcomeActions = element('div', 'wl-actions');
    const startButton = button('wl-primary', '开始管理 Mod');
    const laterButton = button('wl-secondary', '稍后再说');
    welcomeActions.append(startButton, laterButton);
    welcomeView.append(lead, ...features, welcomeActions);

    const managerView = element('div');
    managerView.hidden = true;
    const toolbar = element('div', 'wl-toolbar');
    const countLabel = element('span', 'wl-count', '正在读取 Mod 列表…');
    const refreshButton = button('wl-refresh', '刷新');
    toolbar.append(countLabel, refreshButton);
    const list = element('div', 'wl-list');
    const hint = element(
      'p',
      'wl-hint',
      '切换开关后会保存到 WebLoader.loader.config.json，并自动刷新页面。WebLoaderManager 受保护，不能禁用。',
    );
    managerView.append(toolbar, list, hint);

    body.append(welcomeView, managerView);

    const footer = element('div', 'wl-footer');
    const footerVersion = element('span', '', 'WebLoader ' + WebLoader.version);
    const footerNote = element('span', '', '内置 Mod 管理器');
    footer.append(footerVersion, footerNote);

    const toast = element('div', 'wl-toast');
    toast.hidden = true;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    panel.append(head, body, footer);
    shadow.append(style, launcher, backdrop, panel, toast);

    function showToast(message, isError) {
      toast.textContent = message;
      toast.classList.toggle('is-error', Boolean(isError));
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.hidden = true;
      }, 2800);
    }

    function updateBadge() {
      const enabledCount = mods.filter(function (mod) {
        return mod.enabled;
      }).length;
      launcherBadge.textContent = String(enabledCount);
      launcherBadge.hidden = mods.length === 0;
      launcher.setAttribute(
        'aria-label',
        '打开 WebLoader Mod 管理器（' + enabledCount + ' 个 Mod 已启用）',
      );
    }

    function renderMods() {
      list.textContent = '';
      list.classList.remove('is-busy');
      const enabledCount = mods.filter(function (mod) {
        return mod.enabled;
      }).length;
      countLabel.textContent =
        '已安装 ' + mods.length + ' 个 Mod，' + enabledCount + ' 个启用';

      if (!supportsModManagement) {
        list.append(
          element(
            'div',
            'wl-empty',
            '当前 WebLoader 版本不支持 Mod 管理 API。请更新 WebLoader 后再试。',
          ),
        );
        refreshButton.disabled = true;
        return;
      }

      refreshButton.disabled = false;

      if (mods.length === 0) {
        list.append(
          element(
            'div',
            'wl-empty',
            '目前还没有安装其他 Mod。运行 WebLoader create <Mod名字> 创建一个 Mod，然后刷新页面。',
          ),
        );
        return;
      }

      for (const mod of mods) {
        const row = element('div', 'wl-mod');
        if (!mod.enabled) {
          row.classList.add('is-disabled');
        }

        const info = element('div', 'wl-mod-info');
        const line = element('div', 'wl-mod-line');
        const name = element('span', 'wl-mod-name', mod.name || mod.id);
        line.append(name);
        if (mod.builtin) {
          line.append(element('span', 'wl-builtin', '内置'));
        }

        const idLabel = element('div', 'wl-mod-id', mod.id);
        const metaParts = [];
        if (mod.version) {
          metaParts.push('v' + mod.version);
        }
        if (mod.author) {
          metaParts.push(mod.author);
        }
        const meta = element('div', 'wl-mod-meta', metaParts.join(' · '));
        info.append(line, idLabel, meta);

        const switchLabel = element('label', 'wl-switch');
        switchLabel.title = mod.protected ? '受保护的内置 Mod 不能禁用' : '启用或禁用此 Mod';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = mod.enabled === true;
        input.disabled = Boolean(mod.protected) || busy;
        input.dataset.modId = mod.id;
        input.dataset.builtin = mod.builtin ? '1' : '0';
        input.dataset.protected = mod.protected ? '1' : '0';
        input.setAttribute(
          'aria-label',
          (mod.enabled ? '禁用 ' : '启用 ') + (mod.name || mod.id),
        );
        input.addEventListener('change', function () {
          toggleMod(mod, input);
        });
        const track = element('span', 'wl-switch-track');
        switchLabel.append(input, track);

        row.append(info, switchLabel);
        list.append(row);
      }
    }

    function loadMods() {
      mods = [];
      if (!supportsModManagement) {
        return;
      }
      try {
        const result = WebLoader.getMods();
        mods = Array.isArray(result) ? result : [];
      } catch (error) {
        WebLoader.error(error);
        mods = [];
      }
    }

    function refreshMods(showMessage) {
      loadMods();
      renderMods();
      updateBadge();
      if (showMessage) {
        showToast('Mod 列表已刷新。');
      }
    }

    function toggleMod(mod, input) {
      if (busy || mod.protected) {
        return;
      }

      const nextEnabled = input.checked;
      busy = true;
      list.classList.add('is-busy');

      let success = false;
      try {
        success = WebLoader.setModEnabled(mod.id, nextEnabled) === true;
      } catch (error) {
        WebLoader.error(error);
      }

      busy = false;
      list.classList.remove('is-busy');

      if (!success) {
        input.checked = !nextEnabled;
        showToast(
          '无法修改 ' +
            (mod.name || mod.id) +
            ' 的状态。受保护的内置 Mod 不能禁用，或其他程序正在占用配置文件。',
          true,
        );
        refreshMods(false);
        return;
      }

      refreshMods(false);
      showToast(
        (nextEnabled ? '已启用 ' : '已禁用 ') +
          (mod.name || mod.id) +
          '，页面即将刷新…',
      );
      setTimeout(function () {
        WebLoader.reload();
      }, 700);
    }

    function markWelcomeIfNeeded() {
      if (panelMode === 'welcome') {
        markWelcomeSeen();
      }
    }

    function openPanel(mode) {
      panelMode = mode;
      launcher.hidden = true;
      backdrop.hidden = false;
      panel.hidden = false;

      if (mode === 'welcome') {
        welcomeView.hidden = false;
        managerView.hidden = true;
        title.textContent = '欢迎使用 WebLoader';
      } else {
        welcomeView.hidden = true;
        managerView.hidden = false;
        title.textContent = 'Mod 管理';
        refreshMods(false);
      }

      requestAnimationFrame(function () {
        closeButton.focus({ preventScroll: true });
      });
    }

    function closePanel() {
      markWelcomeIfNeeded();
      panel.hidden = true;
      backdrop.hidden = true;
      launcher.hidden = false;
    }

    startButton.addEventListener('click', function () {
      markWelcomeSeen();
      openPanel('manager');
    });

    laterButton.addEventListener('click', function () {
      markWelcomeSeen();
      closePanel();
    });

    closeButton.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    launcher.addEventListener('click', function () {
      openPanel('manager');
    });
    refreshButton.addEventListener('click', function () {
      refreshMods(true);
    });

    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        closePanel();
      }
    });

    (document.body || document.documentElement).appendChild(host);
    refreshMods(false);

    const welcomeSeen = WebLoader.storage.get(STORAGE_KEY, false) === true;
    if (!welcomeSeen) {
      setTimeout(function () {
        openPanel('welcome');
      }, 350);
    }
  });
})();
