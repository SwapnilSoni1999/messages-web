import { Page } from "puppeteer"
import config from "./config"
import selectors from "./selectors"

class MessageService {
  private page!: Page

  constructor(page: Page) {
    this.page = page
  }

  async sendMessage(to: string, message: string) {
    await this.page.goto(config.urls.newMessage, { waitUntil: "load" })

    const contactInput = await this.page.waitForXPath(
      selectors.xpath.contactInput
    )

    if (!contactInput) {
      throw new Error("Contact input not found!")
    }

    await contactInput?.type(to, { delay: 100 })

    const contactSelectorBtn = await this.page.waitForXPath(
      selectors.xpath.contactSelectorBtn
    )

    if (!contactSelectorBtn) {
      throw new Error("Contact selector button not found!")
    }

    await (await contactSelectorBtn.toElement("button")).click({ delay: 100 })

    const typeTextarea = await this.page.waitForXPath(
      selectors.xpath.typeTextarea
    )

    if (!typeTextarea) {
      throw new Error("Type textarea not found!")
    }

    await typeTextarea.type(message, { delay: 100 })

    const sendMessageBtns = await this.page.$x(selectors.xpath.sendMessageBtn)

    // pick whichever is visible
    for await (const btn of sendMessageBtns) {
      //   const isVisible = await btn.isIntersectingViewport()
      //   if (isVisible) {
      //     await btn.click()
      //     break
      //   }
      const buttonElement = await btn.toElement("button")
      const isVisible = await buttonElement.isIntersectingViewport()
      if (isVisible) {
        await buttonElement.click({ delay: 100 })
        break
      }
    }

    // const sendMessageBtn = await this.page.waitForXPath(
    //   selectors.xpath.sendMessageBtn,
    //   {
    //     visible: true,
    //   }
    // )
    // await this.page.evaluate((btnXpath) => {
    //   const snapshots = document.evaluate(
    //     btnXpath,
    //     document,
    //     null,
    //     XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    //     null
    //   )

    //   const results: Element[] = []
    //   for (let i = 0; i < snapshots?.snapshotLength ?? 0; i++) {
    //     results.push(snapshots?.snapshotItem(i) as Element)
    //   }

    //   const btn = results[0] as HTMLButtonElement
    //   btn.click()
    // }, selectors.xpath.sendMessageBtn)

    // if (!sendMessageBtn) {
    //   throw new Error("Send message button not found!")
    // }

    // const point = await sendMessageBtn.clickablePoint()

    // console.log(point)
    // ;(sendMessageBtn as HTMLButtonElement).click()

    // await this.page.mouse.click(point.x, point.y, { delay: 100 })

    console.log("Message sent!")

    let statusMessage: string = ""
    const statusMessageWrapper = await this.page
      .waitForXPath(selectors.xpath.statusMessage)
      .catch((err) => {
        console.log(err)
        return null
      })
    if (statusMessageWrapper) {
      const _statusMessage = await statusMessageWrapper.getProperty("innerText")
      console.log(statusMessage)
      statusMessage = (await _statusMessage?.jsonValue()) as string
    }

    return {
      statusMessage,
    }
  }
}

export default MessageService
