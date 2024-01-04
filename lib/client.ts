import { EventEmitter } from "events"
import { Browser, Page } from "puppeteer"
import puppeteer from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import TypedEmitter, { EventMap } from "typed-emitter"
import config from "./config"
import selectors from "./selectors"
import MessageService from "./service"
import { Protocol } from "puppeteer"

interface ClientEvents extends EventMap {
  // authenticated: (service: MessageService) => void
  authenticated: (service: MessageService) => void
  credentials: (credentials: Credentials) => void
  "browser-launched": () => void
  "qr-code": (base64Image: string) => void
}

type ClientOptions = {
  headless?: boolean | "new"
  credentials?: Credentials
}

type Credentials = {
  cookies: Protocol.Network.CookieParam[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}

declare global {
  interface Window {
    onQrCodeChange: (base64Image: string) => void
  }
}

class MessagesClient extends (EventEmitter as unknown as new () => TypedEmitter<ClientEvents>) {
  private page!: Page
  private browser!: Browser
  private isAuthenticated: boolean = false

  constructor(options: ClientOptions = { headless: "new" }) {
    super()
    this.launch(options)
  }

  private async launch(options: ClientOptions) {
    const browser = await puppeteer.use(StealthPlugin()).launch({
      headless: options.headless,
      // devtools: true,
      args: [
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920x1080",
        "--start-maximized",
      ],
    })
    this.browser = browser
    this.page = await browser.newPage()

    if (options.credentials) {
      await this.restoreSession(options.credentials)
      return
    }

    await this.page.goto(config.urls.auth, { waitUntil: "load" })
    await this.checkRememberMe()
    await this.attachQrCodeListener()
    await this.attachAuthListener()
  }

  private async restoreSession(credentials: Credentials) {
    await this.page.goto(config.urls.auth, { waitUntil: "load" })
    await this.checkRememberMe()
    await this.page.setCookie(...credentials.cookies)
    await this.page.evaluate(
      (
        localStorageValues: Credentials["localStorage"],
        sessionStorageValues: Credentials["sessionStorage"]
      ) => {
        Object.keys(localStorageValues).forEach((key) => {
          window.localStorage.setItem(key, localStorageValues[key])
        })
        Object.keys(sessionStorageValues).forEach((key) => {
          window.sessionStorage.setItem(key, sessionStorageValues[key])
        })
      },
      credentials.localStorage,
      credentials.sessionStorage
    )

    await this.page.goto(config.urls.conversations, {
      waitUntil: "domcontentloaded",
    })
    await this.page.waitForXPath(selectors.xpath.conversationList, {
      visible: true,
    })
    this.isAuthenticated = true
    console.log("Restored session!")

    const service = new MessageService(this.page)
    this.emit("authenticated", service)
  }

  private async attachAuthListener() {
    this.page.on("framenavigated", async (frame) => {
      const url = frame.url()
      if (url.includes("/conversations")) {
        console.log("Authenticated!")
        this.isAuthenticated = true

        const credentials: Credentials = {
          cookies: await this.page.cookies(),
          localStorage: await this.page.evaluate(() => {
            const json = JSON.stringify(window.localStorage)
            return JSON.parse(json)
          }),
          sessionStorage: await this.page.evaluate(() => {
            const json = JSON.stringify(window.sessionStorage)
            return JSON.parse(json)
          }),
        }

        this.emit("credentials", credentials)

        const service = new MessageService(this.page)
        this.emit("authenticated", service)
        this.page.removeAllListeners("framenavigated")
      }
    })
  }

  private async checkRememberMe() {
    const rememberMeSlider = await this.page.waitForXPath(
      selectors.xpath.rememberMeSlider,
      {
        visible: true,
      }
    )

    if (!rememberMeSlider) {
      throw new Error("Could not find remember me slider")
    }

    const sliderBtn = await this.page.waitForXPath(
      selectors.xpath.rmemberMeSliderButton
    )

    const className =
      ((await (
        await sliderBtn?.getProperty("className")
      )?.jsonValue()) as string) ?? ""

    const isChecked = className.includes("checked")

    if (!isChecked && sliderBtn) {
      await (await sliderBtn.toElement("button")).click()
      console.log("Checked remember me!")
    }
  }

  private async attachQrCodeListener() {
    await this.page.exposeFunction("onQrCodeChange", (base64Image: string) => {
      console.log("QR Code changed!")
      console.log({ base64Image })
      this.emit("qr-code", base64Image)
    })

    await this.page.waitForXPath(selectors.xpath.qrCode, { visible: true })

    await this.page.evaluate((qrCodeXpath) => {
      function getElementByXPath(xpath: string) {
        const snapshots = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        )

        const results: Element[] = []

        for (let i = 0; i < snapshots.snapshotLength; i++) {
          results.push(snapshots.snapshotItem(i) as Element)
        }

        return results
      }

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          console.log({ mutation })

          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLImageElement) {
              console.log("QR Code changed!")
              node.onload = () => {
                console.log({ src: node.src })
                console.log({ src: node.getAttribute("src") })
                window.onQrCodeChange(node.src)
              }
            }
          })

          //   if (mutation.attributeName === "data-qr-code") {
          //     // const base64Image = mutation.target
          //     // window.onQrCodeChange(base64Image)
          //     console.log("QR Code changed!")
          //     const qrElement = mutation.target as Element
          //     const img = qrElement.querySelector("img")
          //     console.log(img)
          //     if (img) {
          //       const base64Image = img.getAttribute("src")
          //       window.onQrCodeChange(base64Image ?? "")
          //     }
          //   }
        }
      })

      const qrCode = getElementByXPath(qrCodeXpath)[0]
      console.log({ qrCode })
      if (qrCode) {
        observer.observe(qrCode, {
          attributes: true,
          childList: true,
          characterData: true,
        })
      }

      return observer
    }, selectors.xpath.qrCode)
  }
}

export default MessagesClient
