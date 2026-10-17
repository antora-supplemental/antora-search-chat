'use strict'

const fs = require('node:fs')
const path = require('node:path')

const PACKAGE_ID = '@antora-supplemental/antora-search-chat'
const UI_ROOT = path.join(__dirname, '..', 'ui')

function extensionConfigFromPlaybook (playbook) {
  for (const ext of playbook.antora?.extensions || []) {
    if (typeof ext !== 'object') continue
    const req = String(ext.require || '')
    if (
      req.includes('antora-search-chat') ||
      req.includes('packages/antora-search-chat')
    ) {
      const { require: _r, enabled: _e, id: _i, ...config } = ext
      return config
    }
    if (req.includes('facto-stack') && ext.searchChat && typeof ext.searchChat === 'object') {
      return { ...ext.searchChat }
    }
  }
  return {}
}

function playbookRequiresFactoStack (playbook) {
  return (playbook.antora?.extensions || []).some((ext) => {
    const req = typeof ext === 'string' ? ext : String(ext?.require || '')
    return req.includes('facto-stack')
  })
}

function walkFiles (dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, base))
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out
}

function addOrReplacePartial (uiCatalog, stem, relPath, contents) {
  const existing = uiCatalog.findByType('partial').find((f) => f.stem === stem)
  if (existing) {
    existing.contents = contents
    return
  }
  uiCatalog.addFile({
    contents,
    path: relPath,
    stem,
    type: 'partial',
  })
}

function addOrReplaceAsset (uiCatalog, uiOutputDir, relPath, contents) {
  const existing = uiCatalog.findByType('asset').find((f) => f.path === relPath)
  if (existing) {
    existing.contents = contents
    return
  }
  const dirname = path.posix.dirname(relPath)
  const basename = path.posix.basename(relPath)
  const outDir = dirname === '.' ? uiOutputDir : `${uiOutputDir}/${dirname}`
  uiCatalog.addFile({
    contents,
    type: 'asset',
    path: relPath,
    out: {
      dirname: outDir,
      path: `${outDir}/${basename}`,
      basename,
    },
  })
}

function appendStylesheetLink (uiCatalog, href) {
  const head = uiCatalog.findByType('partial').find((f) => f.stem === 'head-meta')
  if (!head) return
  const body = Buffer.isBuffer(head.contents)
    ? head.contents.toString('utf8')
    : String(head.contents || '')
  const tag = `<link rel="stylesheet" href="{{{uiRootPath}}}/${href}">`
  if (body.includes(href)) return
  head.contents = Buffer.from(`${body.trim()}\n${tag}\n`)
}

function appendFooterScript (uiCatalog, src) {
  const foot = uiCatalog.findByType('partial').find((f) => f.stem === 'footer-scripts')
  if (!foot) return
  const body = Buffer.isBuffer(foot.contents)
    ? foot.contents.toString('utf8')
    : String(foot.contents || '')
  const tag = `<script src="{{{uiRootPath}}}/${src}"></script>`
  // Match this src specifically — a shared marker made the 2nd append a no-op
  // (config.js injected, site-search-chat.js skipped → "/" shortcut dead).
  if (body.includes(src) || body.includes(tag)) return
  foot.contents = Buffer.from(`${body.trim()}\n${tag}\n`)
}

/**
 * Whether Ask / AI is configured & enabled for omnibox placeholder UX.
 * Explicit ask_enabled / askEnabled wins; otherwise true when backend_url or
 * local_assist is set. site.keys.askEnabled is a theme-side mirror (see docs).
 */
function resolveAskEnabled (config) {
  if (config.ask_enabled === false || config.askEnabled === false) return false
  if (config.ask_enabled === true || config.askEnabled === true) return true
  const backend = config.backend_url || config.backendUrl || ''
  const local = config.local_assist === true || config.localAssist === true
  return Boolean(backend) || local
}

/** Semantic level: explicit flag only — the hybrid engine is not bundled yet. */
function resolveSemanticEnabled (config) {
  if (config.semantic_enabled === false || config.semanticEnabled === false) return false
  if (config.semantic_enabled === true || config.semanticEnabled === true) return true
  return Boolean(config.semantic_backend_url || config.semanticBackendUrl || '')
}

/** Placement: `navbar` (top bar, default) or `dock` (floating bottom dock). */
function resolvePlacement (config) {
  const p = String(config.placement || '').toLowerCase()
  return p === 'dock' || p === 'floating' || p === 'bottom' ? 'dock' : 'navbar'
}

/**
 * Bake capability state into the partial so first paint has the right
 * placeholder copy: main label is "Semantic Search" when the semantic level
 * is enabled, else "Search" ("… or Ask" appended when chat is on); when chat
 * is off a muted "(Chat unavailable)" note follows.
 */
