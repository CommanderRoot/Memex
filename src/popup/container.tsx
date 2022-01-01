import React, { KeyboardEventHandler } from 'react'
import qs from 'query-string'
import { connect, MapStateToProps } from 'react-redux'
import { browser } from 'webextension-polyfill-ts'
import styled from 'styled-components'

import { StatefulUIElement } from 'src/util/ui-logic'
import * as constants from '../constants'
import Logic, { State, Event } from './logic'
import analytics from '../analytics'
import extractQueryFilters from '../util/nlp-time-filter'
import { remoteFunction, runInBackground } from '../util/webextensionRPC'
import Search from './components/Search'
import LinkButton from './components/LinkButton'
import ButtonIcon from './components/ButtonIcon'
import { TooltipButton } from './tooltip-button'
import { SidebarButton } from './sidebar-button'
import { HistoryPauser } from './pause-button'
import {
    selectors as tagsSelectors,
    acts as tagActs,
    TagsButton,
} from './tags-button'
import {
    selectors as collectionsSelectors,
    acts as collectionActs,
    CollectionsButton,
} from './collections-button'
import { BookmarkButton } from './bookmark-button'
import * as selectors from './selectors'
import * as acts from './actions'
import { ClickHandler, RootState } from './types'
import { EVENT_NAMES } from '../analytics/internal/constants'
import CollectionPicker from 'src/custom-lists/ui/CollectionPicker'
import TagPicker from 'src/tags/ui/TagPicker'
import { tags, collections } from 'src/util/remote-functions-background'
import { BackContainer } from 'src/popup/components/BackContainer'
const btnStyles = require('./components/Button.css')
const styles = require('./components/Popup.css')

import { createSyncSettingsStore } from 'src/sync-settings/util'
import { isFullUrlPDF } from 'src/util/uri-utils'
import { ToggleSwitchButton } from './components/ToggleSwitchButton'
import { PrimaryAction } from 'src/common-ui/components/design-library/actions/PrimaryAction'
import checkBrowser from 'src/util/check-browser'

export interface OwnProps {}

interface StateProps {
    showTagsPicker: boolean
    showCollectionsPicker: boolean
    tabId: number
    url: string
    initLogicRun: boolean
    searchValue: string
}

interface DispatchProps {
    initState: () => Promise<void>
    handleSearchChange: ClickHandler<HTMLInputElement>
    toggleShowTagsPicker: () => void
    toggleShowCollectionsPicker: () => void
    onTagAdd: (tag: string) => void
    onTagDel: (tag: string) => void
    onCollectionAdd: (collection: string) => void
    onCollectionDel: (collection: string) => void
}

export type Props = OwnProps & StateProps & DispatchProps

class PopupContainer extends StatefulUIElement<Props, State, Event> {
    constructor(props: Props) {
        super(
            props,
            new Logic({
                tabsAPI: browser.tabs,
                runtimeAPI: browser.runtime,
                pdfIntegrationBG: runInBackground(),
                syncSettings: createSyncSettingsStore({
                    syncSettingsBG: runInBackground(),
                }),
            }),
        )
    }

    async componentDidMount() {
        await super.componentDidMount()
        analytics.trackEvent({
            category: 'Global',
            action: 'openPopup',
        })
        await this.props.initState()
        console.log(this.state)
    }

    processAnalyticsEvent = remoteFunction('processEvent')

    closePopup = () => window.close()

    onSearchEnter: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            analytics.trackEvent({
                category: 'Search',
                action: 'searchViaPopup',
            })

            this.processAnalyticsEvent({
                type: EVENT_NAMES.SEARCH_POPUP,
            })

            const queryFilters = extractQueryFilters(this.props.searchValue)
            const queryParams = qs.stringify(queryFilters)

            browser.tabs.create({
                url: `${constants.OVERVIEW_URL}?${queryParams}`,
            }) // New tab with query

