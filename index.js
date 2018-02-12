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

const knownWords = []

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
  return res
}

const MAX_JOBS = 4
let jobsRunning = 0
const queue = []

async function download (page) {
  console.log(`Downloading ${page}.`)
  try {
    const res = await request({
      uri: revo(page),
      resolveWithFullResponse: true
    })

    if (res.statusCode == 200) {
      const results = await transformXml(res.body)
      for (const word of results.others) {
        if (!knownWords.includes(word)) {
          download(word)
        }
      }
      for (const word of results.words) {
        knownWords.push(word)
      }
    } else {
      console.error(`Received ${res.statusCode} status code while fetching ${page}`)
    }
  } catch (err) {
    // Try to remove the ending of the word
    const radical = page.replace(RM_END_RE, '')
    if (radical !== page) {
      queue.push(radical)
    } else {
      console.error(`Error: unable to fetch ${page}`)
    }
  }
}

function processQueue () {
  if (jobsRunning < MAX_JOBS && queue.length > 0) {
    console.log('processing')
    jobsRunning++
    console.log('adding job (%d)', jobsRunning)
    download(queue.pop()).then(() => {
      jobsRunning--
      console.log('job ended (%d)', jobsRunning)
    })
  }
}

function main () {
  try {
    queue.push('traf')
    setInterval(processQueue, 1000)
  } catch (err) {
    console.error(err.message)
  }
}

main()
