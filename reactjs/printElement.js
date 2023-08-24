import { BehaviorSubject } from 'rxjs'
import PromisE from '../PromisE'

export const rxPrint = new BehaviorSubject(null)

export default async function printElement(
    selector = '.ui.table',
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
    printWindow
        .document
        .querySelector('.content-editable')
        .innerHTML = `
        ${title && `<h2>${title}</h2>`}
        
        <!-- // content from page for printing -->
        ${contentFromApp}`

    setupPrintWindow(printWindow, title)
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

    /* highlight table row to indicate "click to hide" */
    body:not(.printing):not(.editable):not(.shift) :not(thead) > tr:hover *,
    body:not(.printing):not(.editable):not(.shift) .highlight-remove,
    body:not(.printing):not(.editable):not(.shift) .highlight-remove *,
    body:not(.printing):not(.editable):not(.shift) .highlight-remove .ui.input input {
        background-color: red !important;
        color: white !important;
    }
    body:not(.printing):not(.editable) .content-editable * {
        cursor: not-allowed !important;
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
    .bottom-bar > div {
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
    .bottom-bar .left { 
        float: left;
        text-align: left;
    }
    body.editable .bottom-bar .remove-instructions,
    body:not(.editable) .bottom-bar .edit-instructions {
        display: none
    }
    .bottom-bar .right { 
        float: right;
        padding: 3px 0 3px;
    }
    .bottom-bar .right .button { 
        display: inline-block;
        height: 36px;
        margin-left: 3px;
    }
    .checkbox.editable label span {
        color: white !important;
    }


    /* styles applied just before printing */
    body.printing {
        padding: 0 !important;
    }
    body.printing .content-editable {
        padding: 0 !important;
    }
    body.printing .bottom-bar {
        display: none !important;
    }
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
    window.deferred = (callback, tid) => (...args) => {
        clearTimeout(tid)
        tid = setTimeout(callback, 200, ...args)
    }

    // hide on click
    window.handleUndoListChanged = () => {
        const undoable = window.undoList.length > 0
        const { classList } = document.body
        classList[undoable ? 'add' : 'remove']('undoable')
        const undo = document.querySelector('.bottom-bar .undo')
        undo.classList[!undoable ? 'add' : 'remove']('disabled')

        const count = document.querySelector('.bottom-bar .undo .count')
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

        (Array.isArray(el) ? el : [el])
            .forEach(el => el.hidden = true)

        window.undoList.push(el)
        window.handleUndoListChanged()
    })

    // unhide on CTRL+Z press
    window.handleUndo = window.deferred((undo = true) => {
        if (undo) {
            let el = window.undoList.pop() || {}
            const arr = Array.isArray(el)
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
    window.replaceEventListener('click', e => {
        document.body.classList.toggle('printing')
        window.print()
        document.body.classList.toggle('printing')
    }, '.ui.button.print')


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
        <div class='bottom-bar' contenteditable='false'>
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
                        <i class='ui icon print no-margin'></i>
                        Print
                    </a>
                </div>
            </div>
        </div>
    </body>
</html>`