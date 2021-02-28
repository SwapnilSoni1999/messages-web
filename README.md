# Messages Cli Client

- How to use

1. Clone this repo

```sh
git clone https://github.com/SwapnilSoni1999/messages-web.git
```

2. Use it

- Without credentials

```js
const MessagesClient = require('./messages-web')
const fs = require('fs')

const client = new MessagesClient()

client.on('qr-code', (base64Image) => {
    // example code to save image
    fs.writeFileSync('qr.jpg', base64Image.replace(/^data:image\/png;base64,/, ""), { encoding: 'base64' })
    // your code
})

client.on('authenticated', async (service) => {
    const inbox = service.getInbox()
    const credentials = await client.getCredentials()
    fs.writeFileSync('credentials.json', JSON.stringify(credentials, null, '\t'))
    await client.quit()
})
```
Then you can use `credentials.json` file to login 

- With credentials

```js
const MessagesClient = require('./messages-web')

const credentials = MessagesClient.loadCredentialFile('credentials.json')
const client = new MessagesClient({ credentials })

client.on('authenticated', async (service) => {
    const inbox = await service.getInbox()
    console.log('Inbox', inbox)
    await client.quit()
})
```
