import { ApiPromise, WsProvider } from '@polkadot/api'
import Keyring from '@polkadot/keyring/'
import createPair from '@polkadot/keyring/pair'

const TYPE = 'sr25519'
const keyring = new Keyring({ type: TYPE })
const config = {
    nodes: [],
    timeout: 30000,
    types: {},
    txFeeMin: 140,
}

// connect initiates a connection to the blockchain using PolkadotJS
//
// Params:
// @nodeUrl     string
// @types       object: custom type definitions
// @autoConnect boolean: whether to auto reconnect or create an once-off connection
//
// returns promise: 
//                  - will resolve to an object: { api, provider}
//                  - will reject to either a @err: string or object (if object use @message property for error message)
//                  - will reject if connection fails as well as times out
export const connect = (
    nodeUrl = config.nodes[0],
    types = config.types,
    autoConnect = true,
    timeout = config.timeout
) => new Promise((resolve, reject) => {
    const provider = new WsProvider(nodeUrl, autoConnect)
    if (!autoConnect) provider.connect()
    // auto reject if doesn't connect within specified duration
    const tId = setTimeout(() => !provider.isConnected() && reject('Connection timeout'), timeout)
    // reject if connection fails
    provider.websocket.addEventListener('error', () => reject('Connection failed') | clearTimeout(tId))
    // instantiate the Polkadot API using the provider and supplied types
    ApiPromise.create({ provider, types }).then(api => resolve({ api, provider }) | clearTimeout(tId), reject)
})

// remove
export const getDefaultConfig = () => config

// setDefaultConfig sets nodes and types for use with once-off connections as well as default values for @connect function
export const setDefaultConfig = (nodes, types, timeout) => {
    config.nodes = nodes || config.nodes
    config.types = types || config.types
    config.timeout = timeout || config.timeout
}

export const setKeyring = (seeds = []) => seeds.forEach(s => keyring.addFromUri(s))

// transfer funds between accounts
//
// Params:
// @toAddress   string: destination identity/address
// @secretKey   string: address (must have already been added to keyring) or secretKey or seed (type: 'sr25519')
// @publicKey   string: if falsy, @secretkey will be assumed to be a seed or an address 
// @api         object: PolkadkRingot API from `ApiPromise`
//
// Returns promise: will resolve to transaction hash
export const transfer = (toAddress, amount, secretKey, publicKey, api) => {
    if (!api) {
        // config.nodes wasn't set => return empty promise that rejects immediately
        if (config.nodes.length === 0) return new Promise((_, r) => r('Unable to connect: node URL not set'))
        return connect(config.nodes[0], config.types, false).then(({ api, provider }) => {
            console.log('Polkadot connected', { api, provider })
            return transfer(toAddress, amount, secretKey, publicKey, api)
                .finally(() => provider.disconnect() | console.log('Polkadot: disconnected'))
        })
    }

    let pair
    if (!!publicKey) {
        // public and private key supplied
        pair = createPair(TYPE, { secretKey, publicKey })
        keyring.addPair(pair)
    } else {
        try {
            // test if @secretKey is an address already added to the keyring
            pair = keyring.getPair(secretKey)
        } catch (_) {
            // assumes @secretKey is a seed/uri
            pair = keyring.addFromUri(secretKey)
        }
    }
    const sender = keyring.getPair(pair.address)
    return api.query.balances.freeBalance(sender.address).then(balance => {
        if (balance <= (amount + config.txFeeMin)) throw 'Insufficient balance'
        console.log('Polkadot: transfer from ', { address: sender.address, balance: balance.toString() })
        console.log('Polkadot: transfer to ', { address: toAddress, amount })
        const tx = api.tx.balances.transfer(toAddress, amount)
        return signAndSend(api, sender.address, tx, keyring)
    })
}

export const signAndSend = (api, address, tx) => new Promise((resolve, reject) => {
    try {
        const account = keyring.getPair(address)
        api.query.system.accountNonce(address).then(nonce => {
            nonce = parseInt(nonce)
            console.log('Polkadot: initiating transation', { nonce })
            tx.sign(account, { nonce }).send(({ status }) => {
                console.log('Polkadot: Transaction status', status.type)
                // status.type = 'Future' means transaction will be executed in the future. there is a nonce gap that need to be filled. 
                if (!status.isFinalized && status.type !== 'Future') return
                const hash = status.asFinalized.toHex()
                console.log('Polkadot: Completed at block hash', hash)
                resolve(hash)
            })
        })
    } catch (e) {
        reject(e)
    }
})