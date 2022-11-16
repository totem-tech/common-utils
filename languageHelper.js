import DataStorage from './DataStorage'
import storage from '../utils/storageHelper'
import {
    clearClutter,
    downloadFile,
    generateHash,
    getUrlParam,
    isNodeJS,
    textCapitalize,
} from './utils'

const translations = new DataStorage('totem_static_translations')
export const EN = 'EN'
const MODULE_KEY = 'language'
const rw = value => storage.settings.module(MODULE_KEY, value) || {}
let _selected = rw().selected || EN
export const BUILD_MODE = isNodeJS()
    ? process.env.BUILD_MODE
    : getUrlParam('build-mode', window.location.href)
        .toLowerCase() == 'true'
    && window.location.hostname !== 'totem.live'
export const languages = Object.freeze({
    BN: 'Bengali - বাংলা',
    DE: 'German - Deutsch',
    EN: 'English',
    ES: 'Spanish - Español',
    FR: 'French - Français',
    HI: 'Hindi - हिन्दी',
    ID: 'Indonesian - Bahasa Indonesia',
    IT: 'Italian - Italiano',
    JA: 'Japanese - 日本',
    KO: 'Korean - 한국인',
    NL: 'Dutch - Nederlandse Taal',
    PL: 'Polish - Polski',
    PT: 'Portuguese - Português',
    RU: 'Russian - Русский',
    TR: 'Turkish - Türkçe',
    UK: 'Ukrainian - українська',
    VI: 'Vietnamese - Tiếng Việt',
    ZH: 'Chinese - 中国人',
})

// downloadTextListCSV generates a CSV file with all the unique application texts
// that can be used to translate by opening the file in Google Drive
// NB: this function should not be used when BUILD_MODE is false (URL param 'build-mode' not 'true')
export const downloadTextListCSV = !BUILD_MODE ? null : () => {
    const seperator = ','
    const langCodes = [
        EN,
        ...Object
            .keys(languages)
            .filter(x => x != EN),
    ]
    const rest = langCodes.slice(1)
    const cols = 'abcdefghijklmnopqrstuvwxyz'
        .repeat(5)
        .toUpperCase()
        .split('')
    const maxRows = window.enList.length + 1
    // use batch functions so that translation request is only executed once.
    // only the first data cell in each column needs this function.
    // To avoid being rate limited, manuall set "=" when opening in Google Sheets
    const getRowTranslateFunction = colName =>
        `BYROW(A2:INDEX(A:A, ${maxRows}), LAMBDA(x, GOOGLETRANSLATE(x, A1, ${colName}1)))`
    //
    // `=BYROW(A2:INDEX(A:A, MAX((A:A<>"")*ROW(A:A))), LAMBDA(x, GOOGLETRANSLATE(x, A1, ${colName}1)))`

    const str = langCodes.join(seperator) + '\n' + (window.enList || []).map((x, i) => {
        // const rowNo = i + 2
        // const functions = rest.map((_, c) => `"=GOOGLETRANSLATE($A${rowNo}, $A$1, ${cols[c + 1]}$1)"`).join(',')
        const functions = i >= 1
            ? langCodes.map(_ => '') // empty cells
            : rest.map((_, j) =>
                `"${getRowTranslateFunction(cols[j + 1])}"`
            )
        return `"${clearClutter(x)}"${seperator}${functions.join(seperator)}`
    }).join(',\n')
    downloadFile(str, `English-texts-${new Date().toISOString()}.csv`, 'text/csv')
}

// retrieve latest translated texts from server and save to local storage
/**
 * @name    fetchNSaveTexts
 * @summary retrieve and cache English and translated texts based on selected language
 * 
 * @param   {Object}    client  Messaging server client
 * 
 * @returns {Boolean}   true: data freshly updated. Falsy: using cache or update not required
 */
export const fetchNSaveTexts = async (client) => {
    if (!client) return console.trace('Client not specified')
    const selected = getSelected()
    if (selected === EN) {
        setTexts(selected, null, null)
        return
    }

    const selectedHash = generateHash(getTexts(selected) || '')
    const engHash = generateHash(getTexts(EN) || '')
    const func = client.languageTranslations.promise
    const [textsEn, texts] = await Promise.all([
        func(EN, engHash),
        func(selected, selectedHash),
    ])

    // update not required => existing list of language is exactly the same as in the database
    if (!texts && !textsEn) return
    console.log('Language text list updated', { selected, texts, textsEn })
    // save only if update required
    setTexts(selected, texts, textsEn)
    // success
    return true
}

// get selected language code
export const getSelected = () => _selected

export const getTexts = langCode => translations.get(langCode)

/**
 * @name    setSelected
 * @summary set selected language code and retrieve translated texts (if required and `client` is supplied)
 * 
 * @param   {String}    selected 
 * @param   {Object}    client      Messaging server client
 *
 * @returns {Array}
 */
export const setSelected = async (selected, client) => {
    rw({ selected })
    _selected = selected
    // retrieve translated texts from server
    const listUpdated = await fetchNSaveTexts(client)
    return listUpdated
}

// save translated list of texts retrieved from server
export const setTexts = (langCode, texts, enTexts) => translations.setAll(
    new Map(
        // remove all language cache if selected is English
        langCode === EN
            ? []
            : [
                [EN, enTexts || translations.get(EN)],
                [langCode, texts || translations.get(langCode)],
            ].filter(Boolean)
    ),
    true,
)

export const translated = (texts = {}, capitalized = false) => {
    const langCode = getSelected()
    // translation not required
    if (langCode === EN && !BUILD_MODE) return [texts, capitalized && textCapitalize(texts)]

    const en = translations.get(EN) || []
    // list of selected language texts
    const selected = translations.get(langCode) || []
    // attempt to build a single list of english texts for translation
    if (BUILD_MODE) {
        window.enList = window.enList || []
        Object.values(texts).forEach(text => {
            if (!text) return
            text = clearClutter(text)
            enList.indexOf(text) === -1 && enList.push(text)
        })
        window.enList = enList.sort()
    }

    Object.keys(texts).forEach(key => {
        if (!texts[key]) return
        const text = clearClutter(texts[key])
        const enIndex = en.indexOf(text)
        const translatedText = selected[enIndex]
        // fall back to original/English,
        // if selected language is not supported 
        // or due to network error language data download failed
        // or somehow supplied text wasn't translated
        if (!translatedText) return
        texts[key] = translatedText
    })
    return [texts, capitalized && textCapitalize(texts)]
}

export default {
    translations,
    translated,
    setTexts,
    getSelected,
    setSelected,
}
