const { default: MessagesClient } = require('../lib/client')

const credentials = MessagesClient.loadCredentialFile('credentials.json')
const client = new MessagesClient({ credentials })

client.on('authenticated', (service) => {
    console.log('Authenticated!')
    client.quit()
})
