import { BehaviorSubject } from 'rxjs'
import PromisE from '../PromisE'
import { arrUnique, deferred, downloadFile, isArr } from '../utils'

export const rxPrint = new BehaviorSubject(null)

/**
 * 
 * @param {*} selector 
 * @param {*} windowTitle 
 * @param {*} title 
 * @param {*} stylesStr 
 * @param {*} hideColumns 
 * @param {*} width 
 * @param {*} height 
 * 
 * 
 * @description special classes
 * .no-print: content to be hidden from printing but may be included when saving as csv
 * .: 
 * @returns 
 */
export default async function printElement(
    selector = 'table',
    windowTitle = document.title,
    title,
    stylesStr = '',
    hideColumns = [], // table column numbers to exclude from printing
    width = window.innerWidth,
    height = window.innerHeight,
) {
    const printWindow = window.open('', 'PRINT', `height=${height},width=${width}`)
    title ??= document.title
    const header = document.createElement('head')
    header.innerHTML = document.head.innerHTML
    const elsToRemove = [
        ...header.querySelectorAll('script'),
        ...header.querySelectorAll('title'),
    ]
    elsToRemove.forEach(x => x.remove())
    const documentHtml = getDocumentHtml(
        [...document.body.classList].join(' '),
        `${header.innerHTML}
        <style>
            ${hideColumns.map(colNum => `
                tr td:nth-child(${colNum}),
                tr th:nth-child(${colNum}) {
                    display: none !important;
                }
            `)}

            ${style}

            /* curstom styles */
            ${stylesStr || ''}
        </style>`
    )
    // load the empty print window and show a loading spinner
    printWindow.document.write(documentHtml)

    await PromisE.delay(10)
    rxPrint.next(selector)
    await PromisE.delay(1000)
    rxPrint.next(null)

    const contentFromApp = typeof selector === 'string'
        && document?.querySelector(selector)?.outerHTML
        || selector?.outerHTML
        || 'No content available'
    // inject content to be printed into the window replacing the loading spinner
    const titleEl = title && `<h1>${title}</h1>` || ''
    printWindow
        .document
        .querySelector('.content-editable')
        .innerHTML = `
        ${titleEl}
        
        <!-- // content from page for printing -->
        ${contentFromApp}`

    setupPrintWindow(printWindow, windowTitle)
    printWindow.document.close() // necessary for IE >= 10
    printWindow.focus() // necessary for IE >= 10*/
    // printWindow.print()
    // printWindow.close()
    return printWindow
}

window.printElement = printElement

