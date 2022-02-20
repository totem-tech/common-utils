import { BehaviorSubject } from 'rxjs'
import DataStorage from '../DataStorage'
import { isArr, isNodeJS, isObj, isStr, objClean, objHasKeys } from '../utils'
import getKeyringHelper, { KeyringHelper } from './keyringHelper'
import PolkadotExtensionHelper from './ExtensionHelper'

export const USAGE_TYPES = Object.freeze({
	PERSONAL: 'personal',
	BUSINESS: 'business',
})
export const REQUIRED_KEYS = Object.freeze([
	'address',
	'name',
])
// list of all properties used in idenities
export const VALID_KEYS = Object.freeze([
	...REQUIRED_KEYS,
	'cloudBackupStatus', // undefined: never backed up, in-progress, done
	'cloudBackupTS', // most recent successful backup timestamp
	'fileBackupTS', // most recent file backup timestamp
	'locationId',
	'selected',
	'source',
	'tags',
	'type',
	'uri',
	'usageType',
])

export class IdentityHelper {
	constructor(keyring, type = 'sr25519', storageKey = 'totem_identities') {
		this.extension = null
		this.storage = new DataStorage(storageKey)
		this.keyringHelper = !keyring
			? getKeyringHelper()
			: new KeyringHelper(type, keyring)
		this.keyring = this.keyringHelper.keyring
		this.rxIdentities = this.storage.rxData
		this.rxSelected = new BehaviorSubject()
		this.type = this.keyringHelper.type
		setTimeout(() => this.init(10))
	}

	/**
	 * @name	addFromUri
	 * 
	 * @param	{String} uri	mnemonic/seed
	 * @param	{String} type	address type. Default: 'sr25519'
	 * 
	 * @returns {Object} keypair. If undefined, try again with short delay.
	 */
	addFromUri = (uri, type = this.type) => {
		try {
			return this
				.keyring
				.addFromUri(uri, null, type)
				.toJson()
		} catch (err) {
			// error will occur if wasm-crypto is not initialised or invalid URI passed
			// console.log('services.identity.addFromUri()', err)
		}
	}

	/**
	 * @name	enableExtionsion
	 * @summary enables use of PolkadotJS Extension and automatically inject identities.
	 * @description requires node module: '@polkadot/extension-dapp'
	 */
	enableExtionsion = async (dAppName) => {
		if (isNodeJS()) return
		this.extension = new PolkadotExtensionHelper(dAppName)
		const result = await this.extension.enable()
		const removeInjected = ignoreAddresses => {
			const removed = []
			this.map(([address, { uri }]) => {
				// if injected identity was removed from PolkadotJS extension,
				// remove from identity storage as well
				const shouldRemove = uri === null
					&& !ignoreAddresses.includes(address)
				if (!shouldRemove) return
				this.remove(address)
				removed.push(address)
			})

			// if removed item was selected, set the first item as selected identity
			const { address: selected } = this.getSelected() || {}
			this.rxSelected.next(selected)
		}
		if (!result.length) {
			removeInjected([])
			return result
		}
		// extension is enabled
		this.extension.accounts(accounts => {
			const addresses = accounts.map(account => {
				const {
					address,
					meta: {
						name,
						source,
					},
					type,
				} = account
				const existingItem = this.get(address)
				if (!!existingItem && existingItem.uri !== null) return address

				// inject external identity without uri
				const entry = {
					address,
					name,
					source,
					type,
					uri: null,
				}
				this.set(address, entry)
				return address
			})
			removeInjected(addresses)
		})
		return result
	}

	/**
	 * @name find
	 * @summary find an identity by name or address
	 * 
	 * @param	{String} addressOrName 
	 * 
	 * @returns {Object}
	 */
	find = addressOrName => this.storage.find(
		{
			address: addressOrName,
			name: addressOrName,
		},
		true,
		false,
		true,
	)

	/**
	 * @name	generateUri
	 * @summary generate random mnemonic
	 * 
	 * @returns {String} If undefined, try again with short delay.
	 */
	generateUri = () => {
		try {
			return require('bip39').generateMnemonic()
		} catch (err) {
			// error will occur if wasm-crypto is not initialised or invalid URI passed
			console.warn('Failed to generate URI', err)
		}
	}

	/**
	 * @name	get
	 * @summary get identity by address
	 * 
	 * @param	{String} address 
	 * 
	 * @returns {Object}
	 */
	get = address => this.storage.get(address)

	/**
	 * @name	get
	 * @summary get all identities
	 * 
	 * @param	{String} address 
	 * 
	 * @returns {Object}
	 */
	getAll = () => this.storage.map(([_, x]) => ({ ...x }))

	/**
	 * @name    getSelected
	 * @summary get selected identity
	 *
	 * @returns {Object}
	 */
	getSelected = () => this.storage
		.find({ selected: true }, true, true)
		|| this.getAll()[0] // return first identity if none selected

