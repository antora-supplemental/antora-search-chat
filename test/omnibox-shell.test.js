'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

function read (rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('query field placeholder is dynamic and mode buttons are gone', () => {
  const hbs = read('ui/partials/valentus-search-chat.hbs')
  const js = read('ui/js/site-search-chat.js')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(hbs, /data-valentus-search-ph-main/)
  assert.match(hbs, /Search by keyword\.\.\./)
  assert.match(hbs, /<code class="valentus-search-ph-code">\/<\/code>/)
  assert.match(hbs, /data-placement="dock"/)
  assert.match(js, /buildQueryPlaceholderText/)
  assert.match(js, /Search by keyword/)
  assert.match(css, /\.valentus-search-ph\s*\{[^}]*pointer-events:\s*none/)
  assert.match(css, /\.valentus-search-ph-code\s*\{[^}]*--valentus-font-mono/)
  assert.doesNotMatch(hbs, /data-valentus-search-tab/)
  assert.doesNotMatch(hbs, /data-valentus-search-capabilities/)
  assert.match(hbs, /data-valentus-search-scope-slot/)
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

test('results use one scrollport, feature hints, and hide when empty', () => {
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const js = read('ui/js/site-search-chat.js')
  assert.match(css, /\.valentus-search-chat \.search-result-dataset\s*\{[^}]*overflow:\s*visible\s*!important/)
  assert.match(css, /\.search-result-dropdown-menu:empty/)
  assert.match(css, /:not\(:has\(\.search-result-dataset\)\)/)
  assert.match(css, /\.valentus-search-feature-hints\s*\{/)
  assert.match(js, /syncFeatureHints/)
  assert.match(js, /Semantic search is not enabled/)
  assert.match(js, /Chat is not enabled/)
  assert.doesNotMatch(css, /position:\s*fixed/)
})
