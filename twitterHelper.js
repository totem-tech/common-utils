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
     * @param   {String} sourceHandle 
     * @param   {String} targetHandle 
     * 
     * @returns {Boolean}
     */
    async getFollower(sourceHandle, targetHandle) {
        await this.getClient()
        const params = {
            source_screen_name: sourceHandle,
            target_screen_name: targetHandle,
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

    async getAllFollowerIds(userHandle = '') {
        await this.getClient()
        const limit = 5000
        const params = {
            count: limit,
            screen_name: userHandle,
            stringify_ids: true,
        }
        const followers = []
        let result = {}
        try {
            do {
                result = await this.client
                    .get('followers/ids', params)

                params.cursor = result.next_cursor
                followers.push(...result.ids)
            } while (result.ids.length === limit)
        } catch (err) {
            throw new Error(!err.errors
                ? err
                : this.joinTwitterErrors(err)
            )
        }
        return followers
    }

    async getFollowersList(userHanlde, count = 200, cursor = -1, skipStatus = true, include_user_entities = false) {
        await this.getClient()
        const params = {
            count,
            cursor,
            include_user_entities,
            screen_name: userHanlde,
            skipStatus,
        }
        try {
            const result = await this.client
                .get('followers/list', params)
            return result || {}
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

    /**
     * @name    getUser
     * @summary get Twitter user data
     * 
     * @param   {String} handleOrId
     * 
     * @returns {Object}
     */
    async getUser(handleOrId) {
        await this.getClient()
        const params = { 'screen_name': handleOrId }
        try {
            const result = await this.client
                .get('users/show', params)
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