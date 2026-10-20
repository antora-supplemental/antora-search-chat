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
  const hbs = read('ui/partials/adt-search-chat.hbs')
  const js = read('ui/js/site-search-chat.js')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(hbs, /adt-search-ph-main">Search or ask\.\.\./)
  assert.match(hbs, /<code class="adt-search-ph-code">\/<\/code>/)
  assert.match(hbs, /aria-label="Search or ask\.\.\. \/"/)
  assert.match(js, /Search or ask\.\.\. \//)
  assert.match(css, /\.adt-search-ph\s*\{[^}]*pointer-events:\s*none/)
  assert.match(css, /\.adt-search-ph-code\s*\{[^}]*--adt-font-mono/)
  assert.doesNotMatch(hbs, /data-adt-search-tab/)
  assert.match(hbs, /data-adt-search-scope-slot/)
  assert.match(hbs, /data-adt-search-capabilities/)
})

test('scope bar is one full-height hit target and the menu stays outside it', () => {
  const hbs = read('ui/partials/adt-search-chat.hbs')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(hbs, /adt-search-scope-clip/)
  const slotStart = hbs.indexOf('data-adt-search-scope-slot')
  const menuStart = hbs.indexOf('<ul')
  const head = hbs.slice(slotStart, menuStart)
  assert.match(head, /adt-search-scope-trigger/)
  assert.match(head, /<\/button>/)
  assert.match(css, /\.adt-search-scope-trigger\s*\{[^}]*inset:\s*0/)
  assert.match(css, /\.adt-search-scope-slot\s*\{[^}]*overflow:\s*visible/)
  assert.doesNotMatch(css, /\.adt-search-scope-clip\s*\{/)
})

test('results use one scrollport, split when semantic, and hide when empty', () => {
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const js = read('ui/js/site-search-chat.js')
  assert.match(css, /\.adt-search-chat \.search-result-dataset\s*\{[^}]*overflow:\s*visible\s*!important/)
  assert.match(css, /\.search-result-dropdown-menu:empty/)
  assert.match(css, /:not\(:has\(\.search-result-dataset\)\)/)
  assert.match(css, /\.adt-search-results--split\s*\{[^}]*overflow:\s*hidden\s*!important/)
  assert.match(css, /\.adt-search-zone\s*\{[^}]*overflow-y:\s*auto/)
  assert.match(js, /ensureZone\(dd, 'keyword', 'Keyword'\)/)
  assert.match(js, /ensureZone\(dd, 'semantic', 'Semantic'\)/)
  assert.match(js, /No semantic results\./)
  assert.doesNotMatch(css, /position:\s*fixed/)
})