const style = `
    /* remove buttons, search input etc above table */
    .data-table > .topcontent { 
        display: none !important
    }

    body {
        border: none;
        padding: 50px;
        overflow-y: auto;
    }

    /* Inverted styles */
    body.inverted .ui.table td.positive,
    body.inverted .ui.table tr.positive {
        background: inherit !important;
        color: inherit !important;
    }

    /* hide the content removed by user */
    body *[hidden] {
        display: none !important;
    }

    body.editable .content-editable,
    body.editable .content-editable * {
        cursor: text !important;
    }

    /* Bottom bar styles */
    .print-bottom-bar > div {
        background: #333333;
        bottom: 0;
        color: white;
        font-size: 75%;
        left: 0;
        padding: 5px 10px;
        position: fixed;
        text-align: center;
        width: 100%;
    }
    .print-bottom-bar .left { 
        float: left;
        text-align: left;
    }
    body.editable .print-bottom-bar .remove-instructions,
    body:not(.editable) .print-bottom-bar .edit-instructions {
        display: none
    }
    .print-bottom-bar .right { 
        float: right;
        padding: 3px 0 3px;
    }
    .print-bottom-bar .right .button { 
        display: inline-block;
        height: 36px;
        margin-left: 3px;
    }
    .checkbox.editable label span {
        color: white !important;
    }

    @media not print {
        /* highlight table row to indicate "click to hide" */
        body:not(.editable):not(.shift) :not(thead) > tr:hover *,
        body:not(.editable):not(.shift) .highlight-remove,
        body:not(.editable):not(.shift) .highlight-remove *,
        body:not(.editable):not(.shift) .highlight-remove .ui.input input {
            background-color: red !important;
            color: white !important;
        }
        body:not(.editable) .content-editable * {
            cursor: not-allowed !important;
        }
    }
    @media print {
        .print-bottom-bar {
            display: none !important;
        }
        body {
            padding: 0 !important;
        }
        body .content-editable {
            padding: 0 !important;
        }
    }

    body .no-print { display: none !important; }
`
const setupPrintWindow = (window, windowTitle = '') => {
    const { document } = window || {}
    if (!window || !document) return console.warn('Print window setup failed! Print "window" not provided.')

    // set window title
    const title = document.createElement('title')
    title.textContent = 'Print dialog: ' + windowTitle
    window
        .document
        .head
        .appendChild(title)

    window.isShift = false
    window.isEditable = false
    window.classHightlightRemove = 'highlight-remove'
    window.handlers = new Map()
    window.undoList = []
    window.pressedKeys = new Set()

    window.replaceEventListener = (
        event,
        callback,
        el = window,
        parentEl = document,
    ) => {
        // use querySelector
        if (typeof el === 'string') el = parentEl.querySelector(el)

        el.removeEventListener(event, window.handlers.get(el))
        window.handlers.set(el, callback, true)
        el.addEventListener(event, callback)
    }

    // hide on click
    window.handleUndoListChanged = () => {
        const undoable = window.undoList.length > 0
        const { classList } = document.body
        classList[undoable ? 'add' : 'remove']('undoable')
        const undo = document.querySelector('.print-bottom-bar .undo')
        undo.classList[!undoable ? 'add' : 'remove']('disabled')

        const count = document.querySelector('.print-bottom-bar .undo .count')
        count.innerHTML = window.undoList.length
            ? '(' + window.undoList.length + ')'
            : ''
    }
    window.replaceEventListener('click', e => {
        if (window.isEditable) return // ignore if content is editable
        e.preventDefault()
        e.stopPropagation()
        const ignore = !e.target.closest('.content-editable')
        if (ignore) return

        // if shift key is pressed remove only the clicked element
        const tr = !window.isShift && e.target.closest('tr')
        let el = tr || e.target
        const th = !e.target.closest('tfoot') && e.target.closest('th')
        const isColumn = tr && th

        if (isColumn) {
            // table column header clicked >> remove entire column
            const index = [...tr.children].indexOf(th)
            const table = th.closest('table')
            if (table && index >= 0) {
                const name = table.getAttribute('name')
                let tables = [table]
                // if table has a name attribute, select all tables that has the same name
                if (!!name) tables = [...document.querySelectorAll(`table[name="${name}"`)]
                const cells = tables
                    .map(table => [
                        ...table?.querySelectorAll(
                            'tbody td:nth-child(' + (index + 1) + ')'
                        ),
                        ...table?.querySelectorAll(
                            'thead th:nth-child(' + (index + 1) + ')'
                        ),
                    ])
                    .flat()
                    .flat()
                    .filter(Boolean)
                if (cells.length) el = cells
            }
        }

        (isArr(el) ? el : [el]).forEach(el =>
            el.hidden = true
        )

        window.undoList.push(el)
        window.handleUndoListChanged()
    })

    // unhide on CTRL+Z press
    window.handleUndo = deferred((undo = true) => {
        if (undo) {

            let el = window.undoList.pop() || {}
            const arr = isArr(el)
                ? el
                : [el]
            arr.forEach(el =>
                el.hidden = false
            )
            window.handleUndoListChanged()
        }
        window.pressedKeys.clear()

    })
    window.setShift = e => {
        if (window.isShift === e.shiftKey) return

        window.isShift = e.shiftKey
        document.body.classList[e.shiftKey ? 'add' : 'remove']('shift')
    }
    window.replaceEventListener('keydown', e => {
        window.setShift(e)
        window.pressedKeys.add(
            e.code.replace('Key', '')
        )
        const undo = e.ctrlKey
            && !window.isEditable
            && [...window.pressedKeys].includes('Z')
        window.handleUndo(undo)
    })
    window.replaceEventListener('keyup', window.setShift)
    window.replaceEventListener('mouseenter', window.setShift)

    // unhide on undo button click
    window.replaceEventListener(
        'click',
        () => window.handleUndo(true),
        '.ui.button.undo'
    )

    // print on print button click
    window.replaceEventListener(
        'click',
        () => window.print(),
        '.ui.button.print'
    )


    // highlight column on table header cell hover
    document
        .querySelectorAll('thead th')
        .forEach(th => {
            const toggleClass = (e, add = true) => {
                window.setShift(e)
                if (window.isEditable) return
                if (window.isShift) add = false
                let tables = [th.closest('table')]
                const name = tables[0].getAttribute('name')
                // if table has a name attribute, select all tables that has the same name
                if (!!name) tables = [...document.querySelectorAll(`table[name="${name}"`)]

                const index = [...th.closest('tr').children].indexOf(th)

                if (index < 0) return
                const cells = tables
                    .map(table => [
                        ...table.querySelectorAll(
                            'tbody td:nth-child(' + (index + 1) + ')'
                        ),
                        ...table.querySelectorAll(
                            'thead th:nth-child(' + (index + 1) + ')'
                        ),
                    ])
                    .flat()
                    .flat()
                    .filter(Boolean)

                cells.forEach(cell =>
                    cell.classList[add ? 'add' : 'remove'](window.classHightlightRemove)
                )
            }
            window.replaceEventListener('mousemove', e => toggleClass(e), th)
            window.replaceEventListener('mouseleave', e => toggleClass(e, false), th)
        })

    // handle editable text checkbox click 
    window.replaceEventListener('click', e => {
        const checkbox = e
            .currentTarget
            .querySelector('input')
        checkbox.checked = !checkbox.checked
        const { checked } = checkbox

        // add class to body
        document.body.classList[checked ? 'add' : 'remove']('editable')
        window.isEditable = checked

        // change editability of printable content
        document
            .querySelector('.content-editable')
            .setAttribute('contenteditable', !!checked)
    }, '.checkbox.editable')

    setupSaveTableAsCsv(window, document)
}

