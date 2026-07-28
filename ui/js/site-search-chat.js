;(function () {
  'use strict'

  var cfg = window.__ADT_SEARCH_CHAT__ || {}
  var root = document.querySelector('[data-adt-search-chat]')
  if (!root) return

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-adt-search-tab]'))
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-adt-search-panel]'))
  var form = root.querySelector('[data-adt-search-ask-form]')
  var input = root.querySelector('[data-adt-ask-input]')
  var result = root.querySelector('[data-adt-ask-result]')
  var searchInput =
    root.querySelector('[data-adt-search-input]') || document.getElementById('search-input')
  var ph = root.querySelector('[data-adt-search-ph]')
  var scopeSelect = root.querySelector('[data-adt-search-scope]')
  var scopeKind = root.querySelector('[data-adt-search-scope-kind]')
  var scopeCurrent = root.querySelector('[data-adt-search-scope-current]')
  var toggle = root.querySelector('[data-adt-search-toggle]')
  var popover = root.querySelector('[data-adt-search-popover]')
  var searchSlot = root.closest('.adt-navbar-search') || root.parentElement
  var PH_ASK_ON = 'Search or Ask'
  var PH_ASK_OFF_LABEL = 'Search (AI mode not configured)'
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

  function pageContext () {
    return {
      componentTitle: (root.getAttribute('data-component-title') || '').trim(),
      componentName: (root.getAttribute('data-component-name') || '').trim(),
      versionDisplay: (root.getAttribute('data-version-display') || '').trim(),
      version: (root.getAttribute('data-version') || '').trim(),
    }
  }

  function componentLabel (ctx) {
    return ctx.componentTitle || ctx.componentName || ''
  }

  function versionLabel (ctx) {
    return ctx.versionDisplay || ctx.version || ''
  }

  function syncScopeLabels () {
    if (!scopeSelect) return
    var ctx = pageContext()
    var comp = componentLabel(ctx)
    var ver = versionLabel(ctx)
    var optComponent = scopeSelect.querySelector('option[value="component"]')
    var optVersion = scopeSelect.querySelector('option[value="version"]')
    var optAll = scopeSelect.querySelector('option[value="all"]')

    if (optComponent) {
      optComponent.textContent = comp
        ? 'This component — ' + comp
        : 'This component'
      optComponent.disabled = !comp
    }
    if (optVersion) {
      optVersion.textContent = ver
        ? 'This version — ' + ver
        : 'This version'
      optVersion.disabled = !ver
      // Hide version option when there is no page version context.
      optVersion.hidden = !ver
    }
    if (optAll) {
      optAll.textContent = 'All docs'
    }

    // Prefer component when available; otherwise All. Drop invalid selection.
    if (scopeSelect.value === 'version' && !ver) {
      scopeSelect.value = comp ? 'component' : 'all'
    } else if (scopeSelect.value === 'component' && !comp) {
      scopeSelect.value = 'all'
    } else if (!scopeSelect.value || (scopeSelect.selectedOptions[0] && scopeSelect.selectedOptions[0].disabled)) {
      scopeSelect.value = comp ? 'component' : 'all'
    }

    syncScopeFace()
  }

  function syncScopeFace () {
    if (!scopeKind) return
    var ctx = pageContext()
    var value = scopeSelect ? scopeSelect.value : 'component'
    var kind = 'All docs'
    var current = ''
    if (value === 'component') {
      kind = 'Component'
      current = componentLabel(ctx)
    } else if (value === 'version') {
      kind = 'Version'
      current = versionLabel(ctx)
    }
    scopeKind.textContent = kind
    if (scopeCurrent) {
      scopeCurrent.textContent = current
    }
    if (scopeSelect) {
      var aria =
        current ? kind + ' ' + current : kind
      scopeSelect.setAttribute('aria-label', 'Search scope: ' + aria)
    }
  }

  function syncPlaceholderCopy () {
    if (ph) {
      if (askEnabled) {
        ph.removeAttribute('data-ask-off')
        ph.innerHTML = '<span class="adt-search-ph-main">Search or Ask</span>'
      } else {
        ph.setAttribute('data-ask-off', '')
        ph.innerHTML =
          '<span class="adt-search-ph-main">Search</span>' +
          '<span class="adt-search-ph-note"> (AI mode not configured)</span>'
      }
    }
    if (searchInput) {
      searchInput.setAttribute('aria-label', askEnabled ? PH_ASK_ON : PH_ASK_OFF_LABEL)
    }
  }

  if (cfg.askPlaceholder && input) {
    input.setAttribute('placeholder', cfg.askPlaceholder)
  }

  // Fake placeholder: hide when focused or non-empty (native placeholder cannot
  // switch Ask-off vs Ask-on copy cleanly with partial styling).
  function syncSearchPlaceholder () {
    if (!ph || !searchInput) return
    // Keep native placeholder empty so it never fights the overlay.
    if (searchInput.getAttribute('placeholder')) {
      searchInput.setAttribute('placeholder', '')
    }
    var hide =
      document.activeElement === searchInput || String(searchInput.value || '').length > 0
    ph.classList.toggle('is-hidden', hide)
  }

  syncPlaceholderCopy()
  syncScopeLabels()

  if (scopeSelect) {
    scopeSelect.addEventListener('change', syncScopeFace)
  }

  if (searchInput) {
    searchInput.addEventListener('focus', syncSearchPlaceholder)
    searchInput.addEventListener('blur', syncSearchPlaceholder)
    searchInput.addEventListener('input', syncSearchPlaceholder)
    syncSearchPlaceholder()
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

  function activate (name) {
    openSearchUI()
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-adt-search-tab') === name
      tab.classList.toggle('is-active', on)
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-adt-search-panel') === name
      panel.classList.toggle('is-active', on)
      if (on) {
        panel.removeAttribute('hidden')
      } else {
        panel.setAttribute('hidden', '')
      }
    })
    if (name === 'ask' && input) {
      input.focus()
    } else if (name === 'search' && searchInput) {
      searchInput.focus()
      if (typeof searchInput.select === 'function') searchInput.select()
      syncSearchPlaceholder()
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(tab.getAttribute('data-adt-search-tab'))
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

  // / → Search (lexical); ? (Shift+/) → Ask
  // Layout caveat: some keyboards report key === '?', others key === '/' + shiftKey.
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isTypingTarget(e.target)) return

    var isAsk = e.key === '?' || (e.key === '/' && e.shiftKey)
    var isSearch = e.key === '/' && !e.shiftKey

    if (isAsk) {
      e.preventDefault()
      activate('ask')
      return
    }
    if (isSearch) {
      e.preventDefault()
      activate('search')
    }
  })

  /**
   * Collapse when the expanded omnibox would collide with brand/title or end controls.
   * Measures leftover middle space (navbar − brand − actions − gaps). Hysteresis avoids flicker.
   */
  function measureAvailableSearchWidth () {
    var navbar = document.querySelector('.adt-site-navbar')
    if (!navbar) return Infinity
    var brand = navbar.querySelector('.adt-header-brand')
    var actions = navbar.querySelector('.adt-header-actions') || navbar.querySelector('.adt-topbar')
    var navW = navbar.clientWidth
    var brandW = brand ? Math.ceil(brand.getBoundingClientRect().width) : 0
    var actionsW = actions ? Math.ceil(actions.getBoundingClientRect().width) : 0
    var gaps = 48
    return navW - brandW - actionsW - gaps
  }

  function updateCollapseMode () {
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
    var navbarEl = document.querySelector('.adt-site-navbar')
    if (navbarEl) {
      var ro = new ResizeObserver(scheduleCollapseCheck)
      ro.observe(navbarEl)
      var brandEl = navbarEl.querySelector('.adt-header-brand')
      var actionsEl = navbarEl.querySelector('.adt-header-actions')
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

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      var question = (input && input.value ? input.value : '').trim()
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
            'Use the Search tab for keyword results from the lunr index.',
          false
        )
        return
      }

      showResult('Thinking…', false)
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
    })
  }
})()
