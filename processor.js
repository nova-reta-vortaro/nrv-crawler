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
      if (child.tagName === 'ref') {
        if (child.getAttribute('cel') !== null) {
          const txt = getText(child, recursive)
          res += `![${txt}](/vorto/${txt.toLowerCase()})`
        }
      } else {
        res += getText(child, recursive)
      }
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

function findRec (node, tag) {
  let res = []
  if (node.nodeType === ELEMENT_NODE) {
    for (const child of arr(node)) {
      if (child.tagName === tag) {
        res.push(child)
      }
      res = res.concat(findRec(child, tag))
    }
  }
  return res
}

const getFirstRec = (node, names) => _getFirstRec(node, names.reverse())

const findRadical = (vortaro) => getText(getFirstRec(vortaro, [ 'art', 'kap', 'rad' ]))

const startPunct = /^\s*[:,]*\s*/g
const endPunct = /\s*[:,]*\s*$/g
const clean = (text) => entities.decodeHTML(text.split('\n').map(s => s.trim()).join(' ').replace(endPunct, '').replace(startPunct, ''))

const wordSep = /[ ,.!?;:"']/
const findWords = (text) => text.split(wordSep).filter(x => x.length)

function processWords (vortaro, radical) {
  return arr(getFirst(vortaro, 'art').getElementsByTagName('drv')).map(drv => {
    const title = getFirst(drv, 'kap')
    replaceTld(title, radical)
    const word = clean(getText(title))
    console.log('Found: ' + word)

    let others = []

    const meanings = arr(drv.getElementsByTagName('snc')).map(meaning => {
      const difNode = getFirst(meaning, 'dif')
      replaceTld(difNode, radical)
      const definition = clean(getText(difNode, true))
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

    const related = []
    arr(drv.getElementsByTagName('ref')).forEach(ref => {
      if (ref.getAttribute('tip') === 'vid') {
        related.push(clean(getText(ref)))
      }
    })
    arr(drv.getElementsByTagName('refgrp')).forEach(refgrp => {
      if (refgrp.getAttribute('tip') === 'vid') {
        arr(refgrp.getElementsByTagName('ref')).forEach(ref => {
          related.push(clean(getText(ref)))
        })
      }
    })

    const bibliography = findRec(drv, 'bib')
      .map(bib => clean(getText(bib)))
      .reduce((sum, elt) => sum.includes(elt) ? sum : sum.concat([ elt ]), [])

    return {
      word,
      meanings,
      translations,
      related,
      others,
      bibliography
    }
  })
}

function processVortaro(dom) {
  const vortaro = getFirstRec(dom, [ 'vortaro' ])

  const radical = findRadical(vortaro)
  const words = processWords(vortaro, radical)
  const result = {
    others: words.reduce((sum, w) => sum.concat(w.others), []),
    words: words.map(w => {
      delete w.others
      // adding other words that were found to the related ones
      w.related = words.filter(x => w !== x).map(x => x.word).concat(w.related)
      return w
    })
  }
  return result
}

module.exports = processVortaro
