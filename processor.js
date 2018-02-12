const entities = require('entities')

const ELEMENT_NODE = 1
const TEXT_NODE = 3

// node list to array
function arr (node) {
  const list = node.childNodes ? node.childNodes : node

  const res = []
  for (let i = 0; i < list.length; i++) {
    res.push(list[i])
  }
  return res
}

function replaceTld (node, tld) {
  for (const child of arr(node)) {
    if (child.tagName === 'tld') {
      const textNode = node.ownerDocument.createTextNode(tld)
      node.replaceChild(textNode, child)
    } else if (child.nodeType === ELEMENT_NODE) {
      replaceTld(child, tld)
    }
  }
}

function getText (node, recursive = false) {
  let res = ''
  for (const child of arr(node)) {
    if (child.nodeType === TEXT_NODE) {
      res += child.data
    } else if (recursive) {
      res += getText(child, recursive)
    }
  }
  return res === '' ? undefined : res
}

function getFirst (node, name) {
  if (node.getElementsByTagName) {
    return node.getElementsByTagName(name)[0]
  } else {
    console.log('Cant get child for ', node)
  }
}

function _getFirstRec (node, names) {
  if (names.length == 0) {
    return node
  } else {
    const name = names.pop()
    return _getFirstRec(getFirst(node, name), names)
  }
}

const getFirstRec = (node, names) => _getFirstRec(node, names.reverse())

const findRadical = (vortaro) => getText(getFirstRec(vortaro, [ 'art', 'kap', 'rad' ]))

const startPunct = /^\s*[:,]*\s*/g
const endPunct = /\s*[:,]*\s*$/g
const clean = (text) => entities.decodeHTML(text.split('\n').map(s => s.trim()).join(' ').replace(endPunct, '').replace(startPunct, ''))

const wordSep = /[ ,.!?;:"']/
const findWords = (text) => { console.log(text); return text.split(wordSep).filter(x => x.length) }

function processWords (vortaro, radical) {
  return arr(getFirst(vortaro, 'art').getElementsByTagName('drv')).map(drv => {
    const title = getFirst(drv, 'kap')
    replaceTld(title, radical)
    const word = clean(getText(title))
    console.log('Found: ' + word)

    const related = []
    let others = []

    const meanings = arr(drv.getElementsByTagName('snc')).map(meaning => {
      console.log('meaingin' + meaning)
      const difNode = getFirst(meaning, 'dif')
      replaceTld(difNode, radical)
      const definition = clean(getText(difNode))
      const examples = arr(difNode.getElementsByTagName('ekz')).map(ekz => clean(getText(ekz)))
      const usage = arr(meaning.getElementsByTagName('uzo')).map(uzo => getText(uzo)).join(', ')
      others = others.concat(findWords(definition)).concat(examples.reduce((sum, elt) => sum.concat(findWords(elt)), []))
      return {
        usage,
        definition,
        examples
      }
    })

    const translations = {}
    arr(drv.getElementsByTagName('trd')).forEach(trd => {
      translations[trd.getAttribute('lng')] = [ clean(getText(trd)) ]
    })
    arr(drv.getElementsByTagName('trdgrp')).forEach(trdgrp => {
      translations[trdgrp.getAttribute('lng')] = arr(trdgrp.getElementsByTagName('trd')).map(trd => {
        return clean(getText(trd))
      })
    })

    return {
      word,
      meanings,
      translations,
      related,
      others
    }
  })
}

function processVortaro(dom) {
  const vortaro = getFirstRec(dom, [ 'vortaro' ])

  const radical = findRadical(vortaro)
  console.log(`RAD: ${radical}`)
  const words = processWords(vortaro, radical)
  console.log(require('util').inspect(words, false, 5))
  const result = {
    others: words.reduce((sum, w) => sum.concat(w.others), []),
    words: words.map(w => {
      delete w.others
      return w
    })
  }
  return result
}

module.exports = processVortaro
