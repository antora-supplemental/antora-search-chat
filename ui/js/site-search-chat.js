/**
 * Mount the dock in the page column so it occupies layout space above the
 * footer. Valentus ends `.valentus-shell` immediately before `footer.footer`;
 * appending there makes that column the sticky containing block. A
 * `position: fixed` overlay on `<body>` covers footer links.
 *
 * Returns the column the dock was attached to.
 */
function placeSearchDock (doc, root) {
  var slot = typeof root.closest === 'function' ? root.closest('.valentus-navbar-search') : null
  if (!slot) slot = root.parentElement
  if (slot && slot !== root && slot.classList) slot.classList.add('valentus-search-slot-vacated')
  if (doc.body && doc.body.classList) doc.body.classList.add('valentus-search-dock-active')

  var shell = doc.querySelector('.valentus-shell')
  var footer = doc.querySelector('footer.footer') || doc.querySelector('footer')
  var column = shell
  if (!column) {
    var main = doc.querySelector('main')
    var mainParent = main && main.parentElement
    if (mainParent && (!footer || !mainParent.contains(footer))) column = mainParent
  }

  if (column && footer && column.contains(footer)) {
    column.insertBefore(root, footer)
  } else if (column) {
    column.appendChild(root)
  } else if (footer && footer.parentElement) {
    footer.parentElement.insertBefore(root, footer)
  } else if (doc.body) {
    doc.body.appendChild(root)
  }

  if (column && column.classList && (!footer || !column.contains(footer))) {
    column.classList.add('valentus-search-dock-column')
  }
  return column || root.parentElement
}