            this.closePopup()
        }
    }

    onSearchClick = () => {
        const queryFilters = extractQueryFilters(this.props.searchValue)
        const queryParams = qs.stringify(queryFilters)

        browser.tabs.create({
            url: `${constants.OVERVIEW_URL}?${queryParams}`,
        }) // New tab with query

        this.closePopup()
    }

    handleTagUpdate = async ({ added, deleted }) => {
        const backendResult = tags.updateTagForPageInCurrentTab({
            added,
            deleted,
            url: this.props.url,
        })
        // Redux actions
        if (added) {
            this.props.onTagAdd(added)
        }
        if (deleted) {
            return this.props.onTagDel(deleted)
        }
        return backendResult
    }

    handleTagAllTabs = (tagName: string) =>
        tags.addTagsToOpenTabs({ name: tagName })
    fetchTagsForPage = async () => tags.fetchPageTags({ url: this.props.url })

    handleListUpdate = async ({ added, deleted }) => {
        const backendResult = collections.updateListForPageInCurrentTab({
            added,
            deleted,
            url: this.props.url,
        })
        // Redux actions
        if (added) {
            this.props.onCollectionAdd(added)
        }
        if (deleted) {
            return this.props.onCollectionDel(deleted)
        }
        return backendResult
    }

    handleListAllTabs = (listName: string) =>
        collections.addOpenTabsToList({ name: listName })
    fetchListsForPage = async () =>
        collections.fetchPageLists({ url: this.props.url })

    getPDFLocation = () => {
        if (this.state.currentPageUrl.startsWith('file://')) {
            return 'local'
        } else {
            return 'remote'
        }
    }

    getPDFmode = () => {
        if (
            this.state.currentPageUrl.startsWith('chrome-extension') ||
            this.state.currentPageUrl.startsWith('moz-extension')
        ) {
            return 'reader'
        } else {
            return 'original'
        }
    }

    private get isCurrentPagePDF(): boolean {
        return isFullUrlPDF(this.props.url)
    }

    renderChildren() {
        if (!this.props.initLogicRun) {
            return false
        }

        if (this.props.showTagsPicker) {
            return (
                <TagPicker
                    onUpdateEntrySelection={this.handleTagUpdate}
                    initialSelectedEntries={this.fetchTagsForPage}
                    actOnAllTabs={this.handleTagAllTabs}
                >
                    <BackContainer onClick={this.props.toggleShowTagsPicker} />
                </TagPicker>
            )
        }

        if (this.props.showCollectionsPicker) {
            return (
                <CollectionPicker
                    onUpdateEntrySelection={this.handleListUpdate}
                    initialSelectedEntries={this.fetchListsForPage}
                    actOnAllTabs={this.handleListAllTabs}
                >
                    <BackContainer
                        onClick={this.props.toggleShowCollectionsPicker}
                    />
                </CollectionPicker>
            )
        }

        return (
            <React.Fragment>
                {this.isCurrentPagePDF &&
                    (checkBrowser() === 'firefox' &&
                    this.getPDFLocation() === 'local' ? (
                        <BlurredNotice
                            browser={checkBrowser()}
                            location={this.getPDFLocation()}
                        >
                            <NoticeTitle>
                                Saving and annotating locally stored PDFs not
                                available on Firefox
                            </NoticeTitle>
                        </BlurredNotice>
                    ) : this.getPDFmode() === 'original' ? (
                        <BlurredNotice browser={checkBrowser()}>
                            <NoticeTitle>Save & annotate this PDF</NoticeTitle>
                            <PrimaryAction
                                label={'Open PDF Reader'}
                                onClick={() =>
                                    this.processEvent('openPDFReader', null)
                                }
                            />
                        </BlurredNotice>
                    ) : null)}
                <div className={styles.item}>
                    <BookmarkButton closePopup={this.closePopup} />
                </div>
                <div className={styles.item}>
                    <CollectionsButton
                        fetchCollections={this.fetchListsForPage}
                    />
                </div>
                {this.state.userBeforeTagUnification === true && (
                    <div className={styles.item}>
                        <TagsButton fetchTags={this.fetchTagsForPage} />
                    </div>
                )}
                <hr />

                <div className={styles.item}>
                    <LinkButton goToDashboard={this.onSearchClick} />
                </div>

                <hr />

                <div className={styles.item}>
                    <SidebarButton closePopup={this.closePopup} />
                </div>

                <div className={styles.item}>
                    <TooltipButton closePopup={this.closePopup} />
                </div>

                <div className={styles.item}>
                    <ToggleSwitchButton
                        btnIcon={btnStyles.PDFIcon}
                        contentType="PDFs"
                        btnText="Open PDF reader"
                        btnHoverText="Open current PDF in Memex PDF reader"
                        toggleHoverText="Enable/disable Memex PDF reader on web PDFs"
                        isEnabled={this.state.isPDFReaderEnabled}
                        onBtnClick={() =>
                            this.processEvent('openPDFReader', null)
                        }
                        onToggleClick={() =>
                            this.processEvent('togglePDFReaderEnabled', null)
                        }
                    />
                </div>

                <hr />

                <div className={styles.buttonContainer}>
                    <a
                        href="https://worldbrain.io/feedback"
                        target="_blank"
                        className={styles.feedbackButton}
                    >
                        🐞 Feedback
                    </a>
                    <div className={styles.buttonBox}>
                        <div
                            onClick={() =>
                                window.open(
                                    `${constants.OPTIONS_URL}#/settings`,
                                )
                            }
                            className={btnStyles.settings}
                        />
                        <div
                            onClick={() =>
                                window.open('https://worldbrain.io/tutorials')
                            }
                            className={btnStyles.help}
                        />
                        {/*<NotifButton />*/}
                    </div>
                </div>
            </React.Fragment>
        )
    }

    render() {
        return <div className={styles.popup}>{this.renderChildren()}</div>
    }
}

