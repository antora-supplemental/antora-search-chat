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
  assert.match(hbs, /placeholder="Search or ask\.\.\. \/"/)
  assert.match(js, /Search or ask\.\.\. \//)
  assert.doesNotMatch(hbs, /data-adt-search-tab/)
  assert.match(hbs, /data-adt-search-scope-slot/)
  assert.match(hbs, /data-adt-search-capabilities/)
})

test('closed scope control is clipped without trapping the open menu', () => {
  const hbs = read('ui/partials/adt-search-chat.hbs')
  const css = read('ui/css/site-search-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const clipStart = hbs.indexOf('<div class="adt-search-scope-clip">')
  const clip = hbs.slice(clipStart, hbs.indexOf('</div>', clipStart))
  assert.match(clip, /adt-search-scope-trigger/)
  assert.doesNotMatch(clip, /<ul/)
  assert.match(css, /\.adt-search-scope-clip\s*\{[^}]*overflow:\s*hidden/)
  assert.match(css, /\.adt-search-scope-slot\s*\{[^}]*overflow:\s*visible/)
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
