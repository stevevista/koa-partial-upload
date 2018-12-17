'use strict'
const compose = require('koa-compose')
const koaBody = require('koa-body')
const path = require('path')
const fs = require('fs')
const uuid = require('uuid/v1')

async function merge (sources, dest) {
  return new Promise(async (resolve, reject) => {
    const ws = fs.createWriteStream(dest, { encoding: null })
    ws.on('error', reject)
    ws.on('close', resolve)

    for (const f of sources) {
      const is = fs.createReadStream(f, { encoding: null })
      is.on('error', reject)
      is.pipe(ws, {end: false})
      await new Promise((resolve) => {
        is.on('end', resolve)
      })
    }
    ws.close()
  })
}

async function handlePartial (ctx, next) {
  if (ctx.request.body.trunks) {
    const trunks = +ctx.request.body.trunks
    const fileField = Object.keys(ctx.request.files)[0]
    const file = ctx.request.files[fileField]
    const filename = file.name
    const hashname =  ctx.request.body.hash || filename
    const store_dir = path.dirname(file.path)

    if (!ctx.request.body.eot) {
      // don't move to dest yet
      const newpath = path.join(store_dir, `${hashname}.${trunks}`)
      await fs.promises.rename(file.path, newpath)
      file.path = newpath
      file.partial = true
    } else {
      const trunkFiles = []

      for (let i = 1; i < trunks; i++) {
        trunkFiles.push(path.join(store_dir, `${hashname}.${i}`))
      }
      trunkFiles.push(file.path)
      const newpath = path.join(store_dir, uuid())
      await merge(trunkFiles, newpath)
      const stats = await fs.promises.stat(newpath)
      file.path = newpath
      file.size = stats.size

      for (const f of trunkFiles) {
        await fs.promises.unlink(f)
      }
    }
  }

  await next()
}

function PartialUpload(opt = {}) {
  const koaUpload = koaBody({
    multipart: true,
    formidable: opt
  })

  return async function upload(ctx, next) {
    if (!ctx.is('multipart')) {
      // already parsed by urlencoded or json
      await next()
      return
    }

    await compose([
      koaUpload,
      handlePartial
    ])(ctx, next)
  }
}

module.exports = PartialUpload
