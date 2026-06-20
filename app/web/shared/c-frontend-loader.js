(function () {
  const prototypeIndexPath = '/c-frontend-prototype/index.html';
  const prototypeStylesPath = '/c-frontend-prototype/styles.css';
  const prototypeScriptPath = '/c-frontend-prototype/script.js';

  function ensurePrototypeStyles() {
    if (document.querySelector('link[data-c-frontend-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = prototypeStylesPath;
    link.setAttribute('data-c-frontend-styles', 'true');
    document.head.appendChild(link);
  }

  function ensureEntryStyles() {
    if (document.querySelector('style[data-c-frontend-entry]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-c-frontend-entry', 'true');
    style.textContent = [
      'body{margin:0;min-height:100vh;background:#eef6ff;color:#07163e;}',
      '.shell-loading{min-height:100vh;display:grid;place-items:center;padding:24px;font:600 16px/1.6 "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}',
      '.shell-loading-card{max-width:560px;padding:24px 28px;border:1px solid rgba(24,92,218,.14);border-radius:18px;background:rgba(255,255,255,.85);box-shadow:0 18px 44px rgba(11,57,150,.12);}',
      '.shell-loading-card h1{margin:0 0 10px;font-size:24px;}',
      '.shell-loading-card p{margin:0;color:#53668d;}',
      'body[data-shell-entry="screen"] .mobile-prototype-note, body[data-shell-entry="screen"] .deck-header, body[data-shell-entry="screen"] .screen-demo-control{display:none !important;}',
      'body[data-shell-entry="screen"] .prototype-stage, body[data-shell-entry="screen"] .deck-shell{width:100vw;height:100vh;}',
      'body[data-shell-entry="screen"] .deck-shell{padding:0;transform:none !important;}',
      'body[data-shell-entry="screen"] .deck{height:100vh;margin-top:0;}',
      'body[data-shell-entry="screen"] .screen-output{height:100vh;padding:38px 46px 30px;}',
      'body[data-shell-entry="live"] .screen-demo-control{display:none;}',
    ].join('');
    document.head.appendChild(style);
  }

  async function loadPrototypeScript() {
    const response = await fetch(prototypeScriptPath);
    if (!response.ok) throw new Error(`Failed to fetch prototype script: ${response.status}`);
    const originalScript = await response.text();
    const patchedScript = 'window.ARY_DISABLE_GRS002_RUNTIME = true;\n' + originalScript
      .replaceAll('./assets/', '/c-frontend-prototype/assets/')
      .replaceAll('./data/', '/c-frontend-prototype/data/')
      .replace('initGrs002Runtime();', 'if (!window.ARY_DISABLE_GRS002_RUNTIME) initGrs002Runtime();');

    const script = document.createElement('script');
    script.text = patchedScript;
    document.body.appendChild(script);
  }

  function rewriteRelativeAsset(root, attributeName) {
    if (!root.getAttribute) return;
    const value = root.getAttribute(attributeName);
    if (!value || !value.startsWith('./')) return;
    root.setAttribute(attributeName, `/c-frontend-prototype/${value.slice(2)}`);
  }

  function rewriteRelativeAssets(fragment) {
    const allNodes = [fragment, ...fragment.querySelectorAll('*')];
    allNodes.forEach((node) => {
      rewriteRelativeAsset(node, 'src');
      rewriteRelativeAsset(node, 'href');
    });
  }

  function inferEntry() {
    return document.body.dataset.entry || (location.pathname.startsWith('/live') ? 'live' : location.pathname.startsWith('/screen') ? 'screen' : 'public');
  }

  function parseRouteState() {
    const params = new URLSearchParams(location.search);
    const segments = location.pathname.split('/').filter(Boolean);
    const routeKind = document.body.dataset.routeKind || segments[0] || 'public';
    return {
      routeKind,
      resourceId: segments[1] || null,
      entry: inferEntry(),
      raceId: params.get('raceId') || null,
      filter: params.get('filter') || null,
      screenMode: params.get('mode') || params.get('screenMode') || null,
    };
  }

  function getSampleData() {
    return window.ARY_SAMPLE_DATA || {};
  }

  function getCFrontendApi() {
    return window.ARY_C_FRONTEND || null;
  }

  function getProfileById(riderId) {
    return (getSampleData().profiles || []).find((profile) => profile.riderId === riderId);
  }

  function getWorkById(workId) {
    return (getSampleData().works || []).find((work) => work.id === workId);
  }

  function getPreferredResultRaceId() {
    const sampleData = getSampleData();
    return sampleData.raceGroups?.completedRaceIds?.[0] || sampleData.results?.[0]?.raceId || null;
  }

  function renderUnavailableRiderProfile(riderId) {
    const rider = (getSampleData().riders || []).find((item) => item.id === riderId);
    const riderName = rider?.name || riderId || '当前 Rider';
    const titleNode = document.querySelector('.page-rider .module-title h1');
    const summaryNode = document.querySelector('.page-rider .module-summary');
    const kickerNode = document.querySelector('.page-rider .module-title .section-kicker');
    const cardTitleNode = document.querySelector('.profile-card h2');
    const cardTextNode = document.querySelector('.profile-card p');
    const statsNode = document.querySelector('.profile-stats');
    const gridNode = document.querySelector('.portfolio-grid');

    if (kickerNode) kickerNode.textContent = 'Rider Profile / Public Unavailable';
    if (titleNode) titleNode.textContent = riderName;
    if (summaryNode) summaryNode.textContent = '当前 Rider 没有公开档案或公开证据摘要，不进入 Public Rider Profile。';
    if (cardTitleNode) cardTitleNode.textContent = riderName;
    if (cardTextNode) cardTextNode.textContent = 'Public profile unavailable';
    if (statsNode) {
      statsNode.innerHTML = '<span><b>0</b> public works</span><span><b>0</b> awards</span><span><b>private</b> profile</span>';
    }
    if (gridNode) {
      gridNode.innerHTML = '<article><span>Public Rule</span><b>Profile 未公开</b></article><article><span>Evidence</span><b>不展示原始 RidingRecord 或原始 CA Session</b></article><article><span>Work</span><b>仅公开作品和公开证据摘要进入公开端</b></article><article><span>Next Step</span><b>等待公开档案或公开作品发布后再进入 Rider Profile</b></article>';
    }
  }

  function getFeaturedRaceId() {
    return getSampleData().raceGroups?.featuredRaceId || null;
  }

  function setShellEntry(routeState) {
    const entry = routeState.routeKind === 'live'
      ? 'live'
      : routeState.routeKind === 'screen'
        ? 'screen'
        : 'public';
    document.body.dataset.shellEntry = entry;
  }

  function buildRouteInput(routeState) {
    const featuredRaceId = getFeaturedRaceId();
    const work = routeState.resourceId ? getWorkById(routeState.resourceId) : null;
    const preferredResultRaceId = getPreferredResultRaceId();
    const baseState = {
      workId: null,
      riderId: null,
      resultsRaceId: preferredResultRaceId,
      workFilter: 'public',
      screenMode: 'live',
      homeRacePinned: true,
    };

    switch (routeState.routeKind) {
      case 'race':
        return { ...baseState, page: 'race', raceId: routeState.resourceId || featuredRaceId };
      case 'works':
        return {
          ...baseState,
          page: 'works',
          raceId: routeState.raceId || work?.raceId || featuredRaceId,
          workId: routeState.resourceId || null,
          workFilter: routeState.filter || 'public',
        };
      case 'results':
        return {
          ...baseState,
          page: 'results',
          raceId: routeState.resourceId || preferredResultRaceId,
          resultsRaceId: routeState.resourceId || preferredResultRaceId,
        };
      case 'review':
        return {
          ...baseState,
          page: 'review',
          raceId: routeState.resourceId || preferredResultRaceId,
          resultsRaceId: routeState.resourceId || preferredResultRaceId,
        };
      case 'riders':
        return {
          ...baseState,
          page: 'rider',
          raceId: getProfileById(routeState.resourceId || (getSampleData().profiles || [])[0]?.riderId || null)?.featuredRaceIds?.[0] || featuredRaceId,
          riderId: routeState.resourceId || (getSampleData().profiles || [])[0]?.riderId || null,
        };
      case 'cooperation':
        return { ...baseState, page: 'cooperation', raceId: featuredRaceId };
      case 'live':
        return { ...baseState, page: 'live', raceId: routeState.resourceId || featuredRaceId };
      case 'screen':
        return { ...baseState, page: 'screen', raceId: routeState.resourceId || featuredRaceId, screenMode: routeState.screenMode || 'live' };
      case 'public':
      default:
        return { ...baseState, page: 'home', raceId: routeState.raceId || featuredRaceId, homeRacePinned: Boolean(routeState.raceId) };
    }
  }

  function applyRouteState(routeState, options = {}) {
    setShellEntry(routeState);
    const api = getCFrontendApi();
    if (!api?.applyRouteState) throw new Error('C frontend route API is unavailable');

    const routeInput = buildRouteInput(routeState);
    api.applyRouteState(routeInput, { syncUrl: false, replace: options.replace !== false });

    if (routeState.routeKind === 'riders' && routeState.resourceId && !getProfileById(routeState.resourceId)) {
      renderUnavailableRiderProfile(routeState.resourceId);
    }
  }

  function bindRouteSync() {
    window.addEventListener('ary:c-frontend-route-change', (event) => {
      const url = event.detail?.url;
      if (!url) return;
      const nextRouteState = parseRouteState();
      setShellEntry(nextRouteState);
    });

    window.addEventListener('popstate', () => {
      applyRouteState(parseRouteState(), { replace: true });
    });
  }

  function showFailure(error) {
    console.error(error);
    document.body.innerHTML = `<main class="shell-loading"><section class="shell-loading-card"><h1>C-Frontend 集成加载失败</h1><p>${error.message}</p></section></main>`;
  }

  async function loadShell() {
    try {
      ensurePrototypeStyles();
      ensureEntryStyles();
      await (window.ARY_RUNTIME_READY || Promise.resolve());

      const response = await fetch(prototypeIndexPath);
      if (!response.ok) throw new Error(`Failed to fetch prototype shell: ${response.status}`);
      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const fragment = document.createDocumentFragment();

      Array.from(parsed.body.children).forEach((child) => {
        if (child.tagName === 'SCRIPT') return;
        const clone = child.cloneNode(true);
        rewriteRelativeAssets(clone);
        fragment.appendChild(clone);
      });

      document.body.innerHTML = '';
      document.body.dataset.shellEntry = inferEntry();
      document.body.appendChild(fragment);

      await loadPrototypeScript();

      const routeState = parseRouteState();
      applyRouteState(routeState, { replace: true });
      bindRouteSync();
    } catch (error) {
      showFailure(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadShell, { once: true });
  } else {
    loadShell();
  }
})();