import PromisE from './PromisE'
import { isObjArr } from './utils'
// import { Client, Message } from 'discord.js'
// import { BehaviorSubject } from 'rxjs'


// const token = process.env.Discord_Bot_Token
// // Create an instance of a Discord client
// const client = new Client()

// // WIP
// class DiscordBot {
//     constructor(token) {
//         this.client = new Client()
//         this.token = token
//         this.rxIsReady = new BehaviorSubject(false)
//     }

//     login() {
//         return new Promise(async (resolve, reject) => {
//             const loginResult = await this.client.login(this.token)
//             console.log({ loginResult })
//             const onResult = this.client.on('ready', (x) => {
//                 console.log('Bot ready', x)
//                 this.rxIsReady.next(true)
//             })
//             console.log({ onResult })
//         })
//     }

//     async sendMessage() {
//         await this.login()
//         new Message(this.client, {}, '')
//     }
// }
// export default new DiscordBot(token)

/**
 * @name    sendMessage
 * @summary send message to Discord channel using webhook
 * 
 * @param {String|{
 *  color: String,
 *  description: String,
 *  timestamp: String,
 *  title: String,
 *  url: String,
 * }[]}       content   content or embeds
 * @param {*} tag 
 * @param {*} username 
 * @param {*} webhookUrl 
 * @param {*} avatar_url 
 * @param {*} timeout 
 * @param {*} contentRedacted 
 * @param {*} split 
 * @param {*} limit 
 * 
 * @returns 
 */
export const sendMessage = async (
    content = '',
    tag,
    split = false, // whether to split content greater that limit (default: 2000 characters) into multiple messages
    limit = 2000,
    username = process.env.DISCORD_WEBHOOK_USERNAME || 'Logger',
    webhookUrl = process.env.DISCORD_WEBHOOK_URL,
    avatar_url = process.env.DISCORD_WEBHOOK_AVATAR_URL,
    timeout = 60000,
) => {
    const embeds = isObjArr(content) && content.length > 0
        ? content
        : undefined
    content = embeds
        ? ''
        : `${content || ''}`
    if (!content && embeds.length === 0) throw new Error('Empty content')
    const contentRedacted = sendMessage.redactRegex
        ? content.replace(sendMessage.redactRegex, '')
        : content
    if (contentRedacted.length > limit) {
        if (split) {
            const embedMarkup = '>>> '
            const isEmbed = contentRedacted.startsWith(embedMarkup)
            limit = isEmbed
                ? limit - 4
                : limit
            const numMessages = Math.ceil(contentRedacted.length / limit)
            for (let i = 0;i < numMessages;i++) {
                const startIndex = i * limit
                const part = contentRedacted.slice(startIndex, startIndex + limit)
                await sendMessage(
                    (isEmbed ? embedMarkup : '') + part,
                    tag,
                    username,
                    webhookUrl,
                    avatar_url,
                    timeout,
                )
            }
            return
        }
        contentRedacted = contentRedacted.slice(0, limit)
    }
    return await PromisE
        .post(
            webhookUrl + '?wait=true',
            {
                avatar_url,
                ...!!contentRedacted && { content: contentRedacted },
                ...!!embeds && { embeds },
                username
            },
            {},
            timeout,
            false,// `true` will throw error
        )
        .catch(err =>
            console.error(
                tag,
                '[DiscordWebhook]: failed to send message.',
                { content: contentRedacted, embeds, tag },
                err
            )
            // ToDo: save as JSON and re-attempt later??
        )
}
sendMessage.redactRegex = null
