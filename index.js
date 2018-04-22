#!/usr/bin/env node

const { DOMParser } = require('xmldom')
const request = require('request-promise-native')
const fs = require('fs-extra')
const path = require('path')

const processVortaro = require('./processor')

const DEST_DIR = 'articles'

const REVO_URL = 'http://reta-vortaro.de/revo/xml/'

const RM_END_RE = /(a|e|i|o|u|is|as|os)j?n?$/

const revo = (file) => `${REVO_URL}${file}.xml`

async function writeResult (word) {
  await fs.writeFile(path.join(DEST_DIR, word.word + '.json'), JSON.stringify(word))
}

// returns other words found in this document
async function transformXml (data) {
  const dom = new DOMParser({
    errorHandler: (key, msg) => {
      if (!msg.includes('entity')) {
        console.error(`XML ERROR : ${msg}`)
      }
    }
  }).parseFromString(data, 'text/xml')
  const res = processVortaro(dom)
  for (const word of res.words) {
    await writeResult(word)
  }
}

async function download (page) {
  console.log(`Downloading ${page}.`)
  try {
    const res = await request({
      uri: revo(page),
      resolveWithFullResponse: true
    })

    if (res.statusCode == 200) {
      await transformXml(res.body)
    } else {
      console.error(`Received ${res.statusCode} status code while fetching ${page}`)
    }
  } catch (err) {
    // Try to remove the ending of the word
    const radical = page.replace(RM_END_RE, '')
    if (radical !== page) {
      download(radical)
    } else {
      console.error(`Error: unable to fetch ${page}`)
      console.error(err.message)
    }
  }
}

function main () {
  try {
    if (!process.argv[2]) {
      console.log('Please give a word to download')
      return
    }
    download(process.argv[2])
  } catch (err) {
    console.error(err.message)
  }
}

main()
