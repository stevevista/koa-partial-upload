# Notices
require Node version > 10.0.0
# Code
## Server
```
const PartialUpload = require('koa-partial-upload')
const Router = require('koa-router')

const router = Router()

router.post('/upload', PartialUpload({
  uploadDir: './tmp',
  maxFileSize: 200 * 1024 * 1024
}), async ctx => {
  if (!ctx.request.files) {
    // not multipart upload
  } else if (ctx.request.files.file.partial) {
    // a partial file segment
    // console.log(ctx.request.body.trunks)
    // console.log(ctx.request.body.eot)
  } else {
    // a single uplaod or merged upload
    // file.size is the merged size
  }
})


```

## Client
```
curl -F "file=@card.txt" -F "imei=222222222" -F "hash=my_key" -F "trunks=1" http://localhost:3001/log/upload
curl -F "file=@card.txt" -F "imei=222222222" -F "hash=my_key" -F "trunks=2" -F "eot=1" http://localhost:3001/log/upload
```

if ``hash`` is not presented, then ``original filename`` will be used as identity

