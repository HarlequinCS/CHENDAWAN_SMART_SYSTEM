function renderTools() {
  const grid = document.getElementById('toolsGrid');
  if (!grid || !Array.isArray(window.CHENDAWAN_TOOLS)) return;

  grid.innerHTML = '';

  window.CHENDAWAN_TOOLS.forEach((tool) => {
    const isReady = tool.status === 'ready';
    const el = document.createElement(isReady ? 'a' : 'div');
    el.className = 'tool-tile' + (isReady ? '' : ' is-soon');
    if (isReady) {
      el.href = tool.href;
    } else {
      el.setAttribute('aria-disabled', 'true');
    }

    el.innerHTML = `
      <div class="tool-tile-top">
        <h2 class="tool-name">${tool.name}</h2>
        ${isReady ? '<span class="tool-badge">Open</span>' : '<span class="tool-badge soon">Coming soon</span>'}
      </div>
      <p class="tool-desc">${tool.description}</p>
    `;

    grid.appendChild(el);
  });
}

document.addEventListener('DOMContentLoaded', renderTools);
