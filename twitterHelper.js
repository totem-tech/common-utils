class TwitterHelper {
    constructor() {
        this.config = {
            version: '1.1', // version '1.1' is the default (change for v2)
            extension: true, // true is the default (this must be set to false for v2 endpoints)
            // for app authentication
            bearer_token: process.env.Twitter_Bearer_Token,
            // for user authentication: not implemented
            // consumer_key: process.env.REACT_APP_Twitter_Consumer_Key,
            // consumer_secret: process.env.REACT_APP_Twitter_Consumer_Secret,
            // access_token_key: process.env.REACT_APP_Twitter_Access_Token_Key,
            // access_token_secret: process.env.REACT_APP_Twitter_Access_Token_Secret,
        }
    }

    async getClient() {
        if (this.client) return this.client

        const Twitter = require('twitter-lite')
        const appClient = new Twitter(this.config)
        const isApp = !!this.config.bearer_token

        if (isApp) {
            this.client = appClient
            return this.client
        }

        // user authentication
        throw new Error('Not implemented')
    }

    /**
     * @name    checkFollower
     * @summary get Twitter follower information
     * 
     * @param   {String} sourceHanle 
     * @param   {String} targetHandle 
     * 
     * @returns {Boolean}
     */
    async getFollower(sourceHanle, targetHandle) {
        await this.getClient()
        const params = {
            'source_screen_name': sourceHanle,
            'target_screen_name': targetHandle,
        }
        try {
            const { relationship = {} } = await this.client
                .get('friendships/show', params)
            return relationship.target || {}
        } catch (err) {
            throw new Error(!err.errors
                ? err
                : this.joinTwitterErrors(err)
            )
        }

    }

    /**
     * @name    getTweetById
     * @summary retrieve a tweet with full text by tweet ID
     * 
     * @param   {String} id 
     * 
     * @returns {Object}
     */
    async getTweetById(id) {
        // authenticate
        await this.getClient()

        const params = { id, tweet_mode: 'extended' }
        try {
            const result = await this.client
                .get('statuses/show', params)
            return result
        } catch (err) {
            throw new Error(!err.errors
                ? err
                : this.joinTwitterErrors(err)
            )
        }

    }

    joinTwitterErrors(err) {
        return err.message || (err.errors || [])
            .map(e => e.message)
            .filter(Boolean)
            .join(' ')
    }
}

export default new TwitterHelper()