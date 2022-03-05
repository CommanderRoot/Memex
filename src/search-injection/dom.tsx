/*
DOM manipulation helper functions
*/
import { browser } from 'webextension-polyfill-ts'
import React from 'react'
import ReactDOM from 'react-dom'
import { StyleSheetManager, ThemeProvider } from 'styled-components'

import Container from './components/container'
import * as constants from './constants'
import { injectCSS } from '../util/content-injection'
import LoadingIndicator from '@worldbrain/memex-common/lib/common-ui/components/loading-indicator'
import { theme } from 'src/common-ui/components/design-library/theme'
import type { SyncSettingsStoreInterface } from 'src/sync-settings/types'

export const handleRender = async (
    query,
    requestSearcher,
    //{ docs, totalCount },
    searchEngine,
    syncSettings: SyncSettingsStoreInterface,
) => {
    // docs: (array of objects) returned by the search
    // totalCount: (int) number of results found
    // Injects CSS into the search page.
    // Calls renderComponent to render the react component

    // const searchRes = await requestSearcher({ query, limit: 21 })

    const renderComponent = async () => {
        // Accesses docs, totalCount from parent through closure
        // Gets position from settings
        // Renders React Component on the respective container
        const position =
            (await syncSettings.searchInjection.get('memexResultsPosition')) ??
            'side'

        const searchEngineObj = constants.SEARCH_ENGINES[searchEngine]
        // if (!searchEngineObj) {
        //     return false
        // }

        const component = document.getElementById('memexResults')
        if (component) {
            component.parentNode.removeChild(component)
        }

        const target = document.createElement('div')
        target.setAttribute('id', 'memexResults')

        const containerType = searchEngineObj.containerType
        const containerIdentifier = searchEngineObj.container[position]

        if (searchEngine === 'google') {
            const suggestionsContainer = document.getElementById(
                searchEngineObj.container.side,
            )
            const containerWithSuggestions = document.getElementById(
                searchEngineObj.container.sideAlternative,
            )

            const containerWithImages = document.getElementsByClassName(
                'pvresd',
            )

            const centerCol = document.getElementById(
                searchEngineObj.container.centerCol,
            )

            console.log('test', suggestionsContainer)
            console.log('test2', containerWithImages)

            if (position === 'side') {
                if (
                    suggestionsContainer === null &&
                    containerWithImages.length === 0
                ) {
                    console.log('test3')
                    containerWithSuggestions.style.display = 'grid'
                    containerWithSuggestions.style.gap = '130px'
                    containerWithSuggestions.style.flexDirection = 'row'
                    containerWithSuggestions.style.gridAutoFlow = 'column'
                    containerWithSuggestions.style.justifyContent =
                        'space-between'

                    containerWithSuggestions.insertAdjacentElement(
                        'beforeend',
                        target,
                    )
                }
                if (containerWithImages.length > 0) {
                    console.log('test4')
                    const element = document.createElement('div')
                    containerWithSuggestions.appendChild(element)
                    element.appendChild(centerCol)
                    element.style.display = 'flex'
                    element.style.gap = '40px'
                    containerWithSuggestions.style.display = 'grid'
                    containerWithSuggestions.style.flexDirection = 'colum'
                    containerWithSuggestions.style.justifyContent =
                        'space-between'

                    element.insertAdjacentElement('beforeend', target)
                }
                if (suggestionsContainer !== null) {
                    console.log('test4')
                    suggestionsContainer.insertBefore(
                        target,
                        suggestionsContainer.firstChild,
                    )
                }
            } else {
                const containerAbove = document.getElementById(
                    searchEngineObj.container.above,
                )
                console.log('test5')
                containerAbove.insertBefore(target, containerAbove.firstChild)
            }
        }

        if (searchEngine === 'brave') {
            const suggestionsContainer = document.getElementById(
                searchEngineObj.container.side,
            )
            const containerWithSuggestions = document.getElementById(
                searchEngineObj.container.sideAlternative,
            )

            if (position === 'side') {
                if (!suggestionsContainer) {
                    containerWithSuggestions.style.display = 'grid'
                    containerWithSuggestions.style.gap = '130px'
                    containerWithSuggestions.style.flexDirection = 'row'
                    containerWithSuggestions.style.gridAutoFlow = 'column'
                    containerWithSuggestions.style.justifyContent =
                        'space-between'

                    containerWithSuggestions.insertAdjacentElement(
                        'beforeend',
                        target,
                    )
                } else {
                    suggestionsContainer.insertBefore(
                        target,
                        suggestionsContainer.firstChild,
                    )
                }
            } else {
                const containerAbove = document.getElementById(
                    searchEngineObj.container.above,
                )
                containerAbove.insertBefore(target, containerAbove.firstChild)
            }
        }

        if (searchEngine === 'bing') {
            const suggestionsContainer = document.getElementById(
                searchEngineObj.container.side,
            )
            const containerWithSuggestions = document.getElementById(
                searchEngineObj.container.sideAlternative,
            )

            if (position === 'side') {
                if (!suggestionsContainer) {
                    containerWithSuggestions.style.display = 'grid'
                    containerWithSuggestions.style.gap = '130px'
                    containerWithSuggestions.style.flexDirection = 'row'
                    containerWithSuggestions.style.gridAutoFlow = 'column'
                    containerWithSuggestions.style.justifyContent =
                        'space-between'

                    containerWithSuggestions.insertAdjacentElement(
                        'beforeend',
                        target,
                    )
                } else {
                    suggestionsContainer.insertBefore(
                        target,
                        suggestionsContainer.firstChild,
                    )
                }
            } else {
                const containerAbove = document.getElementById(
                    searchEngineObj.container.above,
                )
                containerAbove.insertBefore(target, containerAbove.firstChild)
            }
        }

        if (searchEngine === 'duckduckgo') {
            const container = document.getElementsByClassName(
                containerIdentifier,
            )[0]
            container.insertBefore(target, container.firstChild)
        }

        // console.log(containerIdentifier)

        // // If re-rendering remove the already present component
        // const component = document.getElementById('memexResults')
        // if (component) {
        //     component.parentNode.removeChild(component)
        // }

        // const target = document.createElement('div')
        // target.setAttribute('id', 'memexResults')
        // container.insertBefore('beforeend', target)

        // Number of results to limit
        const limit = constants.LIMIT[position]

        // Render the React component on the target element
        // Passing this same function so that it can change position

        ReactDOM.render(
            <StyleSheetManager target={target}>
                <ThemeProvider theme={theme}>
                    <Container
                        query={query}
                        requestSearcher={requestSearcher}
                        // results={searchRes.docs.slice(0, limit)}
                        // len={searchRes.totalCount}
                        rerender={renderComponent}
                        searchEngine={searchEngine}
                        syncSettings={syncSettings}
                        position={position}
                    />
                </ThemeProvider>
            </StyleSheetManager>,
            target,
        )
    }

    const cssFile = browser.runtime.getURL(
        '/content_script_search_injection.css',
    )
    await injectCSS(cssFile)

    // if (!(document.readyState === 'complete'  ||
    //     document.readyState === 'interactive')) {
    //     renderLoading()
    // }
    // Check if the document has completed loading,
    // if it has, execute the rendering function immediately
    // else attach it to the DOMContentLoaded event listener

    renderComponent()

    if (
        !(
            document.readyState === 'complete' ||
            document.readyState === 'interactive' ||
            document.readyState === 'loading'
        )
    ) {
        document.addEventListener('DOMContentLoaded', renderComponent, true)
    }
}
