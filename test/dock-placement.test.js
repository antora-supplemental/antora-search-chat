'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { placeSearchDock } = require('../ui/js/site-search-chat.js')

function createEl (tag, className) {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: className || '',
    children: [],
    parentElement: null,
    get classList () {
      const self = this
      return {
        add (name) {
          const parts = new Set(self.className.split(/\s+/).filter(Boolean))
          parts.add(name)
          self.className = Array.from(parts).join(' ')
        },
        contains (name) {
          return self.className.split(/\s+/).includes(name)
        },
      }
    },
    closest (sel) {
      let cur = this
      while (cur) {
        if (matches(cur, sel)) return cur
        cur = cur.parentElement
      }
      return null
    },
    appendChild (child) {
      detach(child)
      child.parentElement = this
      this.children.push(child)
      return child
    },
    insertBefore (child, ref) {
      detach(child)
      child.parentElement = this
      const i = this.children.indexOf(ref)
      if (i < 0) this.children.push(child)
      else this.children.splice(i, 0, child)
      return child
    },
    contains (other) {
      if (other === this) return true
      return this.children.some((child) => child.contains(other))
    },
    querySelector (sel) {
      for (const child of this.children) {
        if (matches(child, sel)) return child
        const found = child.querySelector(sel)
        if (found) return found
      }
      return null
    },
  }
  return el
}

function detach (child) {
  const parent = child.parentElement
  if (!parent) return
  const i = parent.children.indexOf(child)
  if (i >= 0) parent.children.splice(i, 1)
  child.parentElement = null
}

function matches (el, sel) {
  if (sel === 'footer') return el.tagName === 'FOOTER'
  if (sel === 'footer.footer') {
    return el.tagName === 'FOOTER' && el.className.split(/\s+/).includes('footer')
  }
  if (sel === 'main') return el.tagName === 'MAIN'
  if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1))
  return false
}

function docFrom (body) {
  return {
    body,
    querySelector (sel) {
      if (matches(body, sel)) return body
      return body.querySelector(sel)
    },
  }
}

function valentusPage () {
  const body = createEl('body', 'article')
  const header = createEl('header', 'header')
  const shell = createEl('div', 'valentus-shell')
  const adtBody = createEl('div', 'body valentus-body')
  const slot = createEl('div', 'valentus-navbar-search')
  const dock = createEl('div', 'search valentus-nav-search valentus-search-chat')
  const footer = createEl('footer', 'footer')
  body.appendChild(header)
  body.appendChild(shell)
  shell.appendChild(adtBody)
  adtBody.appendChild(slot)
  slot.appendChild(dock)
  body.appendChild(footer)
  return { body, shell, adtBody, slot, dock, footer }
}

test('dock mounts in the page column above the footer', () => {
  const { body, shell, adtBody, slot, dock, footer } = valentusPage()

  const column = placeSearchDock(docFrom(body), dock)

  assert.equal(column, shell)
  assert.equal(dock.parentElement, shell)
  assert.equal(shell.children[shell.children.length - 1], dock)
  assert.ok(shell.children.indexOf(dock) > shell.children.indexOf(adtBody))
  assert.ok(shell.className.split(/\s+/).includes('valentus-search-dock-column'))
  assert.ok(body.className.split(/\s+/).includes('valentus-search-dock-active'))
  assert.ok(slot.className.split(/\s+/).includes('valentus-search-slot-vacated'))
  assert.equal(dock.parentElement === body, false)
  assert.equal(footer.contains(dock), false)
  assert.equal(footer.parentElement, body)
})

test('dock is inserted before a footer that lives inside the column', () => {
  const body = createEl('body', 'article')
  const shell = createEl('div', 'valentus-shell')
  const slot = createEl('div', 'valentus-navbar-search')
  const dock = createEl('div', 'valentus-search-chat')
  const footer = createEl('footer', 'footer')
  body.appendChild(shell)
  shell.appendChild(slot)
  slot.appendChild(dock)
  shell.appendChild(footer)

  placeSearchDock(docFrom(body), dock)

  assert.equal(dock.parentElement, shell)
  assert.ok(shell.children.indexOf(dock) < shell.children.indexOf(footer))
  assert.equal(shell.className.split(/\s+/).includes('valentus-search-dock-column'), false)
})

test('dock CSS sticks inside the page column and is not a fixed overlay', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '../ui/css/site-search-chat.css'),
    'utf8'
  )
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(
    code,
    /\.valentus-search-dock-column\s*>\s*\.valentus-search-chat\[data-placement='dock'\]\s*\{[^}]*position:\s*sticky/
  )
  assert.doesNotMatch(code, /position:\s*fixed/)
})
