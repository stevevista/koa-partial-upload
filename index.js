/**
 * koa-partial-upload - index.js
 * Copyright(c) 2018
 * MIT Licensed
 *
 * @author  R.J.
 * @api private
 */
'use strict'
const compose = require('koa-compose')
const path = require('path')
const fs = require('fs')
const uuid = require('uuid/v1')
const forms = require('formidable')

function stat (path) {
  return new Promise((resolve) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        resolve(null)
      } else {
        resolve(stats)
      }
    })
  })
}

function rename (oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, async err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}



function unlink (path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function koaBody(opts = {}) {
  return async function (ctx, next) {
    if (["GET", "HEAD", "DELETE"].indexOf(ctx.method.toUpperCase()) === -1) {
      if (ctx.is('multipart')) {
        const body = await formy(ctx, opts)
        ctx.request.body = body.fields
        ctx.request.files = body.files
      }
    }

    await next()
  }
}

function formy(ctx, opts) {
  return new Promise(function (resolve, reject) {
    var fields = {};
    var files = {};
    var form = new forms.IncomingForm(opts);
    form.on('end', function () {
      return resolve({
        fields: fields,
        files: files
      });
    }).on('error', function (err) {
      return reject(err);
    }).on('field', function (field, value) {
      if (fields[field]) {
        if (Array.isArray(fields[field])) {
          fields[field].push(value);
        } else {
          fields[field] = [fields[field], value];
        }
      } else {
        fields[field] = value;
      }
    }).on('file', function (field, file) {
      if (files[field]) {
        if (Array.isArray(files[field])) {
          files[field].push(file);
        } else {
          files[field] = [files[field], file];
        }
      } else {
        files[field] = file;
      }
    });
    if (opts.onFileBegin) {
      form.on('fileBegin', opts.onFileBegin);
    }
    form.parse(ctx.req);
  });
}


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
  if (ctx.request.body.trunks && ctx.request.files) {
    const trunks = +ctx.request.body.trunks
    const fileField = Object.keys(ctx.request.files)[0]
    const file = ctx.request.files[fileField]
    const filename = file.name
    const hashname =  ctx.request.body.hash || filename
    const store_dir = path.dirname(file.path)

    if (!ctx.request.body.eot) {
      // don't move to dest yet
      const newpath = path.join(store_dir, `${hashname}.${trunks}`)
      await rename(file.path, newpath)
      file.path = newpath
      file.partial = true
    } else {
      const trunkFiles = []

      for (let i = 1; i < trunks; i++) {
        trunkFiles.push(path.join(store_dir, `${hashname}.${i}`))
      }
      trunkFiles.push(file.path)
      const newpath = path.join(store_dir, uuid()) + path.extname(file.path)
      await merge(trunkFiles, newpath)
      const stats = await stat(newpath)
      file.path = newpath
      if (stats) {
        file.size = stats.size
      }

      for (const f of trunkFiles) {
        await unlink(f)
      }
    }
  }

  await next()
}

function PartialUpload(opt = {}) {
  return compose([
    koaBody(opt),
    handlePartial
  ])
}

module.exports = PartialUpload
