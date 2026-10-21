'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

function read (rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('query field placeholder is Search or ask... / and mode buttons are gone', () => {
  const hbs = read('ui/partials/valentus-search-chat.hbs')
  const js = read('ui/js/site-search-chat.js')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(hbs, /valentus-search-ph-main">Search or ask\.\.\./)
  assert.match(hbs, /<code class="valentus-search-ph-code">\/<\/code>/)
  assert.match(hbs, /aria-label="Search or ask\.\.\. \/"/)
  assert.match(js, /Search or ask\.\.\. \//)
  assert.match(css, /\.valentus-search-ph\s*\{[^}]*pointer-events:\s*none/)
  assert.match(css, /\.valentus-search-ph-code\s*\{[^}]*--valentus-font-mono/)
  assert.doesNotMatch(hbs, /data-valentus-search-tab/)
  assert.match(hbs, /data-valentus-search-scope-slot/)
  assert.match(hbs, /data-valentus-search-capabilities/)
})

test('scope bar is one full-height hit target and the menu stays outside it', () => {
  const hbs = read('ui/partials/valentus-search-chat.hbs')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(hbs, /valentus-search-scope-clip/)
  const slotStart = hbs.indexOf('data-valentus-search-scope-slot')
  const menuStart = hbs.indexOf('<ul')
  const head = hbs.slice(slotStart, menuStart)
  assert.match(head, /valentus-search-scope-trigger/)
  assert.match(head, /<\/button>/)
  assert.match(css, /\.valentus-search-scope-trigger\s*\{[^}]*inset:\s*0/)
  assert.match(css, /\.valentus-search-scope-slot\s*\{[^}]*overflow:\s*visible/)
  assert.doesNotMatch(css, /\.valentus-search-scope-clip\s*\{/)
})

test('results use one scrollport, split when semantic, and hide when empty', () => {
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const js = read('ui/js/site-search-chat.js')
  assert.match(css, /\.valentus-search-chat \.search-result-dataset\s*\{[^}]*overflow:\s*visible\s*!important/)
  assert.match(css, /\.search-result-dropdown-menu:empty/)
  assert.match(css, /:not\(:has\(\.search-result-dataset\)\)/)
  assert.match(css, /\.valentus-search-results--split\s*\{[^}]*overflow:\s*hidden\s*!important/)
  assert.match(css, /\.valentus-search-zone\s*\{[^}]*overflow-y:\s*auto/)
  assert.match(js, /ensureZone\(dd, 'keyword', 'Keyword'\)/)
  assert.match(js, /ensureZone\(dd, 'semantic', 'Semantic'\)/)
  assert.match(js, /No semantic results\./)
  assert.doesNotMatch(css, /position:\s*fixed/)
})