const setupSaveTableAsCsv = (window, document) => {
    const table = document.querySelector('table')
    if (!table) return

    const csvButton = document.querySelector('.ui.button.csv')
    csvButton.hidden = false
    const handleSaveAsCSV = async e => {
        e.preventDefault()
        const table = document.querySelector('table')
        if (!table) return

        let filenameSuffix = ''
        let filename = table.getAttribute('filename') || ''
        const getRows = () => {
            const name = table.getAttribute('name')
            const tables = !name
                ? [table]
                : [...document.querySelectorAll(`table[name="${name}"]`)]
            filenameSuffix = arrUnique(
                tables
                    .map(table => table.getAttribute('filename-suffix'))
                    .filter(Boolean)
            ).join('_')

            return [...tables]
                .map(table => [...table.querySelectorAll('tbody tr')])
                .flat()
        }
        const placeholderTag = 'TEMP_PLACEHOLDER'
        const removed = [
            ...document.querySelectorAll('body style'),
            ...document.querySelectorAll('body [hidden]'),
        ].map((el, i) => {
            const replacement = document.createElement(placeholderTag)
            replacement.setAttribute('index', i)
            el.replaceWith(replacement)
            return el
        })
        const headers = [...table.querySelectorAll('thead th')]
            .map(th => `"${th.textContent.trim()}"`)
        const rows = getRows('tbody tr')
            .map(tr => {
                const row = [...tr.querySelectorAll('td')]
                    .map(td => `"${td.textContent.trim()}"`)
                return row
            })

        // find and remove empty columns
        const excludeColIndexes = headers
            .map((_, i) => {
                const col = rows.map(row => row[i])
                const exclude = col.every(x => x === '""')
                return exclude
                    ? i
                    : null
            })
            .filter(x => x !== null)

        const lines = [
            headers
                .filter((_, i) => !excludeColIndexes.includes(i))
                .join(),
            ...rows.map(row =>
                row.filter((_, i) => !excludeColIndexes.includes(i))
                    .join()
            )
        ]
        filename = [
            filename
            || table
                .closest('.content-segment')
                ?.querySelector('h3.header')
                ?.textContent
            || document.querySelector('h2')?.textContent
            || document.querySelector('h1')?.textContent
            || 'table',
            filenameSuffix
        ]
            .filter(Boolean)
            .join(' - ')

        downloadFile(
            lines.join('\n'),
            `${filename}.csv`,
            'text/csv'
        )
        document
            .querySelectorAll(placeholderTag)
            .forEach(x => {
                const index = parseInt(x.getAttribute('index'))
                x.replaceWith(removed[index])
            })
    }
    window.replaceEventListener(
        'click',
        handleSaveAsCSV,
        '.ui.button.csv'
    )
}
const getDocumentHtml = (bodyClass, documentHeader) => `
<html>
    <head>
        ${documentHeader}
    </head>
    <body class='${bodyClass}'>
        <div class='content-editable' style='padding-bottom: 52px;'>
            <div class='empty-message'>
                <br /><br /><br />
                <center><i class='ui icon spinner loading massive'></i></center>
            </div>
        </div>
        <div class='print-bottom-bar' contenteditable='false'>
            <div>
                <div class='left'>
                    <div class='remove-instructions'>
                        - Click on any element (<b>SHIFT+click</b> inside table cell) or highlighted table row/column to hide. <br />
                        - Press <b>CTRL+Z</b> or click on "undo" button to unhide.
                    </div>
                    <div class='edit-instructions'>- Click on any texts to make amendments</div>
                </div>
                <div class='right'>
                    <div class='ui checked toggle checkbox editable'>
                        <input class='hidden editable' id='checkbox-editable' type='checkbox' />
                        <label for='checkbox-editable'><span>Text editable</span></label>
                    </div>
                    <a class='ui button undo disabled' title='Undo'>
                        <i class='ui icon undo no-margin'></i>
                        Undo <span class='count'></span>
                    </a>
                    <a class='ui button print'>
                        <i class='ui icon no-margin print'></i>
                        Print
                    </a>
                    <a class='ui button csv' hidden>
                        <i class='ui icon no-margin file excel outline'></i>
                        Save table a CSV
                    </a>
                </div>
            </div>
        </div>
    </body>
</html>`