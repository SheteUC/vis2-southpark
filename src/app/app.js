import { createDataLoader } from './data.js';
import { routes, routesById, sectionToRoute } from './manifest.js';
import { initThemeToggle } from './theme.js';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function createApp({ rootId }) {
  const dataLoader = createDataLoader();
  const state = {
    routeId: 'overview',
    sectionId: 'overview-start',
    levelState: {},
  };

  const els = {
    root: document.getElementById(rootId),
    levelNav: document.getElementById('level-nav'),
    sectionNav: document.getElementById('section-nav'),
  };

  let activeRoute = null;

  function getLevelState(routeId, defaults = {}) {
    if (!state.levelState[routeId]) {
      state.levelState[routeId] = { ...defaults };
    }
    return state.levelState[routeId];
  }

  function updateLevelState(routeId, patch) {
    state.levelState[routeId] = {
      ...getLevelState(routeId),
      ...patch,
    };
  }

  function setHash(sectionId, { replace = false } = {}) {
    const hash = `#${sectionId}`;
    if (replace) {
      history.replaceState(null, '', hash);
      handleHashChange();
      return;
    }
    if (window.location.hash === hash) {
      handleHashChange();
      return;
    }
    window.location.hash = hash;
  }

  function currentContext(route) {
    return {
      container: els.root,
      state,
      route,
      getLevelState: (defaults) => getLevelState(route.id, defaults),
      updateLevelState: (patch) => updateLevelState(route.id, patch),
      loadDataset: dataLoader.loadDataset,
      loadLevelData: dataLoader.loadLevelData,
      navigateTo: setHash,
    };
  }

  function resolveSectionId() {
    const sectionId = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
    if (sectionToRoute.has(sectionId)) return sectionId;
    return routes[0].defaultSection;
  }

  function renderPrimaryNav(activeRouteId) {
    els.levelNav.innerHTML = `
      <ol class="page-nav__list" role="list">
        ${routes.map((route) => `
          <li>
            <a
              href="#${route.defaultSection}"
              class="${classNames('page-nav__link', activeRouteId === route.id && 'active')}"
              data-route-id="${route.id}"
            >
              ${route.shortLabel || route.label}
            </a>
          </li>
        `).join('')}
      </ol>
    `;
  }

  function renderSectionNav(route, activeSectionId) {
    els.sectionNav.innerHTML = `
      <div class="app-section-nav__inner">
        <div class="app-section-nav__eyebrow">${route.label}</div>
        <div class="app-section-nav__links">
          ${route.sections.map((section) => `
            <a
              href="#${section.id}"
              class="${classNames('app-section-link', activeSectionId === section.id && 'active')}"
            >
              ${section.label}
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleHashChange() {
    const sectionId = resolveSectionId();
    const routeId = sectionToRoute.get(sectionId) || routes[0].id;
    const route = routesById[routeId];

    state.routeId = routeId;
    state.sectionId = sectionId;

    renderPrimaryNav(routeId);
    renderSectionNav(route, sectionId);

    if (activeRoute?.id !== routeId) {
      if (activeRoute?.destroy) {
        await activeRoute.destroy(currentContext(activeRoute));
      }
      activeRoute = route;
      await route.init?.(currentContext(route));
      await route.render?.(currentContext(route));
      requestAnimationFrame(() => scrollToSection(sectionId));
      return;
    }

    route.onSectionChange?.(currentContext(route), sectionId);
    requestAnimationFrame(() => scrollToSection(sectionId));
  }

  async function init() {
    initThemeToggle();
    renderPrimaryNav(state.routeId);
    window.addEventListener('hashchange', handleHashChange);
    await handleHashChange();
  }

  return {
    init,
  };
}
