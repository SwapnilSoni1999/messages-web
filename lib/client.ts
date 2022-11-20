import { EventEmitter } from 'events'
import puppeteer from 'puppeteer'
import fs from 'fs'

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

type ClientOptions = {
    headless?: boolean,
    credentials?: Credentials
}

export type Credentials = {
    cookies: puppeteer.Protocol.Network.CookieParam[],
    localStorage: object
}
class MessagesClient extends EventEmitter implements MessagesClient {
    private page!: puppeteer.Page
    private browser!: puppeteer.Browser
    private isAuthenticated: boolean = false

    constructor (options: ClientOptions = { headless: true, credentials: { cookies: [], localStorage: {} } }) {
        super()
        this.launch(options)
    }

    static loadCredentialFile(path: string): Credentials {
        const credentials: Credentials = JSON.parse(fs.readFileSync(path).toString())
        return credentials
    }

    private async launch (options: ClientOptions) {
        const browser = await puppeteer.launch({ headless: options.headless })
        this.browser = browser
        const page = await browser.newPage()
        this.page = page
        await this.page.goto('https://messages.google.com/web/authentication', { waitUntil: 'load' })
        await this.page.waitForSelector('#mat-mdc-slide-toggle-1')
        await this.page.evaluate(() => {
            const checkbox = document.querySelector('#mat-mdc-slide-toggle-1-button') as HTMLInputElement
            checkbox.click() //remember me
        })
        this.emit('browser-launched')
        if (!Object.keys(options.credentials.localStorage).length) {
            this.attachQrReader()
            this.attachReqTracer()
            return
        } else {
            await this.setCredentials(options.credentials)
            const service = new MessageService(this.page)
            this.emit('authenticated', service)
            this.isAuthenticated = true
        }
        try {
            await this.page.waitForSelector('#mat-checkbox-1')
            const dontshowCheckbox = await this.page.$('#mat-checkbox-1')
            dontshowCheckbox.click()
            const dontShowBtn = await this.page.$('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav > div > mw-banner > div > mw-remember-this-computer-banner > div > div.button-align > button.action-button.confirm.mat-focus-indicator.mat-button.mat-button-base')
            dontShowBtn.click()
        } catch (err) {
            // maybe button doesn't exist
        }
    }

    private async attachReqTracer () {
        this.page.on('request', request => {
            const url = request.url()
            if (url.includes('Pairing/GetWebEncryptionKey')) {
                const service = new MessageService(this.page)
                if (!this.isAuthenticated) {
                    this.emit('authenticated', service)
                    this.isAuthenticated = true
                }
            }
        })
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
    async getCredentials (): Promise<Credentials> {
        await this.page.waitForFunction('!!localStorage.getItem("pr_backend_type")')
        const localStorageData = await this.page.evaluate(() => {
            let data = {}
            Object.assign(data, window.localStorage)
            return data
        })
        const cookiz = await this.page.cookies()
        const creds: Credentials = {
            cookies: cookiz,
            localStorage: localStorageData
        }
        return creds
    }

    private async setCredentials (credentials: Credentials) {
        await this.page.setCookie(...credentials.cookies)
        await this.page.evaluate((localStorageData) => {
            try {
                localStorageData = JSON.parse(localStorageData)
            } catch (err) {}
            for (const key of Object.keys(localStorageData)) {
                localStorage.setItem(key, localStorageData[key])
            }
        }, JSON.stringify(credentials.localStorage))
        await this.page.reload()
        return
    }

    async quit() {
        await this.browser.close()
    }
}

export default MessagesClient
