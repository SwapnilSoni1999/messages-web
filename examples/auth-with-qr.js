const { default: MessagesClient } = require('../lib/client')

const client = new MessagesClient()

client.on('qr-code', (base64Image) => {
    console.log('Saving QR to your local machine...')
    fs.writeFileSync('qr.jpg', base64Image.replace(/^data:image\/png;base64,/, ""), { encoding: 'base64' })
    console.log('QR code saved! Please open it and scan from your Google Messages App!')
})

client.on('authenticated', (service) => {
    client.saveCredentials('credentials.json')
    console.log('Credentials saved!')
    client.quit()
})
