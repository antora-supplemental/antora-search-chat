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
  var scopeValueInput = root.querySelector('[data-adt-search-scope]')
  var scopeSlot = root.querySelector('[data-adt-search-scope-slot]')
  var scopeTrigger = root.querySelector('[data-adt-search-scope-trigger]')
  var scopeMenu = root.querySelector('[data-adt-search-scope-menu]')
  var scopeLabel = root.querySelector('[data-adt-search-scope-label]')
  var scopeOptions = Array.prototype.slice.call(
    root.querySelectorAll('[data-adt-search-scope-option]')
  )
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

  function getScopeValue () {
    return scopeValueInput ? scopeValueInput.value : 'all'
  }

  function getSelectedVersion () {
    return scopeValueInput ? (scopeValueInput.getAttribute('data-version') || '') : ''
  }

  function findOption (scope, version) {
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
    if (!scopeOptions.length) return
    var ctx = pageContext()
    var comp = componentLabel(ctx)
    var pageVer = (ctx.version || '').trim()
    var hasComp = false
    var hasVersionOpts = false

    scopeOptions.forEach(function (opt) {
      var scope = opt.getAttribute('data-scope') || ''
      var textEl = opt.querySelector('[data-adt-search-scope-option-text]') ||
        opt.querySelector('.adt-search-scope-option-text')
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
    scopeOptions.forEach(function (opt) {
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
    return scopeOptions.filter(function (opt) {
      return !opt.hidden
    })
  }

  function focusScopeOption (opt) {
    if (!opt) return
    opt.focus()
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

  if (scopeTrigger && scopeMenu) {
    scopeTrigger.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      setScopeMenuOpen(!isScopeMenuOpen())
    })

    scopeOptions.forEach(function (opt) {
      opt.setAttribute('tabindex', '-1')
      opt.addEventListener('click', function (e) {
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
        if (active && active.getAttribute && active.hasAttribute('data-adt-search-scope-option')) {
          e.preventDefault()
          active.click()
        }
      }
    })

    document.addEventListener('mousedown', function (e) {
      if (!isScopeMenuOpen()) return
      if (scopeSlot && scopeSlot.contains(e.target)) return
      setScopeMenuOpen(false)
    })
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