	/**
	 * @name	init
	 * @summary create first identity if none created already
	 */
	init = (retries = 10) => {
		if (retries < 0) return
		if (!this.getAll().length) {
			// generate a new seed
			const seed = this.generateUri()
			if (!seed) {
				setTimeout(() => this.init(retries - 1), 1000)
				return
			}

			const uri = `${seed}/totem/0/0`
			const { address } = this.addFromUri(uri, this.type) || {}
			// in case `wasm-crypto` hasn't been initiated yet, try again after a second
			if (!address) {
				setTimeout(() => this.init(retries - 1), 1000)
				return
			}

			const identity = {
				address,
				name: 'Default',
				usageType: USAGE_TYPES.PERSONAL,
				uri,
			}
			this.set(address, identity)
		}

		const { address: selected } = this.getSelected() || {}
		this.rxSelected.next(selected)
	}

	map = (...args) => this.storage.map(...args)

	/**
	 * @name    remove
	 * @summary Permanent remove identity from storage
	 *
	 * @param   {String} address
	 */
	remove = address => { this.storage.delete(address) }

	/**
	 * @name	search
	 * @summary partial or fulltext search on storage data
	 *
	 * @param   {Object}  keyValues  Object with property names and the the value to match
	 * @param   {Boolean} matchExact (optional) fulltext or partial search. Default: false
	 * @param   {Boolean} matchAll   (optional) AND/OR operation for keys in @keyValues. Default: false
	 * @param   {Boolean} ignoreCase (optional) case-sensitivity of the search. Default: false.
	 * @param   {Number}  limit      (optional) limits number of results. Default: 0 (no limit)
	 *
	 * @returns {Map}     result
	 */
	search = (keyValues, matchExact, matchAll, ignoreCase, limit) => {
		return this.storage.search(
			keyValues,
			matchExact,
			matchAll,
			ignoreCase,
			limit,
		)
	}

	/**
	 * @name    set
	 * @summary add or update identity
	 *
	 * @param   {String} address
	 * @param   {Object} identity In case of update, will be merged with existing values.
	 *                            See `VALID_KEYS` for a list of accepted properties
	 * 
	 * @param	{String}  identity.address		SS58 decoded address
	 * @param	{String}  identity.name			name of the identity
	 * @param	{String}  identity.type			(optional) identity type
	 * 											Default: `'sr25519'`
	 * @param	{Object}  identity.uri			Full seed including mnemonic and derivation path.
	 * 											Use `null` if identity is imported from PolkadotJS extension.
	 * @param	{String}  identity.usageType	(optional) Accepted values: 'personal' or 'business'
	 * 											Default: `'personal'`
	 * @param	{String}  identity.locationId	(optional)
	 * @param	{Boolean} identity.selected		(optional)	
	 * 											Default: `false`
	 * @param	{Array}	  identity.tags			(optional) tags for categorisation. 
	 * 											Default: `[]`
	 *
	 * @returns {Object} returns the identity added/updated. If undefined, identity add/update failed.
	 */
	set = (address, identity) => {
		if (!isStr(address) || !isObj(identity)) return

		const existingItem = this.get(address)
		// check if identity object contains all the required properties
		const valid = !!existingItem || objHasKeys(
			identity,
			REQUIRED_KEYS.filter(key =>
				key !== 'uri' || identity.uri !== null
			),
			true,
		)
		if (!valid) return
		const { selected, type, usageType } = identity || {}
		const isUsageTypeValid = Object
			.values(USAGE_TYPES)
			.includes(usageType)
		identity.type = type || this.type
		identity.selected = !!selected
		identity.usageType = !isUsageTypeValid
			? USAGE_TYPES.PERSONAL
			: usageType
		//  merge with existing values and get rid of any unwanted properties
		identity = objClean({ ...existingItem, ...identity }, VALID_KEYS)
		// save to the storage
		this.storage.set(address, identity)

		return identity
	}

	/**
	 * @name    setSelected
	 * @summary set default/selected identity
	 *
	 * @param {String} address identity/wallet address
	 */
	setSelected = address => {
		const identity = this.get(address)
		// cannot set non-existent identity as selected
		if (!identity) return

		const arrSelected = this.search(
			{ selected: true },
			true,
			true,
		)
		// unselected previously selected
		Array
			.from(arrSelected)
			.forEach(([address, identity]) => {
				identity.selected = false
				this.storage.set(address, identity)
			})
		identity.selected = true
		this.set(address, identity)
		this.rxSelected.next(address)
	}

	/**
	 * @name    signature
	 * @summary create a new signature using an idenitity from local storage or PolkadotJS extension
	 * 
	 * @param   {String|Uint8Array} address 
	 * @param   {String|Uint8Array} message 
	 * 
	 * @returns {String} hex string
	 */
	signature = async (address, message) => {
		if (!isStr(message)) message = JSON.stringify(message)
		const identity = this.get(address)
		if (!identity) return null

		if (!!identity.uri) {
			// local identity
			const exists = this.keyringHelper.contains(address)
			if (!exists) this.keyringHelper.add([identity.uri])
			return this.keyringHelper.signature(address, message)
		}

		// injected identity
		if (this.extension) return await this.extension.signature(address, message)

		return null
	}

	signatureVerify = async (message, signature, address) => await this
		.keyringHelper
		.signatureVerify(
			message,
			signature,
			address,
		)

	sort = (...args) => this.storage.sort(...args)

	toArray = (...args) => this.storage.toArray(...args)

	toString = (...args) => this.storage.toString(...args)
}

// default/global identities
export default new IdentityHelper()