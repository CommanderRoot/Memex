import * as React from 'react'
import browser from 'webextension-polyfill'
import styled, { ThemeProvider, css } from 'styled-components'
import { createGlobalStyle } from 'styled-components'

import { StatefulUIElement } from 'src/util/ui-logic'
import AnnotationsSidebar, {
    AnnotationsSidebar as AnnotationsSidebarComponent,
    AnnotationsSidebarProps,
} from '../components/AnnotationsSidebar'
import { SidebarContainerLogic, SidebarContainerOptions } from './logic'

import type {
    SidebarContainerState,
    SidebarContainerEvents,
    AnnotationInstanceRefs,
} from './types'
import { ConfirmModal } from 'src/common-ui/components'
import { TooltipBox } from '@worldbrain/memex-common/lib/common-ui/components/tooltip-box'
import type { AnnotationFooterEventProps } from 'src/annotations/components/AnnotationFooter'
import type { ListDetailsGetter } from 'src/annotations/types'
import {
    AnnotationEditEventProps,
    AnnotationEditGeneralProps,
} from 'src/annotations/components/AnnotationEdit'
import * as icons from 'src/common-ui/components/design-library/icons'
import SingleNoteShareMenu from 'src/overview/sharing/SingleNoteShareMenu'
import { PageNotesCopyPaster } from 'src/copy-paster'
import { normalizeUrl } from '@worldbrain/memex-common/lib/url-utils/normalize'
import { copyToClipboard } from 'src/annotations/content_script/utils'
import analytics from 'src/analytics'
import { getListShareUrl } from 'src/content-sharing/utils'
import { Rnd } from 'react-rnd'
import Icon from '@worldbrain/memex-common/lib/common-ui/components/icon'
import type { Props as SpacePickerDependencies } from 'src/custom-lists/ui/CollectionPicker'
import CollectionPicker from 'src/custom-lists/ui/CollectionPicker'
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../constants'
import ConfirmDialog from 'src/common-ui/components/ConfirmDialog'
import {
    PRIVATIZE_ANNOT_MSG,
    SELECT_SPACE_ANNOT_MSG,
    SELECT_SPACE_ANNOT_SUBTITLE,
    PRIVATIZE_ANNOT_AFFIRM_LABEL,
    PRIVATIZE_ANNOT_NEGATIVE_LABEL,
    SELECT_SPACE_NEGATIVE_LABEL,
    SELECT_SPACE_AFFIRM_LABEL,
} from 'src/overview/sharing/constants'
import type {
    UnifiedAnnotation,
    UnifiedList,
} from 'src/annotations/cache/types'
import { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import KeyboardShortcuts from '@worldbrain/memex-common/lib/common-ui/components/keyboard-shortcuts'
import * as cacheUtils from 'src/annotations/cache/utils'
import { generateAnnotationCardInstanceId } from './utils'
import type { AnnotationCardInstanceLocation } from '../types'
import { YoutubeService } from '@worldbrain/memex-common/lib/services/youtube'
import { getBlockContentYoutubePlayerId } from '@worldbrain/memex-common/lib/common-ui/components/block-content'
import { YoutubePlayer } from '@worldbrain/memex-common/lib/services/youtube/types'
import { AICounterIndicator } from 'src/util/subscriptions/AICountIndicator'
import SpaceContextMenu from 'src/custom-lists/ui/space-context-menu'
import PageLinkMenu from 'src/custom-lists/ui/page-link-share-menu'
import { ImageSupportInterface } from 'src/image-support/background/types'
import { TOOLTIP_WIDTH } from 'src/in-page-ui/ribbon/constants'
import { PkmSyncInterface } from 'src/pkm-integrations/background/types'
import { RemoteBGScriptInterface } from 'src/background-script/types'

export interface Props extends SidebarContainerOptions {
    isLockable?: boolean
    skipTopBarRender?: boolean
    setSidebarWidthforDashboard?: (sidebarWidth) => void
    onNotesSidebarClose?: () => void
    youtubeService?: YoutubeService
    getYoutubePlayer?(): YoutubePlayer
    imageSupport?: ImageSupportInterface<'caller'>
    pkmSyncBG?: PkmSyncInterface
    bgScriptBG?: RemoteBGScriptInterface
}

export class AnnotationsSidebarContainer<
    P extends Props = Props
> extends StatefulUIElement<P, SidebarContainerState, SidebarContainerEvents> {
    protected sidebarRef = React.createRef<AnnotationsSidebarComponent>()
    private annotationInstanceRefs: {
        [instanceId: string]: AnnotationInstanceRefs
    } = {}

    static defaultProps: Pick<Props, 'runtimeAPI' | 'storageAPI'> = {
        runtimeAPI: browser.runtime,
        storageAPI: browser.storage,
    }

    constructor(props: P) {
        super(
            props,
            new SidebarContainerLogic({
                ...props,
                analytics,
                copyToClipboard,
                focusCreateForm: () => {
                    ;(this.sidebarRef
                        ?.current as AnnotationsSidebarComponent)?.focusCreateForm()
                },
                focusEditNoteForm: (annotationId) => {
                    ;(this.sidebarRef?.current[
                        'instanceRef'
                    ] as AnnotationsSidebarComponent)?.focusEditNoteForm(
                        annotationId,
                    )
                },
                imageSupport: props.imageSupport,
                pkmSyncBG: props.pkmSyncBG,
                bgScriptBG: props.bgScriptBG,
            }),
        )

        console.log('slalsd', this.props.bgScriptBG)

        window['_getState'] = () => ({ ...this.state })
        this.listenToWindowChanges()
    }

    listenToWindowChanges() {
        window.addEventListener('resize', () => {
            if (this.state.isWidthLocked) {
                this.processEvent('adjustSidebarWidth', {
                    newWidth: this.state.sidebarWidth,
                    isWidthLocked: true,
                })
            }
        })
    }

    private createNewList = (
        annotationId?: UnifiedAnnotation['unifiedId'],
    ) => async (name: string) => {
        const listId = Date.now()

        // this.props.annotationsCache.addList({
        //     name,
        //     localId: listId,
        //     unifiedAnnotationIds: annotationId ? [annotationId] : [],
        //     hasRemoteAnnotationsToLoad: false,
        //     creator: this.props.getCurrentUser(),
        //     type: 'user-list',
        // })
        await this.props.customListsBG.createCustomList({
            name: name,
            id: listId,
        })

        return listId
    }

    private getListDetailsById: ListDetailsGetter = (listId) => {
        const list = this.props.annotationsCache.getListByLocalId(listId)
        return {
            name: list?.name ?? 'Missing list',
            isShared: list?.remoteId != null,
            description: list?.description,
            type: list?.type ?? null,
        }
    }

    async toggleSidebarShowForPageId(fullPageUrl: string) {
        const isAlreadyOpenForOtherPage = fullPageUrl !== this.state.fullPageUrl

        if (this.state.showState === 'hidden' || isAlreadyOpenForOtherPage) {
            this.showSidebar()
            await this.processEvent('setPageUrl', { fullPageUrl })
        } else if (this.state.showState === 'visible') {
            this.hideSidebar()
        }
    }

    showSidebar() {
        this.processEvent('show', {
            existingWidthState: this.state.sidebarWidth
                ? this.state.sidebarWidth
                : SIDEBAR_WIDTH_STORAGE_KEY,
        })

        if (this.props.sidebarContext === 'dashboard') {
            document.addEventListener('keydown', this.listenToEsc)
        }
    }

    hideSidebar() {
        this.processEvent('hide', null)

        if (this.props.sidebarContext === 'dashboard') {
            setTimeout(() => {
                document.removeEventListener('keydown', this.listenToEsc)
                this.props.onNotesSidebarClose()
            }, 50)
        }
    }

    listenToEsc = (event) => {
        if (event.key === 'Escape') {
            this.hideSidebar()
        }
    }
    toggleSidebarLock = () =>
        this.processEvent(this.state.isLocked ? 'unlock' : 'lock', null)

    toggleSidebarWidthLock = () => {
        this.processEvent(
            this.state.isWidthLocked ? 'unlockWidth' : 'lockWidth',
            null,
        )

        if (!this.state.isWidthLocked) {
            this.processEvent('adjustSidebarWidth', {
                newWidth: this.state.sidebarWidth
                    ? this.state.sidebarWidth
                    : SIDEBAR_WIDTH_STORAGE_KEY,
                isWidthLocked: true,
            })
        }
    }

    protected bindAnnotationFooterEventProps(
        annotation: Pick<UnifiedAnnotation, 'unifiedId' | 'body'>,
        instanceLocation: AnnotationCardInstanceLocation,
    ): AnnotationFooterEventProps & {
        onGoToAnnotation?: React.MouseEventHandler
    } {
        const cardId = generateAnnotationCardInstanceId(
            annotation,
            instanceLocation,
        )
        const annotationCardInstance = this.state.annotationCardInstances[
            cardId
        ]
        const unifiedAnnotationId = annotation.unifiedId
        return {
            onEditIconClick: () =>
                this.processEvent('setAnnotationEditMode', {
                    instanceLocation,
                    unifiedAnnotationId,
                    isEditing: !annotationCardInstance.isCommentEditing,
                }),
            onDeleteIconClick: () =>
                this.processEvent('setAnnotationCardMode', {
                    instanceLocation,
                    unifiedAnnotationId,
                    mode: 'delete-confirm',
                }),
            onDeleteCancel: () =>
                this.processEvent('setAnnotationCardMode', {
                    instanceLocation,
                    unifiedAnnotationId,
                    mode: 'none',
                }),
            onDeleteConfirm: () =>
                this.processEvent('deleteAnnotation', { unifiedAnnotationId }),
            onShareClick: (mouseEvent) =>
                // TODO: work out if this is needed/how to unfiy with editAnnotation
                this.processEvent('editAnnotation', {
                    instanceLocation,
                    unifiedAnnotationId,
                    shouldShare: true,
                    // mouseEvent,
                }),
            onGoToAnnotation:
                this.props.showGoToAnnotationBtn && annotation.body?.length > 0
                    ? () =>
                          this.processEvent('goToAnnotationInNewTab', {
                              unifiedAnnotationId,
                          })
                    : undefined,
            onCopyPasterBtnClick: () =>
                this.processEvent('setAnnotationCardMode', {
                    instanceLocation,
                    unifiedAnnotationId,
                    mode: 'copy-paster',
                }),
        }
    }

    protected bindAnnotationEditProps = (
        annotation: Pick<
            UnifiedAnnotation,
            'unifiedId' | 'privacyLevel' | 'normalizedPageUrl' | 'localId'
        >,
        instanceLocation: AnnotationCardInstanceLocation,
    ): AnnotationEditEventProps & AnnotationEditGeneralProps => {
        const cardId = generateAnnotationCardInstanceId(
            annotation,
            instanceLocation,
        )
        const annotationCardInstance = this.state.annotationCardInstances[
            cardId
        ]
        const unifiedAnnotationId = annotation.unifiedId

        return {
            comment: annotationCardInstance?.comment,
            onListsBarPickerBtnClick: () =>
                this.processEvent('setAnnotationCardMode', {
                    instanceLocation,
                    unifiedAnnotationId,
                    mode: 'space-picker',
                }),
            onCommentChange: (comment) =>
                this.processEvent('setAnnotationEditCommentText', {
                    instanceLocation,
                    unifiedAnnotationId,
                    comment,
                    annotation,
                }),
            onEditConfirm: (showExternalConfirmations) => (
                shouldShare,
                isProtected,
                opts,
            ) => {
                const showConfirmation =
                    showExternalConfirmations &&
                    annotation.privacyLevel >= AnnotationPrivacyLevels.SHARED &&
                    !shouldShare
                return this.processEvent(
                    showConfirmation
                        ? 'setPrivatizeNoteConfirmArgs'
                        : 'editAnnotation',
                    {
                        instanceLocation,
                        unifiedAnnotationId,
                        shouldShare,
                        isProtected,
                        mainBtnPressed: opts?.mainBtnPressed,
                        keepListsIfUnsharing: opts?.keepListsIfUnsharing,
                    },
                )
            },
            onEditCancel: () =>
                this.processEvent('cancelAnnotationEdit', {
                    instanceLocation,
                    unifiedAnnotationId,
                    isEditing: false,
                }),
            imageSupport: this.props.imageSupport,
        }
    }

    protected getCreateProps(): AnnotationsSidebarProps['annotationCreateProps'] {
        return {
            onCommentChange: (comment) =>
                this.processEvent('setNewPageNoteText', { comment }),
            onCancel: () => this.processEvent('cancelNewPageNote', null),
            onSave: (shouldShare, isProtected, listInstanceId) =>
                this.processEvent('saveNewPageNote', {
                    shouldShare,
                    isProtected,
                    listInstanceId,
                }),
            renderSpacePicker: () => (
                <CollectionPicker
                    showPageLinks
                    selectEntry={(listId) =>
                        this.processEvent('setNewPageNoteLists', {
                            lists: [...this.state.commentBox.lists, listId],
                        })
                    }
                    unselectEntry={(listId) =>
                        this.processEvent('setNewPageNoteLists', {
                            lists: this.state.commentBox.lists.filter(
                                (id) => id !== listId,
                            ),
                        })
                    }
                    createNewEntry={this.createNewList()}
                    annotationsCache={this.props.annotationsCache}
                    pageActivityIndicatorBG={this.props.pageActivityIndicatorBG}
                    contentSharingBG={this.props.contentSharingBG}
                    analyticsBG={this.props.analyticsBG}
                    spacesBG={this.props.customListsBG}
                    authBG={this.props.authBG}
                    normalizedPageUrlToFilterPageLinksBy={normalizeUrl(
                        this.state.fullPageUrl,
                    )}
                    bgScriptBG={this.props.bgScriptBG}
                    onListFocus={(listId: UnifiedList['localId']) => {
                        const unifiedListId: UnifiedList['unifiedId'] = this.props.annotationsCache.getListByLocalId(
                            listId,
                        ).unifiedId

                        this.processEvent('setSelectedList', { unifiedListId })
                    }}
                />
            ),
            getListDetailsById: this.getListDetailsById,
            comment: this.state.commentBox.commentText,
            lists: this.state.commentBox.lists,
            hoverState: null,
            imageSupport: this.props.imageSupport,
        }
    }

    private handleCopyAllNotesClick: React.MouseEventHandler = (e) => {
        e.preventDefault()

        this.processEvent('setAllNotesCopyPasterShown', {
            shown: !this.state.showAllNotesCopyPaster,
        })
    }

    private getSpacePickerProps = (params: {
        annotation: UnifiedAnnotation
        showExternalConfirmations?: boolean
    }): SpacePickerDependencies => {
        const {
            authBG,
            customListsBG,
            contentSharingBG,
            annotationsCache,
            pageActivityIndicatorBG,
        } = this.props
        // This is to show confirmation modal if the annotation is public and the user is trying to add it to a shared space
        const getUpdateListsEvent = (listId: number) =>
            [
                AnnotationPrivacyLevels.SHARED,
                AnnotationPrivacyLevels.SHARED_PROTECTED,
            ].includes(params.annotation.privacyLevel) &&
            annotationsCache.getListByLocalId(listId)?.remoteId != null &&
            params.showExternalConfirmations
                ? 'setSelectNoteSpaceConfirmArgs'
                : 'updateListsForAnnotation'

        return {
            authBG,
            annotationsCache,
            contentSharingBG,
            analyticsBG: this.props.analyticsBG,
            pageActivityIndicatorBG,
            spacesBG: customListsBG,
            showPageLinks: true,
            bgScriptBG: this.props.bgScriptBG,
            localStorageAPI: this.props.storageAPI.local,
            unifiedAnnotationId: params.annotation.unifiedId,
            createNewEntry: this.createNewList(params.annotation.unifiedId),
            initialSelectedListIds: () =>
                cacheUtils.getLocalListIdsForCacheIds(
                    annotationsCache,
                    params.annotation.unifiedListIds,
                ),
            selectEntry: async (listId, options) => {
                this.processEvent(getUpdateListsEvent(listId), {
                    added: listId,
                    deleted: null,
                    unifiedAnnotationId: params.annotation.unifiedId,
                    options,
                })
            },
            unselectEntry: async (listId) =>
                this.processEvent('updateListsForAnnotation', {
                    added: null,
                    deleted: listId,
                    unifiedAnnotationId: params.annotation.unifiedId,
                }),
            normalizedPageUrlToFilterPageLinksBy: normalizeUrl(
                this.state.fullPageUrl,
            ),
        }
    }

    private renderCopyPasterManagerForAnnotation = (
        instanceLocation: AnnotationCardInstanceLocation,
    ) => (unifiedId: UnifiedAnnotation['unifiedId']) => {
        const annotation = this.props.annotationsCache.annotations.byId[
            unifiedId
        ]
        if (!annotation.localId) {
            return
        }
        return (
            <PageNotesCopyPaster
                copyPaster={this.props.copyPaster}
                annotationUrls={[annotation.localId]}
                normalizedPageUrls={[normalizeUrl(this.state.fullPageUrl)]}
            />
        )
    }

    private renderListPickerForAnnotation = (
        instanceLocation: AnnotationCardInstanceLocation,
    ) => (
        unifiedId: UnifiedAnnotation['unifiedId'],
        closePicker: () => void,
    ) => {
        const annotation = this.props.annotationsCache.annotations.byId[
            unifiedId
        ]
        return (
            <CollectionPicker
                {...this.getSpacePickerProps({
                    annotation,
                    showExternalConfirmations: true,
                })}
                bgScriptBG={this.props.bgScriptBG}
                closePicker={closePicker}
                onListFocus={(listId: UnifiedList['localId']) => {
                    const unifiedListId: UnifiedList['unifiedId'] = this.props.annotationsCache.getListByLocalId(
                        listId,
                    ).unifiedId

                    this.processEvent('setSelectedList', { unifiedListId })
                    closePicker()
                }}
            />
        )
    }

    private getRemoteIdsForCacheIds = (listIds: string[]): string[] =>
        listIds
            .map(
                (listId) =>
                    this.props.annotationsCache.lists.byId[listId]?.remoteId,
            )
            .filter((listId) => listId != null)

    private renderShareMenuForAnnotation = () => (
        unifiedId: UnifiedAnnotation['unifiedId'],
    ) => {
        const annotation = this.props.annotationsCache.annotations.byId[
            unifiedId
        ]
        if (!annotation.localId) {
            return
        }
        return (
            <SingleNoteShareMenu
                getRemoteListIdForLocalId={(localListId) =>
                    this.props.annotationsCache.getListByLocalId(localListId)
                        ?.remoteId ?? null
                }
                isShared={[
                    AnnotationPrivacyLevels.SHARED,
                    AnnotationPrivacyLevels.SHARED_PROTECTED,
                ].includes(annotation.privacyLevel)}
                shareImmediately={this.state.immediatelyShareNotes}
                contentSharingBG={this.props.contentSharingBG}
                annotationData={annotation}
                analyticsBG={this.props.analyticsBG}
                annotationsBG={this.props.annotationsBG}
                copyLink={(link) => this.processEvent('copyNoteLink', { link })}
                annotationUrl={annotation.localId}
                postShareHook={(state, opts) =>
                    this.processEvent('updateAnnotationShareInfo', {
                        privacyLevel: state.privacyLevel,
                        unifiedAnnotationId: annotation.unifiedId,
                        keepListsIfUnsharing: opts?.keepListsIfUnsharing,
                    })
                }
                syncSettingsBG={this.props.syncSettingsBG}
                spacePickerProps={this.getSpacePickerProps({
                    annotation,
                })}
                showLink={
                    [
                        AnnotationPrivacyLevels.SHARED,
                        AnnotationPrivacyLevels.SHARED_PROTECTED,
                    ].includes(annotation.privacyLevel) ||
                    this.getRemoteIdsForCacheIds(annotation.unifiedListIds)
                        .length !== null
                }
            />
        )
    }

    protected renderModals() {
        const {
            confirmPrivatizeNoteArgs,
            confirmSelectNoteSpaceArgs,
            firstTimeSharingPageLink,
        } = this.state

        return (
            <>
                {confirmPrivatizeNoteArgs && (
                    <ConfirmModal
                        isShown
                        ignoreReactPortal={
                            this.props.sidebarContext !== 'dashboard'
                        }
                        onClose={() =>
                            this.processEvent(
                                'setPrivatizeNoteConfirmArgs',
                                null,
                            )
                        }
                    >
                        <ConfirmDialog
                            titleText={PRIVATIZE_ANNOT_MSG}
                            negativeLabel={PRIVATIZE_ANNOT_NEGATIVE_LABEL}
                            affirmativeLabel={PRIVATIZE_ANNOT_AFFIRM_LABEL}
                            handleConfirmation={(affirmative) => () =>
                                this.processEvent('editAnnotation', {
                                    ...confirmPrivatizeNoteArgs,
                                    keepListsIfUnsharing: !affirmative,
                                })}
                        />
                    </ConfirmModal>
                )}
                {confirmSelectNoteSpaceArgs && (
                    <ConfirmModal
                        isShown
                        ignoreReactPortal={
                            this.props.sidebarContext !== 'dashboard'
                        }
                        onClose={() =>
                            this.processEvent(
                                'setSelectNoteSpaceConfirmArgs',
                                null,
                            )
                        }
                    >
                        <ConfirmDialog
                            titleText={SELECT_SPACE_ANNOT_MSG}
                            subTitleText={SELECT_SPACE_ANNOT_SUBTITLE}
                            affirmativeLabel={SELECT_SPACE_AFFIRM_LABEL}
                            negativeLabel={SELECT_SPACE_NEGATIVE_LABEL}
                            handleConfirmation={(affirmative) => () =>
                                this.processEvent('updateListsForAnnotation', {
                                    ...confirmSelectNoteSpaceArgs,
                                    options: { protectAnnotation: affirmative },
                                })}
                        />
                    </ConfirmModal>
                )}
                {firstTimeSharingPageLink && (
                    <ConfirmModal
                        isShown
                        ignoreReactPortal={
                            this.props.sidebarContext !== 'dashboard'
                        }
                        onClose={() =>
                            this.processEvent(
                                'setSharingTutorialVisibility',
                                null,
                            )
                        }
                        message={' 🎉 Your first time sharing something!'}
                        submessage="Learn the basics of sharing & collaborating"
                    >
                        <OnboardingVideo
                            src="https://share.descript.com/embed/6OLjZqSa4JK"
                            frameBorder="0"
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </ConfirmModal>
                )}
            </>
        )
    }

    private renderAICounter = (position) => (
        <AICounterIndicator
            position={position}
            syncSettingsBG={this.props.syncSettingsBG}
            isTrial={this.state.isTrial}
            signupDate={this.state.signupDate}
        />
    )

    protected renderTopBanner() {
        return null
    }

    private renderTopSideBar() {
        if (this.props.skipTopBarRender) {
            return null
        }

        return (
            <TopBarActionBtns
                width={this.state.sidebarWidth}
                sidebarContext={this.props.sidebarContext}
            >
                <TooltipBox
                    tooltipText={
                        <TooltipContent>
                            Close{' '}
                            <KeyboardShortcuts size="small" keys={['Esc']} />
                        </TooltipContent>
                    }
                    placement="left"
                >
                    <IconBoundary>
                        <Icon
                            filePath={icons.arrowRight}
                            height="20px"
                            width="16px"
                            onClick={() => this.hideSidebar()}
                        />
                    </IconBoundary>
                </TooltipBox>
            </TopBarActionBtns>
        )
    }

    renderTopBar() {
        return (
            <>
                <TopBarActionBtns
                    width={this.state.sidebarWidth}
                    sidebarContext={this.props.sidebarContext}
                >
                    {this.state.isLocked ? (
                        <TooltipBox
                            tooltipText="Unlock sidebar"
                            placement="bottom"
                        >
                            <Icon
                                filePath={icons.arrowRight}
                                heightAndWidth="26px"
                                onClick={this.toggleSidebarLock}
                            />
                        </TooltipBox>
                    ) : (
                        <TooltipBox
                            tooltipText="Lock sidebar open"
                            placement="bottom"
                        >
                            <Icon
                                filePath={icons.arrowLeft}
                                heightAndWidth="26px"
                                onClick={this.toggleSidebarLock}
                            />
                        </TooltipBox>
                    )}
                    {!this.state.isWidthLocked ? (
                        <TooltipBox
                            tooltipText="Adjust Page Width"
                            placement="bottom"
                        >
                            <Icon
                                filePath={icons.compress}
                                heightAndWidth="26px"
                                onClick={() => this.toggleSidebarWidthLock()}
                            />
                        </TooltipBox>
                    ) : (
                        <TooltipBox
                            tooltipText="Full page width"
                            placement="bottom"
                        >
                            <Icon
                                filePath={icons.expand}
                                heightAndWidth="26px"
                                onClick={() => this.toggleSidebarWidthLock()}
                            />
                        </TooltipBox>
                    )}
                    <TooltipBox tooltipText="Close (ESC)" placement="bottom">
                        <Icon
                            filePath={icons.removeX}
                            heightAndWidth="22px"
                            onClick={() => this.hideSidebar()}
                            padding={'5px'}
                        />
                    </TooltipBox>
                </TopBarActionBtns>
            </>
        )
    }

    render() {
        let playerId: string | undefined = undefined
        if (
            this.state.fullPageUrl &&
            this.props.sidebarContext === 'dashboard'
        ) {
            const normalizedUrl = normalizeUrl(
                this.state.fullPageUrl ?? undefined,
            )
            playerId = getBlockContentYoutubePlayerId(normalizedUrl)
        }

        if (!this.state.fullPageUrl) {
            return null
        }

        const style = {
            height: '100%',
            position: 'relative',
            right: '0px',
            left: 'unset',
            zIndex: 3,
        } as const

        return (
            <ThemeProvider theme={this.props.theme}>
                <GlobalStyle
                    sidebarWidth={this.state.sidebarWidth}
                    sidebarContext={this.props.sidebarContext}
                />
                <ContainerStyled
                    id={'annotationSidebarContainer'}
                    sidebarContext={this.props.sidebarContext}
                    isShown={this.state.showState}
                    rightPosition={
                        this.state.sidebarRightBorderPosition != null &&
                        this.state.sidebarRightBorderPosition
                    }
                >
                    <Rnd
                        style={style}
                        default={{
                            x: 0,
                            y: 0,
                            width: this.state.sidebarWidth
                                ? this.state.sidebarWidth
                                : SIDEBAR_WIDTH_STORAGE_KEY.replace('px', ''),
                            height: 'auto',
                        }}
                        resizeHandleWrapperClass={'sidebarResizeHandle'}
                        className="sidebar-draggable"
                        resizeGrid={[1, 0]}
                        dragAxis={'none'}
                        minWidth={
                            parseFloat(
                                SIDEBAR_WIDTH_STORAGE_KEY.replace('px', ''),
                            ) -
                            40 +
                            'px'
                        }
                        maxWidth={'1000px'}
                        disableDragging={true}
                        enableResizing={{
                            top: false,
                            right: false,
                            bottom: false,
                            left: true,
                            topRight: false,
                            bottomRight: false,
                            bottomLeft: false,
                            topLeft: false,
                        }}
                    >
                        <AnnotationsSidebar
                            {...this.state}
                            imageSupport={this.props.imageSupport}
                            bgScriptBG={this.props.bgScriptBG}
                            initGetReplyEditProps={(sharedListReference) => (
                                replyReference,
                                annotationReference,
                            ) => ({
                                imageSupport: this.props.imageSupport,
                                isDeleting: this.state.replyDeleteStates[
                                    replyReference.id
                                ]?.isDeleting,
                                isEditing: this.state.replyEditStates[
                                    replyReference.id
                                ]?.isEditing,
                                isHovering: this.state.replyHoverStates[
                                    replyReference.id
                                ]?.isHovering,
                                isOwner:
                                    this.state.conversations[
                                        (this
                                            .logic as SidebarContainerLogic).buildConversationId(
                                            annotationReference.id,
                                            sharedListReference,
                                        )
                                    ].replies.find(
                                        (reply) =>
                                            reply.reference.id ===
                                            replyReference.id,
                                    )?.userReference?.id ===
                                    this.state.currentUserReference?.id,
                                comment:
                                    this.state.replyEditStates[
                                        replyReference.id
                                    ]?.text ?? '',
                                setAnnotationDeleting: (isDeleting) => (
                                    event,
                                ) =>
                                    this.processEvent(
                                        'setReplyToAnnotationDeleting',
                                        {
                                            isDeleting,
                                            replyReference,
                                        },
                                    ),
                                setAnnotationEditing: (isEditing) => (event) =>
                                    this.processEvent(
                                        'setReplyToAnnotationEditing',
                                        {
                                            isEditing,
                                            replyReference,
                                        },
                                    ),
                                setAnnotationHovering: (isHovering) => (
                                    event,
                                ) => {
                                    this.processEvent(
                                        'setReplyToAnnotationHovering',
                                        {
                                            isHovering,
                                            replyReference,
                                        },
                                    )
                                },
                                onCommentChange: (comment) =>
                                    this.processEvent('editReplyToAnnotation', {
                                        replyText: comment,
                                        replyReference,
                                    }),
                                onDeleteConfim: () =>
                                    this.processEvent(
                                        'confirmDeleteReplyToAnnotation',
                                        {
                                            replyReference,
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onEditConfirm: () => () =>
                                    this.processEvent(
                                        'confirmEditReplyToAnnotation',
                                        {
                                            replyReference,
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onEditCancel: () =>
                                    this.processEvent(
                                        'setReplyToAnnotationEditing',
                                        {
                                            isEditing: false,
                                            replyReference,
                                        },
                                    ),
                            })}
                            events={this.props.events}
                            youtubeTranscriptSummary={
                                this.state.youtubeTranscriptSummary
                            }
                            setSpacePickerAnnotationInstance={(state) =>
                                this.processEvent(
                                    'setSpacePickerAnnotationInstance',
                                    { state },
                                )
                            }
                            selectedListForShareMenu={
                                this.state.selectedListForShareMenu
                            }
                            setShareMenuAnnotationInstance={(instanceId) =>
                                this.processEvent(
                                    'setShareMenuAnnotationInstanceId',
                                    { instanceId },
                                )
                            }
                            setCopyPasterAnnotationInstance={(instanceId) =>
                                this.processEvent(
                                    'setCopyPasterAnnotationInstanceId',
                                    { instanceId },
                                )
                            }
                            hasFeedActivity={this.props.hasFeedActivity}
                            clickFeedActivityIndicator={() =>
                                this.processEvent('markFeedAsRead', null)
                            }
                            clickCreatePageLinkBtn={() => {
                                this.processEvent('createPageLink', null)
                                this.processEvent(
                                    'setSharingTutorialVisibility',
                                    null,
                                )
                            }}
                            showSharePageTooltip={
                                this.state.showSharePageTooltip
                            }
                            selectedListId={this.state.selectedListId}
                            currentUser={this.props.getCurrentUser()}
                            annotationsCache={this.props.annotationsCache}
                            onUnifiedListSelect={(unifiedListId) =>
                                this.processEvent('setSelectedList', {
                                    unifiedListId,
                                })
                            }
                            onLocalListSelect={async (localListId) => {
                                const unifiedList = this.props.annotationsCache.getListByLocalId(
                                    localListId,
                                )
                                if (unifiedList != null) {
                                    await this.processEvent('setSelectedList', {
                                        unifiedListId: unifiedList.unifiedId,
                                    })
                                }
                            }}
                            onResetSpaceSelect={() =>
                                this.processEvent('setSelectedList', {
                                    unifiedListId: null,
                                })
                            }
                            getYoutubePlayer={() =>
                                playerId &&
                                this.props.youtubeService.getPlayerByElementId(
                                    playerId,
                                )
                            }
                            getListDetailsById={this.getListDetailsById}
                            sidebarContext={this.props.sidebarContext}
                            ref={this.sidebarRef}
                            openContextMenuForList={(unifiedListId) =>
                                this.processEvent('openContextMenuForList', {
                                    unifiedListId,
                                })
                            }
                            openPageListMenuForList={() =>
                                this.processEvent(
                                    'openPageListMenuForList',
                                    null,
                                )
                            }
                            openWebUIPage={(unifiedListId) =>
                                this.processEvent('openWebUIPageForSpace', {
                                    unifiedListId,
                                })
                            }
                            onMenuItemClick={({ sortingFn }) =>
                                this.processEvent('sortAnnotations', {
                                    sortingFn,
                                })
                            }
                            getLocalAnnotationIds={() =>
                                Object.values(this.state.annotations.byId).map(
                                    (annot) => annot.localId,
                                )
                            }
                            normalizedPageUrls={[
                                normalizeUrl(this.state.fullPageUrl),
                            ]}
                            normalizedPageUrl={normalizeUrl(
                                this.state.fullPageUrl,
                            )}
                            copyPaster={this.props.copyPaster}
                            contentSharing={this.props.contentSharingBG}
                            annotationsShareAll={this.props.annotationsBG}
                            copyPageLink={(link) => {
                                this.processEvent('copyNoteLink', { link })
                            }}
                            queryAIwithPrompt={(prompt) => {
                                this.processEvent('queryAIwithPrompt', {
                                    prompt,
                                })
                            }}
                            saveAIPrompt={(prompt) => {
                                this.processEvent('saveAIPrompt', { prompt })
                            }}
                            removeAISuggestion={(suggestion) => {
                                this.processEvent('removeAISuggestion', {
                                    suggestion,
                                })
                            }}
                            navigateFocusInList={(direction) => {
                                this.processEvent('navigateFocusInList', {
                                    direction,
                                })
                            }}
                            toggleAISuggestionsDropDown={() =>
                                this.processEvent(
                                    'toggleAISuggestionsDropDown',
                                    null,
                                )
                            }
                            selectAISuggestion={(suggestion) => {
                                this.processEvent('selectAISuggestion', {
                                    suggestion,
                                })
                            }}
                            setQueryMode={(mode) => {
                                this.processEvent('setQueryMode', {
                                    mode,
                                })
                            }}
                            removeSelectedTextAIPreview={() => {
                                this.processEvent(
                                    'removeSelectedTextAIPreview',
                                    null,
                                )
                            }}
                            updateListName={async (
                                unifiedListId,
                                localId,
                                oldName,
                                newName,
                            ) => {
                                this.processEvent('editListName', {
                                    unifiedListId: unifiedListId,
                                    localId: localId,
                                    newName,
                                    oldName: oldName,
                                })
                                await this.props.customListsBG.updateListName({
                                    id: localId,
                                    oldName: oldName,
                                    newName: newName,
                                })
                            }}
                            updatePromptState={(prompt) => {
                                this.processEvent('updatePromptState', {
                                    prompt,
                                })
                            }}
                            postBulkShareHook={(shareInfo) =>
                                this.processEvent(
                                    'updateAllAnnotationsShareInfo',
                                    shareInfo,
                                )
                            }
                            onCopyBtnClick={() => this.handleCopyAllNotesClick}
                            onShareAllNotesClick={() =>
                                this.handleCopyAllNotesClick
                            }
                            createNewNoteFromAISummary={(summary) => {
                                this.processEvent(
                                    'createNewNoteFromAISummary',
                                    { comment: summary },
                                )
                            }}
                            sharingAccess={this.state.annotationSharingAccess}
                            needsWaypoint={!this.state.noResults}
                            appendLoader={
                                this.state.secondarySearchState === 'running'
                            }
                            setActiveAnnotation={(unifiedAnnotationId) => () =>
                                this.processEvent('setActiveAnnotation', {
                                    unifiedAnnotationId,
                                })}
                            setPopoutsActive={(isActive) => {
                                this.processEvent('setPopoutsActive', isActive)
                            }}
                            annotationCreateProps={this.getCreateProps()}
                            bindAnnotationFooterEventProps={(
                                annotation,
                                followedListId,
                            ) =>
                                this.bindAnnotationFooterEventProps(
                                    annotation,
                                    followedListId,
                                )
                            }
                            bindAnnotationEditProps={
                                this.bindAnnotationEditProps
                            }
                            handleScrollPagination={() =>
                                this.processEvent('paginateSearch', null)
                            }
                            isDataLoading={
                                this.state.remoteAnnotationsLoadState ===
                                    'running' ||
                                this.state.loadState === 'running' ||
                                this.state.cacheLoadState === 'running'
                            }
                            theme={this.props.theme}
                            renderAICounter={(position) =>
                                this.renderAICounter(position)
                            }
                            renderCopyPasterForAnnotation={
                                this.renderCopyPasterManagerForAnnotation
                            }
                            renderShareMenuForAnnotation={
                                this.renderShareMenuForAnnotation
                            }
                            renderContextMenuForList={(listData) => (
                                <SpaceContextMenu
                                    isCreator={
                                        listData.creator.id ===
                                        this.state.currentUserReference.id
                                    }
                                    contentSharingBG={
                                        this.props.contentSharingBG
                                    }
                                    spacesBG={this.props.customListsBG}
                                    listData={listData}
                                    disableWriteOps={
                                        this.state.hasListDataBeenManuallyPulled
                                    }
                                    onConfirmSpaceNameEdit={(newName) => {
                                        this.processEvent('editListName', {
                                            unifiedListId: listData.unifiedId,
                                            localId: listData.localId,
                                            newName,
                                            oldName: listData.name,
                                        })
                                    }}
                                    onSpaceShare={(
                                        remoteListId,
                                        annotationLocalToRemoteIdsDict,
                                    ) => {
                                        this.processEvent('shareList', {
                                            remoteListId,
                                            annotationLocalToRemoteIdsDict,
                                            unifiedListId: listData.unifiedId,
                                        })
                                        this.processEvent(
                                            'setSharingTutorialVisibility',
                                            null,
                                        )
                                    }}
                                    onDeleteSpaceConfirm={() =>
                                        this.processEvent('deleteList', {
                                            unifiedListId: listData.unifiedId,
                                        })
                                    }
                                    analyticsBG={this.props.analyticsBG}
                                    currentUser={this.props.getCurrentUser().id}
                                />
                            )}
                            renderPageLinkMenuForList={(listData) => (
                                <PageLinkMenu
                                    contentSharingBG={
                                        this.props.contentSharingBG
                                    }
                                    spacesBG={this.props.customListsBG}
                                    listData={listData}
                                    disableWriteOps={
                                        this.state.hasListDataBeenManuallyPulled
                                    }
                                    onSpaceShare={() => {
                                        this.processEvent('createPageLink', {
                                            forceCreate: true,
                                        })
                                        this.processEvent(
                                            'setSharingTutorialVisibility',
                                            null,
                                        )
                                    }}
                                    pageLinkCreateState={
                                        this.state.pageLinkCreateState
                                    }
                                    showSpacesTab={() => {
                                        this.processEvent(
                                            'openPageListMenuForList',
                                            null,
                                        )
                                        this.processEvent(
                                            'setActiveSidebarTab',
                                            { tab: 'spaces' },
                                        )
                                        this.processEvent('setSelectedList', {
                                            unifiedListId: null,
                                        })
                                    }}
                                    analyticsBG={this.props.analyticsBG}
                                />
                            )}
                            activeShareMenuNoteId={
                                this.state.activeShareMenuNoteId
                            }
                            annotationInstanceRefs={this.annotationInstanceRefs}
                            renderListsPickerForAnnotation={
                                this.renderListPickerForAnnotation
                            }
                            setActiveTab={(tab) => (event) =>
                                this.processEvent('setActiveSidebarTab', {
                                    tab,
                                })}
                            expandFollowedListNotes={(unifiedListId) =>
                                this.processEvent('expandListAnnotations', {
                                    unifiedListId,
                                })
                            }
                            bindSharedAnnotationEventHandlers={(
                                annotationReference,
                                sharedListReference,
                            ) => ({
                                onReplyBtnClick: () =>
                                    this.processEvent(
                                        'toggleAnnotationReplies',
                                        {
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onNewReplyInitiate: () =>
                                    this.processEvent(
                                        'initiateNewReplyToAnnotation',
                                        {
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onNewReplyCancel: () =>
                                    this.processEvent(
                                        'cancelNewReplyToAnnotation',
                                        {
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onNewReplyConfirm: () =>
                                    this.processEvent(
                                        'confirmNewReplyToAnnotation',
                                        {
                                            annotationReference,
                                            sharedListReference,
                                        },
                                    ),
                                onNewReplyEdit: ({ content }) =>
                                    this.processEvent(
                                        'editNewReplyToAnnotation',
                                        {
                                            annotationReference,
                                            sharedListReference,
                                            content,
                                        },
                                    ),
                            })}
                            setSpaceTitleEditValue={(value) =>
                                this.processEvent('setSpaceTitleEditValue', {
                                    value,
                                })
                            }
                            spaceTitleEditValue={this.state.spaceTitleEditValue}
                        />
                    </Rnd>
                </ContainerStyled>
                {this.renderModals()}
            </ThemeProvider>
        )
    }
}

const GlobalStyle = createGlobalStyle<{
    sidebarWidth: string
    sidebarContext: string
}>`

    & * {
        font-family: 'Satoshi'
    }

    .sidebar-draggable {
        height: 100% !important;
    }

    .sidebarResizeHandle {
    width: 4px;
    height: 100vh;
    position: absolute;
    top: ${(props) => (props.sidebarContext === 'dashboard' ? '40px' : '0px')};

        &:hover {
        background: #5671cf30;
    }

    #outerContainer {
        width: ${(props) => props.sidebarWidth};
    }

    #outerContainer {
        width: ${(props) => props.sidebarWidth};
    }
`

const OnboardingVideo = styled.iframe`
    width: 800px;
    height: 450px;
    border: 1px solid ${(props) => props.theme.colors.greyScale1};
    border-radius: 20px;
`

const TooltipContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    grid-gap: 5px;
`

const ShareMenuWrapper = styled.div`
    position: absolute;
    right: 320px;
    z-index: 10000;
`

const PickerWrapper = styled.div`
    position: sticky;
    z-index: 5;
`

const ContainerStyled = styled.div<{
    sidebarContext: string
    isShown: string
    theme
    rightPosition?: number
}>`
    height: 100vh;
    overflow-x: visible;
    position: ${(props) =>
        props.sidebarContext === 'dashboard' ? 'sticky' : 'fixed'};
    top: 0px;
    z-index: ${(props) =>
        props.sidebarContext === 'dashboard'
            ? '3500'
            : '2147483646'}; /* This is to combat pages setting high values on certain elements under the sidebar */
                    background: ${(props) =>
                        props.theme.variant === 'dark'
                            ? props.theme.colors.black + 'eb'
                            : props.theme.colors.black + 'c9'};
    backdrop-filter: blur(30px);
    border-left: 1px solid ${(props) => props.theme.colors.greyScale2};
    font-family: 'Satoshi', sans-serif;
    font-feature-settings: 'pnum' on, 'lnum' on, 'case' on, 'ss03' on, 'ss04' on, 'liga' off;
    box-sizing: content-box;
    right: ${(props) =>
        props.rightPosition ? props.rightPosition + 'px' : TOOLTIP_WIDTH};

    &:: -webkit-scrollbar {
        display: none;
    }
    transition: all 0.2s cubic-bezier(0.3, 0.35, 0.14, 0.8);

    ${(props) =>
        props.isShown === 'hidden' &&
        css`
            right: -600px;
            opacity: 0;
            position: fixed;
        `}

    ${(props) =>
        props.isShown === 'visible' &&
        css`
            opacity: 1;
        `}

    ${(props) =>
        props.sidebarContext === 'dashboard' &&
        props.isShown === 'visible' &&
        css`
            padding-right: 0px;
            right: 0px;
        `}


    ${(props) =>
        props.theme.variant === 'light' &&
        css`
            box-shadow: ${(props) => props.theme.borderStyles.boxShadowLeft};
            border-left: 1px solid
                ${(props) =>
                    props.theme.borderStyles.borderLineColorBigElements};
        `};


    scrollbar-width: none;
`

const TopBarActionBtns = styled.div<{ width: string; sidebarContext: string }>`
    display: flex;
    grid-gap: 30px;
    align-items: center;
    flex-direction: column;
    position: absolute;
    top: 12px;
    margin-left: 8px;
    z-index: 2;

    ${(props) =>
        props.sidebarContext === 'dashboard' &&
        css`
            top: 16px;
            margin-left: -18px;
        `};
`

const IconBoundary = styled.div`
    border: 1px solid ${(props) => props.theme.colors.greyScale3};
    border-radius: 5px;
    height: fit-content;
    width: fit-content;
    background: ${(props) => props.theme.colors.black};
`

const BottomArea = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    grid-gap: 8px;
`

const TopArea = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    grid-gap: 8px;
`

const FooterArea = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    grid-gap: 8px;
    position: absolute;
    bottom: 20px;
    margin-left: 8px;
    z-index: 2;
`