if (typeof document !== 'undefined') {
;(function () {
  'use strict'

  var cfg = window.__ADT_SEARCH_CHAT__ || {}
  var root = document.querySelector('[data-valentus-search-chat]')
  if (!root) return

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-valentus-search-tab]'))
  var form = root.querySelector('[data-valentus-search-ask-form]')
  var inputWrap = root.querySelector('[data-valentus-search-input-wrap]')
  var askWrap = root.querySelector('[data-valentus-ask-wrap]')
  var input = root.querySelector('[data-valentus-ask-input]')
  var result = root.querySelector('[data-valentus-ask-result]')
  var searchInput =
    root.querySelector('[data-valentus-search-input]') || document.getElementById('search-input')
  var ph = root.querySelector('[data-valentus-search-ph]')
  var scopeValueInput = root.querySelector('[data-valentus-search-scope]')
  var scopeSlot = root.querySelector('[data-valentus-search-scope-slot]')
  var scopeTrigger = root.querySelector('[data-valentus-search-scope-trigger]')
  var scopeMenu = root.querySelector('[data-valentus-search-scope-menu]')
  var scopeLabel = root.querySelector('[data-valentus-search-scope-label]')
  var toggle = root.querySelector('[data-valentus-search-toggle]')
  var popover = root.querySelector('[data-valentus-search-popover]')
  var searchSlot = root.closest('.valentus-navbar-search') || root.parentElement
  var semanticEnabled =
    typeof cfg.semanticEnabled === 'boolean'
      ? cfg.semanticEnabled
      : root.getAttribute('data-semantic-enabled') === 'true'
  var placement =
    cfg.placement || root.getAttribute('data-placement') || 'navbar'
  root.setAttribute('data-semantic-enabled', semanticEnabled ? 'true' : 'false')
  root.setAttribute('data-placement', placement === 'dock' ? 'dock' : 'navbar')

  // Dock placement: move the root to the end of the page column (before the
  // footer). The header's transform would trap a fixed descendant, and a
  // fixed overlay on <body> covers the footer. Sticky on the column keeps
  // the dock on screen and leaves its flow box between the article and footer.
  if (placement === 'dock') {
    placeSearchDock(document, root)
    // Scope menu becomes a direct child so it can anchor above the whole dock.
    if (scopeMenu && scopeMenu.parentElement !== root) root.appendChild(scopeMenu)
  }
  var QUERY_PLACEHOLDER = 'Search or ask... /'
  var MIN_EXPANDED_SEARCH_PX = 280
  var COLLAPSE_HYSTERESIS_PX = 24

  function resolveAskEnabled () {
    if (typeof cfg.askEnabled === 'boolean') return cfg.askEnabled
    if (cfg.backendUrl) return true
    if (cfg.localAssist) return true
    var attr = root.getAttribute('data-ask-enabled')
    if (attr === 'true') return true
    if (attr === 'false') return false
    return false
  }

  var askEnabled = resolveAskEnabled()
  root.setAttribute('data-ask-enabled', askEnabled ? 'true' : 'false')

  // Capability strip: Keyword always on (Lunr); Semantic / Chat reflect config.
  var levels = cfg.levels || {}
  root.querySelectorAll('[data-valentus-capability]').forEach(function (box) {
    var level = box.getAttribute('data-valentus-capability')
    var on =
      level === 'keyword'
        ? levels.keyword !== false
        : level === 'semantic'
          ? !!levels.semantic || semanticEnabled
          : !!levels.chat || askEnabled
    box.checked = !!on
    var label = box.closest('.valentus-search-capability')
    if (label) label.classList.toggle('is-off', !on)
  })

  function getScopeOptions () {
    return Array.prototype.slice.call(root.querySelectorAll('[data-valentus-search-scope-option]'))
  }

  function pageContext () {
    return {
      componentTitle: (root.getAttribute('data-component-title') || '').trim(),
      componentName: (root.getAttribute('data-component-name') || '').trim(),
      versionDisplay: (root.getAttribute('data-version-display') || '').trim(),
      version: (root.getAttribute('data-version') || '').trim(),
    }
  }

  function copySearchContextAttributes (fromEl) {
    if (!fromEl) return
    ;['data-component-name', 'data-component-title', 'data-version', 'data-version-display'].forEach(
      function (name) {
        if (fromEl.hasAttribute(name)) root.setAttribute(name, fromEl.getAttribute(name))
        else root.removeAttribute(name)
      }
    )
  }

  /**
   * SoftNav swaps mast/nav/article only — the navbar omnibox stays in the DOM.
   * Rebuild scope tree + data-* from the fetched page so labels do not go stale/blank.
   */
  function applyChromePageContext (ctx) {
    if (!ctx) return
    var comp = ctx.component || {}
    var ver = ctx.version || {}
    if (comp.name) root.setAttribute('data-component-name', comp.name)
    else root.removeAttribute('data-component-name')
    if (comp.title) root.setAttribute('data-component-title', comp.title)
    else root.removeAttribute('data-component-title')
    if (ver.name) root.setAttribute('data-version', ver.name)
    else root.removeAttribute('data-version')
    if (ver.display) root.setAttribute('data-version-display', ver.display)
    else root.removeAttribute('data-version-display')
    syncScopeLabels()
  }

  function refreshSearchContextFromDocument (doc) {
    if (!doc) return
    var freshRoot = doc.querySelector('[data-valentus-search-chat]')
    if (!freshRoot) return

    copySearchContextAttributes(freshRoot)

    var freshMenu = freshRoot.querySelector('[data-valentus-search-scope-menu]')
    if (scopeMenu && freshMenu) {
      scopeMenu.innerHTML = freshMenu.innerHTML
    }

    var freshScopeValue = freshRoot.querySelector('[data-valentus-search-scope]')
    if (scopeValueInput && freshScopeValue) {
      scopeValueInput.value = freshScopeValue.value || 'all'
      if (freshScopeValue.hasAttribute('data-version')) {
        scopeValueInput.setAttribute('data-version', freshScopeValue.getAttribute('data-version'))
      } else {
        scopeValueInput.removeAttribute('data-version')
      }
    }

    setScopeMenuOpen(false)
    syncScopeLabels()
  }

  function onSoftNavLoaded (fn) {
    if (window.SoftNav && typeof window.SoftNav.on === 'function') {
      window.SoftNav.on('loaded', fn)
    } else {
      document.addEventListener('soft-nav:loaded', function (e) {
        fn(e.detail || {})
      })
    }
  }

  function componentLabel (ctx) {
    return ctx.componentTitle || ctx.componentName || ''
  }

  function getScopeValue () {
    return scopeValueInput ? scopeValueInput.value : 'all'
  }

  function getSelectedVersion () {
    return scopeValueInput ? (scopeValueInput.getAttribute('data-version') || '') : ''
  }

  function findOption (scope, version) {
    var scopeOptions = getScopeOptions()
    for (var i = 0; i < scopeOptions.length; i++) {
      var opt = scopeOptions[i]
      if ((opt.getAttribute('data-scope') || '') !== scope) continue
      if (scope === 'version' && (opt.getAttribute('data-version') || '') !== (version || '')) continue
      return opt
    }
    return null
  }

  function versionOptionLabel (opt, pageVer) {
    var display =
      (opt.getAttribute('data-version-display') || '').trim() ||
      (opt.getAttribute('data-version') || '').trim() ||
      'default'
    var label = 'version ' + display
    if (pageVer && (opt.getAttribute('data-version') || '') === pageVer) {
      label += ' - current'
    }
    return label
  }

  function syncScopeLabels () {
    var scopeOptions = getScopeOptions()
    if (!scopeOptions.length) return
    var ctx = pageContext()
    var comp = componentLabel(ctx)
    var pageVer = (ctx.version || '').trim()
    var hasComp = false
    var hasVersionOpts = false

    scopeOptions.forEach(function (opt) {
      var scope = opt.getAttribute('data-scope') || ''
      var textEl = opt.querySelector('[data-valentus-search-scope-option-text]') ||
        opt.querySelector('.valentus-search-scope-option-text')
      if (scope === 'all') {
        opt.setAttribute('data-label', 'All docs')
        if (textEl) textEl.textContent = 'All docs'
        opt.hidden = false
        return
      }
      if (scope === 'component') {
        var compLabel =
          (opt.getAttribute('data-label') || '').trim() ||
          comp ||
          (opt.getAttribute('data-component-name') || '').trim()
        if (compLabel) opt.setAttribute('data-label', compLabel)
        if (textEl) textEl.textContent = compLabel
        opt.hidden = !compLabel
        if (compLabel) hasComp = true
        return
      }
      if (scope === 'version') {
        var ver = (opt.getAttribute('data-version') || '').trim()
        var label = versionOptionLabel(opt, pageVer)
        opt.setAttribute('data-label', label)
        if (textEl) textEl.textContent = label
        // Hide empty / nameless single-default rows when page has no version context.
        var hide = !ver && !pageVer
        opt.hidden = hide
        if (!hide) hasVersionOpts = true
      }
    })

    if (!hasVersionOpts) {
      // No usable version children — keep component / all only.
      scopeOptions.forEach(function (opt) {
        if ((opt.getAttribute('data-scope') || '') === 'version') opt.hidden = true
      })
    }

    var value = getScopeValue()
    var selectedVer = getSelectedVersion()
    if (value === 'version' && !findOption('version', selectedVer)) {
      value = hasComp ? 'component' : 'all'
      selectedVer = ''
    } else if (value === 'component' && !hasComp) {
      value = 'all'
    } else if (!value) {
      value = hasComp ? 'component' : 'all'
    }

    setScopeSelection(value, selectedVer, { silent: true })
  }

  function setScopeSelection (scope, version, opts) {
    opts = opts || {}
    if (scopeValueInput) {
      scopeValueInput.value = scope || 'all'
      if (scope === 'version' && version) {
        scopeValueInput.setAttribute('data-version', version)
      } else {
        scopeValueInput.removeAttribute('data-version')
      }
    }

    var selected = findOption(scope, version)
    getScopeOptions().forEach(function (opt) {
      var on = opt === selected
      opt.classList.toggle('is-selected', on)
      if (on) {
        opt.setAttribute('aria-selected', 'true')
      } else {
        opt.removeAttribute('aria-selected')
      }
    })

    syncScopeFace()
    if (!opts.silent && typeof opts.onChange === 'function') opts.onChange()
  }

  function syncScopeFace () {
    var selected =
      findOption(getScopeValue(), getSelectedVersion()) ||
      findOption('all')
    var label = selected
      ? (selected.getAttribute('data-label') || '').trim()
      : 'All docs'
    if (scopeLabel) scopeLabel.textContent = label
    if (scopeTrigger) {
      scopeTrigger.setAttribute('aria-label', 'Search scope: ' + label)
    }
  }

  function isScopeMenuOpen () {
    return !!(scopeSlot && scopeSlot.classList.contains('is-open'))
  }

  function setScopeMenuOpen (open) {
    if (!scopeSlot || !scopeTrigger || !scopeMenu) return
    scopeSlot.classList.toggle('is-open', !!open)
    scopeTrigger.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) {
      scopeMenu.removeAttribute('hidden')
    } else {
      scopeMenu.setAttribute('hidden', '')
    }
  }

  function visibleScopeOptions () {
    return getScopeOptions().filter(function (opt) {
      return !opt.hidden
    })
  }

  function focusScopeOption (opt) {
    if (!opt) return
    opt.focus()
  }

  function syncPlaceholderCopy () {
    if (!searchInput) return
    // Native placeholder cannot style the slash. The overlay draws it; keep
    // the attribute empty so the two hints do not stack.
    searchInput.setAttribute('placeholder', '')
    searchInput.setAttribute('aria-label', QUERY_PLACEHOLDER)
    syncSearchPlaceholder()
  }

  function syncSearchPlaceholder () {
    if (!ph || !searchInput) return
    var hide = String(searchInput.value || '').length > 0
    ph.classList.toggle('is-hidden', hide)
  }

  if (cfg.askPlaceholder && input) {
    input.setAttribute('placeholder', cfg.askPlaceholder)
  }

  syncPlaceholderCopy()
  syncScopeLabels()

  if (scopeTrigger && scopeMenu) {
    scopeTrigger.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      setScopeMenuOpen(!isScopeMenuOpen())
    })

    scopeMenu.addEventListener('click', function (e) {
      var opt =
        e.target && e.target.closest && e.target.closest('[data-valentus-search-scope-option]')
      if (!opt || !scopeMenu.contains(opt)) return
      e.preventDefault()
      e.stopPropagation()
      if (opt.hidden) return
      setScopeSelection(
        opt.getAttribute('data-scope') || 'all',
        opt.getAttribute('data-version') || ''
      )
      setScopeMenuOpen(false)
      scopeTrigger.focus()
    })

    scopeTrigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setScopeMenuOpen(true)
        var first = visibleScopeOptions()[0]
        focusScopeOption(first)
      } else if (e.key === 'Escape' && isScopeMenuOpen()) {
        e.preventDefault()
        setScopeMenuOpen(false)
      }
    })

    scopeMenu.addEventListener('keydown', function (e) {
      var visible = visibleScopeOptions()
      var active = document.activeElement
      var idx = visible.indexOf(active)
      if (e.key === 'Escape') {
        e.preventDefault()
        setScopeMenuOpen(false)
        scopeTrigger.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusScopeOption(visible[Math.min(visible.length - 1, Math.max(0, idx) + 1)] || visible[0])
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusScopeOption(visible[Math.max(0, (idx < 0 ? visible.length : idx) - 1)] || visible[0])
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        focusScopeOption(visible[0])
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        focusScopeOption(visible[visible.length - 1])
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (active && active.getAttribute && active.hasAttribute('data-valentus-search-scope-option')) {
          e.preventDefault()
          active.click()
        }
      }
    })

    document.addEventListener('mousedown', function (e) {
      if (!isScopeMenuOpen()) return
      if (scopeSlot && scopeSlot.contains(e.target)) return
      // Dock placement portals the menu to the root (outside the slot).
      if (scopeMenu && scopeMenu.contains(e.target)) return
      setScopeMenuOpen(false)
    })
  }

  function submitAskForm () {
    if (!form) return
    if (typeof form.requestSubmit === 'function') form.requestSubmit()
    else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }

  if (input) {
    // Shift+Enter keeps the browser newline. Enter asks.
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      submitAskForm()
    })
  }

  if (searchInput) {
    searchInput.addEventListener('input', syncSearchPlaceholder)
    // Typing drives keyword search (Lunr on keystroke). Enter asks.
    // A single-line input has no newline, so Enter only asks.
    searchInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      submitAskForm()
    })
    syncSearchPlaceholder()
  }

  // Lunr mounts .search-result-dropdown-menu on the input wrap as soon as its
  // script runs, before a query. Hide that empty box, and when semantic search
  // is on, split hits into keyword (top) and semantic (bottom) zones.
  var organizingResults = false

  function makeZone (name, label) {
    var zone = document.createElement('div')
    zone.className = 'valentus-search-zone valentus-search-zone--' + name
    zone.setAttribute('data-valentus-search-zone', name)
    var title = document.createElement('div')
    title.className = 'valentus-search-zone__title'
    title.textContent = label
    zone.appendChild(title)
    if (name === 'semantic') {
      var empty = document.createElement('p')
      empty.className = 'valentus-search-zone__empty'
      empty.textContent = 'No semantic results.'
      zone.appendChild(empty)
    }
    return zone
  }

  function ensureZone (dd, name, label) {
    var zone = dd.querySelector('[data-valentus-search-zone="' + name + '"]')
    if (zone) return zone
    zone = makeZone(name, label)
    dd.appendChild(zone)
    return zone
  }

  function organizeSearchResults (dd) {
    if (organizingResults || !dd) return
    organizingResults = true
    try {
      var dataset = dd.querySelector('.search-result-dataset')
      if (!dataset) {
        dd.classList.add('is-idle')
        dd.classList.remove('valentus-search-results--split')
        return
      }
      dd.classList.remove('is-idle')
      if (!semanticEnabled) {
        dd.classList.remove('valentus-search-results--split')
        if (dataset.parentElement !== dd) dd.appendChild(dataset)
        Array.prototype.slice.call(dd.querySelectorAll('[data-valentus-search-zone]')).forEach(function (zone) {
          zone.remove()
        })
        return
      }
      dd.classList.add('valentus-search-results--split')
      var keyword = ensureZone(dd, 'keyword', 'Keyword')
      if (dataset.parentElement !== keyword) keyword.appendChild(dataset)
      var semantic = ensureZone(dd, 'semantic', 'Semantic')
      if (keyword.nextElementSibling !== semantic) {
        dd.appendChild(keyword)
        dd.appendChild(semantic)
      }
    } finally {
      organizingResults = false
    }
  }

  function watchResultsMenu (dd) {
    if (!dd) return
    if (dd.getAttribute('data-valentus-results-watch') === '1') {
      organizeSearchResults(dd)
      return
    }
    dd.setAttribute('data-valentus-results-watch', '1')
    organizeSearchResults(dd)
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () {
        organizeSearchResults(dd)
      }).observe(dd, { childList: true })
    }
  }

  function bindResultsMenu () {
    var dd = inputWrap && inputWrap.querySelector('.search-result-dropdown-menu')
    if (!dd) {
      var menus = root.querySelectorAll('.search-result-dropdown-menu')
      dd = menus.length ? menus[0] : null
    }
    if (!dd) return
    if (placement === 'dock' && dd.parentElement !== root) root.appendChild(dd)
    watchResultsMenu(dd)
  }

  bindResultsMenu()
  if (inputWrap && typeof MutationObserver === 'function') {
    new MutationObserver(bindResultsMenu).observe(inputWrap, { childList: true })
  }

  // Antora UI default site.js: nav-panel-menu mousedown with detail > 1 → preventDefault
  // (avoid selecting nav labels). Search/Ask live under that panel in this partial, so
  // stop multi-click mousedown from bubbling so dblclick can select field text.
  ;[root.querySelector('#search-field'), form].forEach(function (el) {
    if (!el) return
    el.addEventListener('mousedown', function (e) {
      if (e.detail > 1) e.stopPropagation()
    })
  })

  function isCollapsed () {
    return root.classList.contains('is-collapsed')
  }

  function isOpen () {
    return root.classList.contains('is-open')
  }

  function setOpen (open) {
    root.classList.toggle('is-open', !!open)
    if (!open) setScopeMenuOpen(false)
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      toggle.setAttribute('aria-label', open ? 'Close search' : 'Open search')
      toggle.hidden = !isCollapsed()
    }
    if (searchSlot) {
      searchSlot.classList.toggle('is-search-open', !!open)
    }
  }

  function setCollapsed (collapsed) {
    var wasCollapsed = isCollapsed()
    root.classList.toggle('is-collapsed', !!collapsed)
    if (searchSlot) {
      searchSlot.classList.toggle('is-collapsed', !!collapsed)
    }
    if (toggle) {
      toggle.hidden = !collapsed
    }
    if (!collapsed) {
      setOpen(false)
    } else if (!wasCollapsed) {
      // Entering collapsed mode: close popover until user opens it (or / focuses).
      setOpen(false)
    }
  }

  function openSearchUI () {
    if (isCollapsed()) setOpen(true)
  }

  function closeSearchUI () {
    if (isCollapsed()) setOpen(false)
  }

  function syncScopeInteractive (askMode) {
    if (scopeSlot) scopeSlot.classList.toggle('is-disabled', !!askMode)
    if (scopeTrigger) {
      scopeTrigger.disabled = !!askMode
      scopeTrigger.setAttribute('aria-disabled', askMode ? 'true' : 'false')
    }
    if (askMode) setScopeMenuOpen(false)
  }

  function focusQuery () {
    if (typeof window.adtRevealSiteChrome === 'function') {
      window.adtRevealSiteChrome()
    }
    openSearchUI()
    root.setAttribute('data-active-tab', 'search')
    if (inputWrap) inputWrap.hidden = false
    if (askWrap) askWrap.hidden = true
    if (searchInput) {
      searchInput.focus()
      if (typeof searchInput.select === 'function') searchInput.select()
    }
  }

  function activate () {
    focusQuery()
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(tab.getAttribute('data-valentus-search-tab'))
    })
  })

  if (cfg.defaultTab === 'ask') {
    activate('ask')
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (!isCollapsed()) return
      if (isOpen()) {
        setOpen(false)
      } else {
        activate('search')
      }
    })
  }

  document.addEventListener('mousedown', function (e) {
    if (!isCollapsed() || !isOpen()) return
    if (root.contains(e.target)) return
    setOpen(false)
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isScopeMenuOpen()) {
      e.preventDefault()
      setScopeMenuOpen(false)
      if (scopeTrigger) scopeTrigger.focus()
      return
    }
    if (e.key === 'Escape' && isCollapsed() && isOpen()) {
      e.preventDefault()
      setOpen(false)
      if (toggle) toggle.focus()
    }
  })

  function isTypingTarget (t) {
    return (
      t instanceof HTMLElement &&
      (t.isContentEditable ||
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT')
    )
  }

  // / focuses the query field. ? does the same now that mode buttons are gone.
  // Layout caveat: some keyboards report key === '?', others key === '/' + shiftKey.
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isTypingTarget(e.target)) return

    var isAsk = e.key === '?' || (e.key === '/' && e.shiftKey)
    var isSearch = e.key === '/' && !e.shiftKey

    if (isAsk || isSearch) {
      e.preventDefault()
      focusQuery()
    }
  })

  /**
   * Collapse when the expanded omnibox would collide with brand/title or end controls.
   * Measures leftover middle space (navbar − brand − actions − gaps). Hysteresis avoids flicker.
   */
  function measureAvailableSearchWidth () {
    var navbar = document.querySelector('.valentus-site-navbar')
    if (!navbar) return Infinity
    var brand = navbar.querySelector('.valentus-header-brand')
    var actions = navbar.querySelector('.valentus-header-actions') || navbar.querySelector('.valentus-topbar')
    var navW = navbar.clientWidth
    var brandW = brand ? Math.ceil(brand.getBoundingClientRect().width) : 0
    var actionsW = actions ? Math.ceil(actions.getBoundingClientRect().width) : 0
    var gaps = 48
    return navW - brandW - actionsW - gaps
  }

  function updateCollapseMode () {
    // Dock placement stays expanded in the page column; never icon-collapse.
    if (placement === 'dock') return
    var available = measureAvailableSearchWidth()
    var collapsed = isCollapsed()
    if (!collapsed && available < MIN_EXPANDED_SEARCH_PX) {
      setCollapsed(true)
    } else if (collapsed && available > MIN_EXPANDED_SEARCH_PX + COLLAPSE_HYSTERESIS_PX) {
      // Only expand when there is clear room; keep open popover closed.
      setCollapsed(false)
    }
  }

  var collapseRaf = 0
  function scheduleCollapseCheck () {
    if (collapseRaf) return
    collapseRaf = window.requestAnimationFrame(function () {
      collapseRaf = 0
      updateCollapseMode()
    })
  }

  updateCollapseMode()
  window.addEventListener('resize', scheduleCollapseCheck, { passive: true })
  if (typeof ResizeObserver === 'function') {
    var navbarEl = document.querySelector('.valentus-site-navbar')
    if (navbarEl) {
      var ro = new ResizeObserver(scheduleCollapseCheck)
      ro.observe(navbarEl)
      var brandEl = navbarEl.querySelector('.valentus-header-brand')
      var actionsEl = navbarEl.querySelector('.valentus-header-actions')
      if (brandEl) ro.observe(brandEl)
      if (actionsEl) ro.observe(actionsEl)
    }
  }

  function showResult (text, isError) {
    if (!result) return
    result.hidden = false
    result.textContent = text
    result.classList.toggle('is-error', !!isError)
  }

  function bindNavigationRefresh () {
    if (typeof bindSoftNavContext === 'function') {
      bindSoftNavContext({
        onContext: function (ctx) {
          applyChromePageContext(ctx)
        },
        onLoaded: function (detail) {
          refreshSearchContextFromDocument(detail && detail.doc)
        },
      })
      return
    }
    onSoftNavLoaded(function (detail) {
      refreshSearchContextFromDocument(detail && detail.doc)
    })
  }
  bindNavigationRefresh()

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      var fromSearch = searchInput && searchInput.value ? String(searchInput.value) : ''
      var fromAsk = input && input.value ? String(input.value) : ''
      var question = (fromSearch || fromAsk).trim()
      if (!question) {
        showResult('Enter a question to ask.', true)
        return
      }

      if (!askEnabled) {
        showResult(
          'Ask is not enabled on this site. Set ask_enabled: true and/or backend_url ' +
            '(or local_assist) on the antora-search-chat extension. Use Search for keyword results.',
          false
        )
        return
      }

      var backendUrl = cfg.backendUrl || ''
      if (!backendUrl) {
        showResult(
          'Ask is enabled but no backend is connected yet (phase 1 stub). ' +
            'Set backend_url on the antora-search-chat extension when a Q&A API is available. ' +
            'Keyword results still appear as you type.',
          false
        )
        return
      }

      showResult('Thinking…', false)
      syncScopeInteractive(true)
      fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ question: question }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Ask backend returned HTTP ' + res.status)
          return res.json()
        })
        .then(function (data) {
          var answer = (data && (data.answer || data.text)) || 'No answer in response.'
          showResult(answer, false)
        })
        .catch(function (err) {
          showResult(
            'Ask request failed: ' + (err && err.message ? err.message : String(err)),
            true
          )
        })
        .finally(function () {
          syncScopeInteractive(false)
        })
    })
  }
})()
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { placeSearchDock }
}
