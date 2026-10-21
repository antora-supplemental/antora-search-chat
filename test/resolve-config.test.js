'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildQueryPlaceholder, resolvePlacement } = require('../lib/index.js')

test('resolvePlacement defaults to dock', () => {
  assert.equal(resolvePlacement({}), 'dock')
  assert.equal(resolvePlacement({ placement: 'bottom' }), 'dock')
  assert.equal(resolvePlacement({ placement: 'floating' }), 'dock')
  assert.equal(resolvePlacement({ placement: 'navbar' }), 'navbar')
  assert.equal(resolvePlacement({ placement: 'header' }), 'navbar')
})

test('buildQueryPlaceholder reflects semantic and chat levels', () => {
  assert.equal(buildQueryPlaceholder(false, false), 'Search by keyword...')
  assert.equal(buildQueryPlaceholder(true, false), 'Search by keyword, or ask...')
  assert.equal(buildQueryPlaceholder(false, true), 'Search by meaning...')
  assert.equal(buildQueryPlaceholder(true, true), 'Search by meaning, or ask...')
})
