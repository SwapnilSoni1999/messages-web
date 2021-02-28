import { EventEmitter } from 'events'
import puppeteer from 'puppeteer'

import MessageService from './service'
interface ClientEvents {
    'authenticated': (service: MessageService) => void,
    'browser-launched': () => void,
    'qr-code': (base64Image: string) => void
}
declare interface MessagesClient {
    on<U extends keyof ClientEvents>(
      event: U, listener: ClientEvents[U]
    ): this,
  
    emit<U extends keyof ClientEvents>(
      event: U, ...args: Parameters<ClientEvents[U]>
    ): boolean
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

export default MessagesClient
