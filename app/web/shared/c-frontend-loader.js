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
      .replace('initGrs002Runtime();', 'if (!window.ARY_DISABLE_GRS002_RUNTIME) initGrs002Runtime();')
      .concat(`\nwindow.ARY_ROUTE_CONTEXT = window.ARY_ROUTE_CONTEXT || { currentWorkId: null, currentRiderId: null, pinnedHomeRaceId: null };\nwindow.ARY_PROTOTYPE_STATE = {\n  getCurrentRaceId: () => currentRaceId,\n  getCurrentResultsRaceId: () => currentResultsRaceId,\n  getCurrentScreenMode: () => currentScreenMode,\n  getCurrentWorkFilter: () => currentWorkFilter,\n  getCurrentWorkId: () => window.ARY_ROUTE_CONTEXT.currentWorkId,\n  getCurrentRiderId: () => window.ARY_ROUTE_CONTEXT.currentRiderId,\n};\nconst __aryRenderHomeRace = renderHomeRace;\nrenderHomeRace = function(raceId) {\n  return __aryRenderHomeRace.apply(this, arguments);\n};\nconst __aryRenderPublicRaceContext = renderPublicRaceContext;\nrenderPublicRaceContext = function(raceId) {\n  const result = __aryRenderPublicRaceContext.apply(this, arguments);\n  if (window.ARY_ROUTE_CONTEXT.pinnedHomeRaceId && document.querySelector('.page-home.active')) {\n    history.replaceState(null, '', '/public/?raceId=' + encodeURIComponent(raceId) + '#home');\n  }\n  return result;\n};\nconst __aryRotateHomeLiveRace = rotateHomeLiveRace;\nrotateHomeLiveRace = function() {\n  if (window.ARY_ROUTE_CONTEXT.pinnedHomeRaceId) return;\n  return __aryRotateHomeLiveRace.apply(this, arguments);\n};\nconst __aryRestartHomeRaceCarousel = restartHomeRaceCarousel;\nrestartHomeRaceCarousel = function() {\n  if (window.ARY_ROUTE_CONTEXT.pinnedHomeRaceId) {\n    window.clearInterval(homeRaceCarouselTimer);\n    return;\n  }\n  return __aryRestartHomeRaceCarousel.apply(this, arguments);\n};\nconst __aryRenderRiderProfile = renderRiderProfile;\nrenderRiderProfile = function(profile) {\n  window.ARY_ROUTE_CONTEXT.currentRiderId = profile?.riderId || null;\n  return __aryRenderRiderProfile.apply(this, arguments);\n};\nconst __aryRenderWorkDetail = renderWorkDetail;\nrenderWorkDetail = function(workId) {\n  window.ARY_ROUTE_CONTEXT.currentWorkId = workId || null;\n  return __aryRenderWorkDetail.apply(this, arguments);\n};\nconst __aryHideWorkDetail = hideWorkDetail;\nhideWorkDetail = function() {\n  window.ARY_ROUTE_CONTEXT.currentWorkId = null;\n  return __aryHideWorkDetail.apply(this, arguments);\n};\n`);

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
      screenMode: params.get('screenMode') || null,
    };
  }

  function getInitialPage(entry) {
    const hashPage = location.hash.replace(/^#/, '');
    if (hashPage) return hashPage;
    if (entry === 'live') return 'live';
    if (entry === 'screen') return 'screen';
    return 'home';
  }

  function activatePage(pageName) {
    const button = document.querySelector(`[data-page="${pageName}"]`);
    button?.click();
  }

  function activateScreenMode(modeName) {
    const button = document.querySelector(`[data-screen-mode="${modeName}"]`);
    button?.click();
  }

  function getSampleData() {
    return window.ARY_SAMPLE_DATA || {};
  }

  function setPinnedHomeRaceId(raceId) {
    window.ARY_ROUTE_CONTEXT = window.ARY_ROUTE_CONTEXT || {};
    window.ARY_ROUTE_CONTEXT.pinnedHomeRaceId = raceId || null;
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

  function getPrototypeState() {
    return window.ARY_PROTOTYPE_STATE || {};
  }

  function getCurrentRaceId(routeState = parseRouteState()) {
    const state = getPrototypeState();
    return state.getCurrentRaceId?.() || routeState.raceId || routeState.resourceId || getSampleData().raceGroups?.featuredRaceId || null;
  }

  function getCurrentResultsRaceId(routeState = parseRouteState()) {
    const state = getPrototypeState();
    return state.getCurrentResultsRaceId?.() || routeState.resourceId || getPreferredResultRaceId();
  }

  function getCurrentWorkId() {
    return getPrototypeState().getCurrentWorkId?.() || null;
  }

  function getCurrentRiderId() {
    return getPrototypeState().getCurrentRiderId?.() || null;
  }

  function getFallbackRiderIdForRace(raceId) {
    if (!raceId) return null;
    const profile = (getSampleData().profiles || []).find((item) => (item.featuredRaceIds || []).includes(raceId));
    return profile?.riderId || null;
  }

  function getRepresentativeRiderIdForRace(raceId) {
    if (!raceId) return null;
    return getFallbackRiderIdForRace(raceId)
      || (getSampleData().riders || []).find((rider) => rider.raceId === raceId)?.id
      || (getSampleData().works || []).find((work) => work.raceId === raceId)?.riderId
      || null;
  }

  function getVisibleHomeRiderId() {
    const riderName = document.querySelector('.benefit-row article:nth-of-type(2) h2')?.textContent?.trim();
    if (!riderName) return null;
    return (getSampleData().profiles || []).find((profile) => profile.displayName === riderName)?.riderId
      || (getSampleData().riders || []).find((rider) => rider.name === riderName)?.id
      || null;
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

  function getCurrentScreenMode() {
    return getPrototypeState().getCurrentScreenMode?.() || 'live';
  }

  function getPathForPage(pageName, routeState = parseRouteState()) {
    const raceId = getCurrentRaceId(routeState);
    const resultsRaceId = getCurrentResultsRaceId(routeState);
    const currentWorkId = getCurrentWorkId();
    const currentRiderId = getCurrentRiderId();
    const params = new URLSearchParams();

    switch (pageName) {
      case 'home':
        return '/public/#home';
      case 'race':
        return raceId ? `/race/${encodeURIComponent(raceId)}` : '/race/';
      case 'live':
        return raceId ? `/live/${encodeURIComponent(raceId)}` : '/live/';
      case 'works':
        if (raceId) params.set('raceId', raceId);
        if (getPrototypeState().getCurrentWorkFilter?.()) params.set('filter', getPrototypeState().getCurrentWorkFilter());
        return `/works${params.toString() ? `?${params.toString()}` : ''}`;
      case 'results':
        return resultsRaceId ? `/results/${encodeURIComponent(resultsRaceId)}` : '/results/';
      case 'review':
        return resultsRaceId ? `/review/${encodeURIComponent(resultsRaceId)}` : '/review/';
      case 'rider':
        return currentRiderId
          ? `/riders/${encodeURIComponent(currentRiderId)}`
          : getVisibleHomeRiderId()
            ? `/riders/${encodeURIComponent(getVisibleHomeRiderId())}`
            : getRepresentativeRiderIdForRace(raceId)
              ? `/riders/${encodeURIComponent(getRepresentativeRiderIdForRace(raceId))}`
              : '/riders/';
      case 'cooperation':
        return '/cooperation';
      case 'screen': {
        if (raceId) params.set('screenMode', getCurrentScreenMode());
        const query = params.toString() ? `?${params.toString()}` : '';
        return raceId ? `/screen/${encodeURIComponent(raceId)}${query}` : '/screen/';
      }
      default:
        return null;
    }
  }

  function updateUrl(nextUrl, replace = false) {
    if (!nextUrl) return;
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    if (currentUrl === nextUrl) return;
    if (replace) history.replaceState(null, '', nextUrl);
    else history.pushState(null, '', nextUrl);
  }

  function applyCurrentRouteState() {
    applyRouteState(parseRouteState());
  }

  function applyRouteState(routeState) {
    const sampleData = getSampleData();
    const resourceId = routeState.resourceId;

    switch (routeState.routeKind) {
      case 'race': {
        const raceId = resourceId || sampleData.raceGroups?.featuredRaceId;
        if (typeof window.renderPublicRaceContext === 'function' && raceId) window.renderPublicRaceContext(raceId);
        activatePage('race');
        return;
      }
      case 'works': {
        const work = resourceId ? getWorkById(resourceId) : null;
        const raceId = routeState.raceId || work?.raceId || sampleData.raceGroups?.featuredRaceId;
        if (typeof window.renderPublicRaceContext === 'function' && raceId) window.renderPublicRaceContext(raceId);
        activatePage('works');
        if (routeState.filter && typeof window.renderWorksPage === 'function') window.renderWorksPage(raceId, routeState.filter);
        if (resourceId && typeof window.renderWorkDetail === 'function') window.renderWorkDetail(resourceId);
        return;
      }
      case 'results': {
        const raceId = resourceId || getPreferredResultRaceId();
        if (typeof window.renderResultsAndReview === 'function' && raceId) window.renderResultsAndReview(raceId);
        activatePage('results');
        return;
      }
      case 'review': {
        const raceId = resourceId || getPreferredResultRaceId();
        if (typeof window.renderResultsAndReview === 'function' && raceId) window.renderResultsAndReview(raceId);
        activatePage('review');
        return;
      }
      case 'riders': {
        const profile = resourceId ? getProfileById(resourceId) : (getSampleData().profiles || [])[0];
        activatePage('rider');
        if (typeof window.renderRiderProfile === 'function' && profile) window.renderRiderProfile(profile);
        else renderUnavailableRiderProfile(resourceId);
        return;
      }
      case 'cooperation':
        activatePage('cooperation');
        return;
      case 'live':
        if (typeof window.renderPublicRaceContext === 'function') {
          const raceId = resourceId || sampleData.raceGroups?.featuredRaceId;
          if (raceId) window.renderPublicRaceContext(raceId);
        }
        activatePage('live');
        return;
      case 'screen':
        if (typeof window.renderPublicRaceContext === 'function') {
          const raceId = resourceId || sampleData.raceGroups?.featuredRaceId;
          if (raceId) window.renderPublicRaceContext(raceId);
        }
        activatePage('screen');
        activateScreenMode(routeState.screenMode || 'live');
        return;
      default:
        if (routeState.routeKind === 'public' && routeState.raceId && typeof window.renderHomeRace === 'function' && typeof window.renderPublicRaceContext === 'function') {
          setPinnedHomeRaceId(routeState.raceId);
          window.renderHomeRace(routeState.raceId);
          window.renderPublicRaceContext(routeState.raceId);
        } else if (routeState.routeKind === 'public') {
          setPinnedHomeRaceId(null);
        }
        activatePage(getInitialPage(routeState.entry));
    }
  }

  function bindRouteSync() {
    document.addEventListener('click', (event) => {
      const routeState = parseRouteState();
      const workButton = event.target.closest('[data-work-id]');
      if (workButton) {
        updateUrl(`/works/${encodeURIComponent(workButton.dataset.workId)}`);
        applyCurrentRouteState();
        return;
      }

      const workCloseButton = event.target.closest('[data-work-close]');
      if (workCloseButton) {
        updateUrl(getPathForPage('works', routeState));
        applyCurrentRouteState();
        return;
      }

      const resultsRaceButton = event.target.closest('[data-results-race]');
      if (resultsRaceButton) {
        const isReviewPage = Boolean(document.querySelector('.page-review.active'));
        updateUrl(`/${isReviewPage ? 'review' : 'results'}/${encodeURIComponent(resultsRaceButton.dataset.resultsRace)}`);
        applyCurrentRouteState();
        return;
      }

      const liveRaceButton = event.target.closest('[data-live-race]');
      if (liveRaceButton && routeState.routeKind === 'public') {
        setPinnedHomeRaceId(liveRaceButton.dataset.liveRace);
        window.requestAnimationFrame(() => {
          updateUrl(`/public/?raceId=${encodeURIComponent(liveRaceButton.dataset.liveRace)}#home`, true);
          applyCurrentRouteState();
        });
        return;
      }

      const workFilterButton = event.target.closest('[data-work-filter]');
      if (workFilterButton) {
        const params = new URLSearchParams();
        const raceId = getCurrentRaceId(routeState);
        if (raceId) params.set('raceId', raceId);
        if (workFilterButton.dataset.workFilter) params.set('filter', workFilterButton.dataset.workFilter);
        updateUrl(`/works${params.toString() ? `?${params.toString()}` : ''}`);
        applyCurrentRouteState();
        return;
      }

      const screenModeButton = event.target.closest('[data-screen-mode]');
      if (screenModeButton && routeState.routeKind === 'screen') {
        const raceId = getCurrentRaceId(routeState);
        const params = new URLSearchParams();
        if (screenModeButton.dataset.screenMode) params.set('screenMode', screenModeButton.dataset.screenMode);
        const query = params.toString() ? `?${params.toString()}` : '';
        updateUrl(raceId ? `/screen/${encodeURIComponent(raceId)}${query}` : `/screen/${query}`);
        applyCurrentRouteState();
        return;
      }

      const pageButton = event.target.closest('[data-page]');
      if (pageButton) {
        updateUrl(getPathForPage(pageButton.dataset.page, routeState));
        applyCurrentRouteState();
      }
    });

    window.addEventListener('popstate', () => {
      applyRouteState(parseRouteState());
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
      document.body.dataset.shellEntry = routeState.entry;
      applyRouteState(routeState);
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