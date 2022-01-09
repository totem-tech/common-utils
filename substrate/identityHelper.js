import { BehaviorSubject } from 'rxjs'
import DataStorage from '../DataStorage'
import { isObj, isStr, objClean, objHasKeys } from '../utils'
import keyringHelper from './keyringHelper'

export const USAGE_TYPES = Object.freeze({
	PERSONAL: 'personal',
	BUSINESS: 'business',
})
export const REQUIRED_KEYS = Object.freeze([
	'address',
	'name',
	'type',
	'uri',
])
// list of all properties used in idenities
export const VALID_KEYS = Object.freeze([
	...REQUIRED_KEYS,
	'cloudBackupStatus', // undefined: never backed up, in-progress, done
	'cloudBackupTS', // most recent successful backup timestamp
	'fileBackupTS', // most recent file backup timestamp
	'locationId',
	'selected',
	'tags',
	'usageType',
])

export class IdentityHelper {
	constructor(keyring, type = 'sr25519', storageKey = 'totem_identities') {
		this.identities = new DataStorage(storageKey)
		this.keyring = keyring || keyringHelper.keyring
		this.rxIdentities = this.identities.rxData
		this.rxSelected = new BehaviorSubject()
		this.type = type || keyringHelper.type
		setTimeout(this.init)
	}

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
				console.log({ seed })
				setTimeout(() => this.init(retries - 1), 1000)
				return
			}

			const uri = `${seed}/totem/0/0`
			const { address } = this.addFromUri(uri, this.type) || {}
			// in case `wasm-crypto` hasn't been initiated yet, try again after a second
			if (!address) {
				console.log({ address })
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

		this.rxSelected.next(this.getSelected().address)
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
			// console.log('services.identity.addFromUri()', err)
			console.log(err)
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
	get = address => this.identities.get(address)

	/**
	 * @name	get
	 * @summary get all identities
	 * 
	 * @param	{String} address 
	 * 
	 * @returns {Object}
	 */
	getAll = () => this.identities.map(([_, x]) => ({ ...x }))

	/**
	 * @name    getSelected
	 * @summary get selected identity
	 *
	 * @returns {Object}
	 */
	getSelected = () => this.identities
		.find({ selected: true }, true, true)
		|| this.getAll()[0] // return first identity if none selected

	/**
	 * @name find
	 * @summary find an identity by name or address
	 * 
	 * @param	{String} addressOrName 
	 * 
	 * @returns {Object}
	 */
	find = addressOrName => this.identities.find(
		{
			address: addressOrName,
			name: addressOrName
		},
		true,
		false,
		true,
	)

	/**
	 * @name    remove
	 * @summary Permanent remove identity from storage
	 *
	 * @param   {String} address
	 */
	remove = address => {
		this.identities.delete(address)
	}

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
		return this.identities.search(
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
	 * @returns {Object} returns the identity added/updated. If undefined, identity add/update failed.
	 */
	set = (address, identity) => {
		if (!isStr(address) || !isObj(identity)) return

		const existingItem = this.get(address)
		if (!existingItem && objHasKeys(identity, REQUIRED_KEYS, true)) return

		const { selected, type, usageType } = identity
		const isUsageTypeValid = Object.values(USAGE_TYPES).includes(usageType)
		identity.type = type || 'sr25519'
		identity.selected = !!selected
		identity.usageType = !isUsageTypeValid
			? USAGE_TYPES.PERSONAL
			: usageType
		//  merge with existing values and get rid of any unwanted properties
		identity = objClean({ ...existingItem, ...identity }, VALID_KEYS)
		// save to the storage
		this.identities.set(address, identity)

		return identity
	}

	/**
	 * @name    setSelected
	 * @summary set selected identity
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
				this.identities.set(address, identity)
			})
		identity.selected = true
		this.set(address, identity)
		this.rxSelected.next(address)
	}
}

// default/global identities
export default new IdentityHelper()