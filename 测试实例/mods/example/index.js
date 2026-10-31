WebLoader.addStyle(`
  #webloader-example-badge {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    padding: 6px 10px;
    border-radius: 999px;
    background: #00a1d6;
    color: #fff;
    font: 12px/1.4 system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
`);

WebLoader.onReady(() => {
  const badge = document.createElement('div');
  badge.id = 'webloader-example-badge';
  badge.textContent = 'WebLoader example';
  document.body.appendChild(badge);
});

WebLoader.log('示例 Mod 已加载');