function applyAskEnabledToPartial (contents, askEnabled, semanticEnabled = false, placement = 'navbar') {
  let html = Buffer.isBuffer(contents) ? contents.toString('utf8') : String(contents || '')
  html = html.replace(
    /data-ask-enabled="(?:true|false)"/,
    `data-ask-enabled="${askEnabled ? 'true' : 'false'}"`
  )
  html = html.replace(
    /data-semantic-enabled="(?:true|false)"/,
    `data-semantic-enabled="${semanticEnabled ? 'true' : 'false'}"`
  )
  html = html.replace(/data-placement="(?:navbar|dock)"/, `data-placement="${placement}"`)
  const mainLabel = (semanticEnabled ? 'Semantic Search' : 'Search') + (askEnabled ? ' or Ask' : '')
  const phInner = askEnabled
    ? `<span class="adt-search-ph-main">${mainLabel}</span>`
    : `<span class="adt-search-ph-main">${mainLabel}</span><span class="adt-search-ph-note"> (Chat unavailable)</span>`
  if (askEnabled) {
    html = html.replace(/\s*data-ask-off\b/, '')
  } else {
    html = html.replace(
      /(<span class="adt-search-ph"[^>]*data-adt-search-ph)(?![^>]*data-ask-off)/,
      '$1 data-ask-off'
    )
  }
  html = html.replace(
    /(<span class="adt-search-ph"[^>]*data-adt-search-ph[^>]*>)[\s\S]*?(<\/span>\s*\n\s*<input)/,
    `$1\n          ${phInner}\n        $2`
  )
  html = html.replace(
    /(id="search-input"[\s\S]*?aria-label=")[^"]*(")/,
    `$1${mainLabel}${askEnabled ? '' : ' (Chat unavailable)'}$2`
  )
  return Buffer.from(html)
}

function injectRuntimeConfig (uiCatalog, uiOutputDir, config) {
  const askEnabled = resolveAskEnabled(config)
  const semanticEnabled = resolveSemanticEnabled(config)
  const payload = {
    backendUrl: config.backend_url || config.backendUrl || '',
    defaultTab: config.default_tab || config.defaultTab || 'search',
    askPlaceholder: config.ask_placeholder || config.askPlaceholder || 'Ask about this site…',
    askEnabled,
    semanticEnabled,
    placement: resolvePlacement(config),
    levels: { keyword: true, semantic: semanticEnabled, chat: askEnabled },
    localAssist: config.local_assist === true || config.localAssist === true,
  }
  const js = `window.__ADT_SEARCH_CHAT__ = ${JSON.stringify(payload)};\n`
  addOrReplaceAsset(
    uiCatalog,
    uiOutputDir,
    'js/site-search-chat-config.js',
    Buffer.from(js)
  )
}

/**
 * Antora extension: enhance lunr with a Search / Ask omnibox (product target).
 * Phase 1 stub may still use tabbed panels. Does not fork lunr index generation.
 */
module.exports.register = function register (context = {}) {
  const logger = this.getLogger(PACKAGE_ID)
  let config = { ...context }

  this.on('playbookBuilt', ({ playbook }) => {
    config = { ...extensionConfigFromPlaybook(playbook), ...context }
    if (config.enabled === false) {
      logger.info('disabled via enabled: false')
      return
    }
    // Lets header-content.hbs prefer {{> adt-search-chat}} over the plain lunr field.
    process.env.SITE_SEARCH_CHAT = 'true'
    const hasLunr = (playbook.antora?.extensions || []).some((ext) => {
      const req = typeof ext === 'string' ? ext : String(ext?.require || '')
      return req.includes('lunr-extension')
    })
    const lunrViaFacto = !hasLunr && playbookRequiresFactoStack(playbook)
    if (!hasLunr && !lunrViaFacto) {
      logger.warn(
        'No @antora/lunr-extension found in antora.extensions. ' +
          'Search tab expects lunr; register lunr before antora-search-chat.'
      )
    } else if (lunrViaFacto) {
      logger.info('composing with lunr via @antora-supplemental/facto-stack (wrap, not fork)')
    } else {
      logger.info('composing with @antora/lunr-extension (wrap, not fork)')
    }
    if (!config.backend_url && !config.backendUrl) {
      logger.info('Ask backend stubbed (set backend_url for phase 2)')
    }
    logger.info(
      `askEnabled=${resolveAskEnabled(config)} (ask_enabled / backend_url / local_assist)`
    )
  })

  this.on('uiLoaded', ({ playbook, uiCatalog }) => {
    const cfg = { ...extensionConfigFromPlaybook(playbook), ...config }
    if (cfg.enabled === false || cfg.ui === false) return

    const uiOutputDir = playbook.ui?.outputDir || '_'

    const askEnabled = resolveAskEnabled(cfg)
    const semanticEnabled = resolveSemanticEnabled(cfg)
    const placement = resolvePlacement(cfg)

    for (const rel of walkFiles(UI_ROOT)) {
      const full = path.join(UI_ROOT, rel)
      let contents = fs.readFileSync(full)
      if (rel.startsWith('partials/') && rel.endsWith('.hbs')) {
        const stem = path.basename(rel, '.hbs')
        if (stem === 'adt-search-chat') {
          contents = applyAskEnabledToPartial(contents, askEnabled, semanticEnabled, placement)
        }
        addOrReplacePartial(uiCatalog, stem, rel, contents)
      } else {
        addOrReplaceAsset(uiCatalog, uiOutputDir, rel, contents)
      }
    }

    injectRuntimeConfig(uiCatalog, uiOutputDir, cfg)
    appendStylesheetLink(uiCatalog, 'css/site-search-chat.css')
    appendFooterScript(uiCatalog, 'js/site-search-chat-config.js')
    appendFooterScript(uiCatalog, 'js/site-search-chat.js')

    logger.info('injected Search/Ask UI into catalog (owns .adt-nav-search slot)')
  })
}
