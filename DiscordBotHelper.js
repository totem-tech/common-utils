import { Client, Message } from 'discord.js'
import { BehaviorSubject } from 'rxjs'

const token = process.env.Discord_Bot_Token
// Create an instance of a Discord client
const client = new Client()

// WIP
class DiscordBot {
    constructor(token) {
        this.client = new Client()
        this.token = token
        this.rxIsReady = new BehaviorSubject(false)
    }

    login() {
        return new Promise(async (resolve, reject) => {
            const loginResult = await this.client.login(this.token)
            console.log({ loginResult })
            const onResult = this.client.on('ready', (x) => {
                console.log('Bot ready', x)
                this.rxIsReady.next(true)
            })
            console.log({ onResult })
        })
    }

    async sendMessage() {
        await this.login()
        new Message(this.client, {}, '')
    }
}
export default new DiscordBot(token)