const NoticeTitle = styled.div`
    font-size: 16px;
    color: ${(props) => props.theme.colors.primary};
    font-weight: bold;
    padding-bottom: 10px;
    text-align: center;
    padding: 0 10px;
    margin-bottom: 20px;
`

const BlurredNotice = styled.div<{
    browser: string
    location: string
}>`
    position absolute;
    height: ${(props) =>
        props.browser === 'firefox' && props.location === 'local'
            ? '90%'
            : '67%'};
    border-bottom: 1px solid #e0e0e0;
    width: 100%;
    z-index: 20;
    overflow-y: ${(props) =>
        props.browser === 'firefox' && props.location === 'local'
            ? 'hidden'
            : 'scroll'};
    background: ${(props) => (props.browser === 'firefox' ? 'white' : 'none')};
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: flex-start;
    padding-top: 50px;
    align-items: center;
    flex-direction: column;
`

const DashboardButtonBox = styled.div`
    height: 45px;
    width: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &: hover {
        background-color: #e0e0e0;
        border-radius: 3px;
    }
`

const BottomBarBox = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: 45px;

    & > div {
        width: 45px;
    }
`

const LinkButtonBox = styled.img`
    height: 24px;
    width: 24px;
`

const mapState: MapStateToProps<StateProps, OwnProps, RootState> = (state) => ({
    tabId: selectors.tabId(state),
    url: selectors.url(state),
    searchValue: selectors.searchValue(state),
    showCollectionsPicker: collectionsSelectors.showCollectionsPicker(state),
    showTagsPicker: tagsSelectors.showTagsPicker(state),
    initLogicRun: selectors.initLogicRun(state),
})

const mapDispatch = (dispatch): DispatchProps => ({
    initState: () => dispatch(acts.initState()),
    handleSearchChange: (e) => {
        e.preventDefault()
        const input = e.target as HTMLInputElement
        dispatch(acts.setSearchVal(input.value))
    },
    toggleShowTagsPicker: () => dispatch(tagActs.toggleShowTagsPicker()),
    toggleShowCollectionsPicker: () =>
        dispatch(collectionActs.toggleShowTagsPicker()),
    onTagAdd: (tag: string) => dispatch(tagActs.addTagToPage(tag)),
    onTagDel: (tag: string) => dispatch(tagActs.deleteTag(tag)),
    onCollectionAdd: (collection: string) =>
        dispatch(collectionActs.addCollectionToPage(collection)),
    onCollectionDel: (collection: string) =>
        dispatch(collectionActs.deleteCollection(collection)),
})

export default connect<StateProps, DispatchProps, OwnProps>(
    mapState,
    mapDispatch,
)(PopupContainer)
