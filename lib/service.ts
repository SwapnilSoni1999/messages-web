import puppeteer from 'puppeteer'

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

export default MessageService
