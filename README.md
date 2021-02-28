# Messages Cli Client

- How to use

1. Clone this repo

```sh
git clone https://github.com/SwapnilSoni1999/messages-web.git
```

2. Use it
```js
const MessagesClient = require('./messages-web')

const client = new MessagesClient()

client.on('qr-code', (base64Image) => {
    // example code to save image
    fs.writeFileSync('qr.jpg', base64Image.replace(/^data:image\/png;base64,/, ""), { encoding: 'base64' })
    // your code
})
```