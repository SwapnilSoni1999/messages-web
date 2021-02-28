import { EventEmitter } from 'events'
import puppeteer from 'puppeteer'

type ClientEvents = 'browser-launched' | 'qr-code' | 'authenticated'

interface MyClassEvents {
    'authenticated': (service: MessageService) => void,
    'browser-launched': () => void,
    'qr-code': (base64Image: string) => void
}
declare interface MessagesClient {
    on<U extends keyof MyClassEvents>(
      event: U, listener: MyClassEvents[U]
    ): this;
  
    emit<U extends keyof MyClassEvents>(
      event: U, ...args: Parameters<MyClassEvents[U]>
    ): boolean;
  }

class MessagesClient extends EventEmitter implements MessagesClient {
    page!: puppeteer.Page
    browser!: puppeteer.Browser

    constructor (headless=true) {
        super()
        this.launch(headless)
    }

    private async launch (headless=true) {
        const browser = await puppeteer.launch({ headless: headless })
        const page = await browser.newPage()
        this.page = page
        await this.page.goto('https://messages.android.com', { waitUntil: 'load' })
        await this.page.waitForSelector('#mat-slide-toggle-1-input')
        await this.page.evaluate(() => {
            const checkbox = document.querySelector('#mat-slide-toggle-1-input') as HTMLInputElement
            checkbox.click() //remember me
        })
        this.emit('browser-launched')
        this.attachQrReader()
        this.page.on('request', request => {
            const url = request.url()
            if (url.includes('Pairing/GetWebEncryptionKey')) {
                const service = new MessageService(this.page)
                this.emit('authenticated', service) // todo: pass credentials as well
            }
        })
        return
    }

    private async attachQrReader () {
        await this.page.waitForSelector("body > mw-app > mw-bootstrap > div > main > mw-authentication-container > div > div.content-container > div > div.qr-code-container > div.qr-code-wrapper > mw-qr-code")
        await this.page.exposeFunction('onQrChange', async () => {
            const img = await this.page.$('body > mw-app > mw-bootstrap > div > main > mw-authentication-container > div > div.content-container > div > div.qr-code-container > div.qr-code-wrapper > mw-qr-code > img')
            if (img) {
                const src = await img.getProperty('src')
                if (src) {
                    this.emit('qr-code', await src.jsonValue()) // qrData = base64 qr image
                }
            }
        })

        await this.page.evaluate(() => {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.attributeName === 'data-qr-code') {
                        // @ts-ignore
                        window.onQrChange(mutation)
                    }
                }
            })
            const img = document.querySelector("body > mw-app > mw-bootstrap > div > main > mw-authentication-container > div > div.content-container > div > div.qr-code-container > div.qr-code-wrapper > mw-qr-code")
            if (img) {
                observer.observe(img, { attributes: true, childList: true, characterData: true })
            }
            return observer
        })

        await this.page.waitForSelector('body > mw-app > mw-bootstrap > div > main > mw-authentication-container > div > div.content-container > div > div.qr-code-container > div.qr-code-wrapper > mw-qr-code > img')
        const img = await this.page.$('body > mw-app > mw-bootstrap > div > main > mw-authentication-container > div > div.content-container > div > div.qr-code-container > div.qr-code-wrapper > mw-qr-code > img')
        if (img) {
            const src = await img.getProperty('src')
            if (src) {
                this.emit('qr-code', await src.jsonValue())
            }
        }
    }
    
    // WILL BE RELEASED SOON
    private async getCredentials () {
        const localStorageData = await this.page.evaluate(() => {
            let data = {}
            Object.assign(data, window.localStorage)
            return data
        })
        const cookiz = await this.page.cookies()
        return { cookies: cookiz, localStorage: localStorageData }
    }

    async quit() {
        await this.browser.close()
    }
}

type Conversation = {
    unread: boolean, 
    id: number,
    timestamp: string, 
    from: string, 
    latestMsgText: string
}
class MessageService {
    private page: puppeteer.Page
    constructor (page: puppeteer.Page) {
        this.page = page
    }

    async getInbox() {
        
        await this.page.waitForNavigation({ waitUntil: 'load' })
        await this.page.waitForSelector('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > mws-conversations-list > nav > div.conv-container.ng-star-inserted > mws-conversation-list-item')

        const inbox = await this.page.evaluate(() => {
            function evalConvoElement (conversation: Element) {
                const props:Conversation = {
                    unread: false, // querySelector find .unread class
                    id: 0, // href of a tag
                    timestamp: '', // mws-relative-timestamp .innerText || > ..ng-star-inserted').getAttribute('aria-label') if latest message
                    from: '', // querySelector('h3').innerText
                    latestMsgText: '' // querySelector('mws-conversation-snippet').innerText
                }
                props.unread = conversation.querySelector('.unread') ? true : false
                
                const regex = /conversations\/(\d{1,})/g
                const chatUrl = conversation.querySelector('a').href
                props.id = parseInt(chatUrl.match(regex)[0].split('conversations/')[1])
                
                if (conversation.querySelector('mws-relative-timestamp').childElementCount > 0) {
                    props.timestamp = conversation.querySelector('mws-relative-timestamp > .ng-star-inserted').getAttribute('aria-label')
                } else {
                    props.timestamp = (conversation.querySelector('mws-relative-timestamp') as HTMLElement).innerText
                }

                props.from = conversation.querySelector('h3').innerText
                props.latestMsgText = (conversation.querySelector('mws-conversation-snippet') as HTMLElement).innerText
                if (props.latestMsgText.startsWith('You:')) {
                    props.latestMsgText = props.latestMsgText.slice('You:'.length).trim()
                }
                return props
            }

            const conversations = document.querySelectorAll("body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > mws-conversations-list > nav > div.conv-container.ng-star-inserted > mws-conversation-list-item")
            const msgs = []
            for (const conversation of conversations) {
                if (conversation) {
                    msgs.push(evalConvoElement(conversation))
                }
            }
            return msgs
        })
        return inbox
    }
}

export default MessagesClient
