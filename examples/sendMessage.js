const { default: MessagesClient } = require('../lib/client')

const credentials = MessagesClient.loadCredentialFile('credentials.json')
const client = new MessagesClient({ credentials })

const TO = "+91987654321"
const MESSAGE = "Hi, this is test message from SmsClient."

client.on('authenticated', async (service) => {
    console.log('Sending message...')
    await service.sendMessage(TO, MESSAGE)
    console.log('Message sent!')
    client.quit()
})
