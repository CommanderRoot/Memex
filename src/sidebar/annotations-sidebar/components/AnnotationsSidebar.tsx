import * as React from 'react'
import Waypoint from 'react-waypoint'
import styled, { css } from 'styled-components'
import onClickOutside from 'react-onclickoutside'
import Icon from '@worldbrain/memex-common/lib/common-ui/components/icon'
import { ConversationReplies } from '@worldbrain/memex-common/lib/content-conversations/ui/components/annotations-in-page'
import type { SharedAnnotationReference } from '@worldbrain/memex-common/lib/content-sharing/types'
import type { NewReplyEventHandlers } from '@worldbrain/memex-common/lib/content-conversations/ui/components/new-reply'
import { ButtonTooltip } from 'src/common-ui/components'
import LoadingIndicator from 'src/common-ui/components/LoadingIndicator'
import AnnotationCreate, {
    Props as AnnotationCreateProps,
} from 'src/annotations/components/AnnotationCreate'
import AnnotationEditable from 'src/annotations/components/HoverControlledAnnotationEditable'
import TextInputControlled from 'src/common-ui/components/TextInputControlled'
import { Flex } from 'src/common-ui/components/design-library/Flex'
import type { Annotation } from 'src/annotations/types'
import CongratsMessage from 'src/annotations/components/parts/CongratsMessage'
import type { AnnotationMode, SidebarTheme } from '../types'
import { AnnotationFooterEventProps } from 'src/annotations/components/AnnotationFooter'
import {
    AnnotationEditGeneralProps,
    AnnotationEditEventProps,
} from 'src/annotations/components/AnnotationEdit'
import type { AnnotationSharingAccess } from 'src/content-sharing/ui/types'
import type { SidebarContainerState } from '../containers/types'
import { ExternalLink } from 'src/common-ui/components/design-library/actions/ExternalLink'
import Margin from 'src/dashboard-refactor/components/Margin'
import { SortingDropdownMenuBtn } from '../components/SortingDropdownMenu'
import * as icons from 'src/common-ui/components/design-library/icons'
import AllNotesShareMenu from 'src/overview/sharing/AllNotesShareMenu'
import { PageNotesCopyPaster } from 'src/copy-paster'
import { HoverBox } from 'src/common-ui/components/design-library/HoverBox'
import { ClickAway } from 'src/util/click-away-wrapper'
import { AnnotationSharingStates } from 'src/content-sharing/background/types'
import { getLocalStorage, setLocalStorage } from 'src/util/storage'
import { ContentSharingInterface } from 'src/content-sharing/background/types'

const SHOW_ISOLATED_VIEW_KEY = `show-isolated-view-notif`
export interface AnnotationsSidebarProps
    extends Omit<SidebarContainerState, 'annotationModes'> {
    annotationModes: { [url: string]: AnnotationMode }

    setActiveAnnotationUrl?: (url: string) => React.MouseEventHandler
    getListNameById: (id: number) => string

    bindSharedAnnotationEventHandlers: (
        sharedAnnotationReference: SharedAnnotationReference,
    ) => {
        onReplyBtnClick: React.MouseEventHandler
    } & NewReplyEventHandlers

    handleScrollPagination: () => void
    needsWaypoint?: boolean
    appendLoader?: boolean

    renderCopyPasterForAnnotation: (id: string) => JSX.Element
    renderTagsPickerForAnnotation: (id: string) => JSX.Element
    renderShareMenuForAnnotation: (id: string) => JSX.Element
    renderListsPickerForAnnotation?: (id: string) => JSX.Element

    expandMyNotes: () => void
    expandSharedSpaces: (listIds: string[]) => void
    expandFollowedListNotes: (listId: string) => void
    toggleIsolatedListView: (listId: string) => void

    onClickOutside: React.MouseEventHandler
    bindAnnotationFooterEventProps: (
        annotation: Annotation,
    ) => AnnotationFooterEventProps & {
        onGoToAnnotation?: React.MouseEventHandler
    }
    bindAnnotationEditProps: (
        annotation: Annotation,
    ) => AnnotationEditGeneralProps & AnnotationEditEventProps
    annotationCreateProps: AnnotationCreateProps

    sharingAccess: AnnotationSharingAccess
    isSearchLoading: boolean
    isAnnotationCreateShown: boolean
    annotations: Annotation[]
    theme: Partial<SidebarTheme>
    openCollectionPage: (remoteListId: string) => void
    onShareAllNotesClick: () => void
    onCopyBtnClick: () => void
    onMenuItemClick: (sortingFn) => void
    copyPaster: any
    onClickOutsideCopyPaster: () => void
    normalizedPageUrls: string[]
    normalizedPageUrl?: string
    annotationUrls: () => void
    contentSharing: ContentSharingInterface
    annotationsShareAll: any
    copyPageLink: any
    postBulkShareHook: (shareState: AnnotationSharingStates) => void
    sidebarContext?: string
}

interface AnnotationsSidebarState {
    searchText?: string
    isolatedView?: string | null // if null show default view
    showIsolatedViewNotif?: boolean // if null show default view
    isMarkdownHelpShown?: boolean
    showAllNotesCopyPaster?: boolean
    showAllNotesShareMenu?: boolean
}

class AnnotationsSidebar extends React.Component<
    AnnotationsSidebarProps,
    AnnotationsSidebarState
> {
    private annotationCreateRef // TODO: Figure out how to properly type refs to onClickOutside HOCs
    private annotationEditRef

    state = {
        searchText: '',
        showIsolatedViewNotif: false,
        isMarkdownHelpShown: false,
        showAllNotesCopyPaster: false,
        showAllNotesShareMenu: false,
    }

    async componentDidMount() {
        document.addEventListener('keydown', this.onKeydown, false)
        //setLocalStorage(SHOW_ISOLATED_VIEW_KEY, true)
        const isolatedViewNotifVisible = await getLocalStorage(
            SHOW_ISOLATED_VIEW_KEY,
        )

        this.setState({
            showIsolatedViewNotif: isolatedViewNotifVisible,
        })
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeydown, false)
    }

    focusCreateForm = () => this.annotationCreateRef?.getInstance()?.focus()

    private onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.props.onClickOutside(e as any)
        }
    }

    private searchEnterHandler = {
        test: (e) => e.key === 'Enter',
        handle: () => undefined,
    }

    private handleSearchChange = (searchText) => {
        this.setState({ searchText })
    }

    private handleSearchClear = () => {
        this.setState({ searchText: '' })
    }

    // NOTE: Currently not used
    private renderSearchSection() {
        return (
            <TopSectionStyled>
                <TopBarStyled>
                    <Flex>
                        <ButtonStyled>
                            {' '}
                            <SearchIcon />{' '}
                        </ButtonStyled>
                        <SearchInputStyled
                            type="input"
                            name="query"
                            autoComplete="off"
                            placeholder="Search Annotations"
                            onChange={this.handleSearchChange}
                            defaultValue={this.state.searchText}
                            specialHandlers={[this.searchEnterHandler]}
                        />
                        {this.state.searchText !== '' && (
                            <CloseButtonStyled onClick={this.handleSearchClear}>
                                <CloseIconStyled />
                                Clear search
                            </CloseButtonStyled>
                        )}
                    </Flex>
                </TopBarStyled>
            </TopSectionStyled>
        )
    }

    handleClickOutside: React.MouseEventHandler = (e) => {
        if (this.props.onClickOutside) {
            return this.props.onClickOutside(e)
        }
    }
    private getListsForAnnotationCreate = (
        followedLists,
        isolatedView: string,
        annotationCreateLists: string[],
    ) => {
        // returns lists for AnnotationCreate including isolated view if enabled
        if (isolatedView) {
            const isolatedList = followedLists.byId[isolatedView]
            if (
                isolatedList.isContributable &&
                !annotationCreateLists.includes(isolatedList.name)
            ) {
                const listsToCreate = [
                    ...annotationCreateLists,
                    isolatedList.name,
                ]

                return listsToCreate
            }
        }
        return annotationCreateLists
    }

    private renderNewAnnotation(context?: string) {
        return (
            <NewAnnotationSection context={context}>
                <AnnotationCreate
                    {...this.props.annotationCreateProps}
                    ref={this.annotationCreateRef}
                    autoFocus
                />
            </NewAnnotationSection>
        )
    }

    private renderLoader = (key?: string) => (
        <LoadingIndicatorContainer key={key}>
            <LoadingIndicatorStyled />
        </LoadingIndicatorContainer>
    )

    private renderFollowedListNotes(listId: string) {
        const list = this.props.followedLists.byId[listId]
        if (!list.isExpanded || list.annotationsLoadState === 'pristine') {
            return null
        }

        if (list.annotationsLoadState === 'running') {
            return this.renderLoader()
        }

        if (list.annotationsLoadState === 'error') {
            return (
                <FollowedListsMsgContainer>
                    <FollowedListsMsgHead>
                        Something went wrong
                    </FollowedListsMsgHead>
                    <FollowedListsMsg>
                        Reload the page and if the problem persists{' '}
                        <ExternalLink
                            label="contact support"
                            href="mailto:support@worldbrain.io"
                        />
                        .
                    </FollowedListsMsg>
                </FollowedListsMsgContainer>
            )
        }

        const annotationsData = list.sharedAnnotationReferences
            .map((ref) => this.props.followedAnnotations[ref.id])
            .filter((a) => !!a)

        if (!annotationsData.length) {
            return 'No notes exist in this list for this page'
        }

        return (
            <FollowedNotesContainer>
                {annotationsData.map((data) => {
                    const conversation = this.props.conversations[data.id]
                    const sharedAnnotationRef: SharedAnnotationReference = {
                        id: data.id,
                        type: 'shared-annotation-reference',
                    }
                    const eventHandlers = this.props.bindSharedAnnotationEventHandlers(
                        sharedAnnotationRef,
                    )
                    return (
                        <React.Fragment key={data.id}>
                            <AnnotationEditable
                                isShared
                                isBulkShareProtected
                                url={data.id}
                                body={data.body}
                                comment={data.comment}
                                lastEdited={data.updatedWhen}
                                createdWhen={data.createdWhen}
                                creatorDependencies={
                                    this.props.users[data.creatorId]
                                }
                                isActive={
                                    this.props.activeAnnotationUrl === data.id
                                }
                                onReplyBtnClick={eventHandlers.onReplyBtnClick}
                                onHighlightClick={this.props.setActiveAnnotationUrl(
                                    data.id,
                                )}
                                isClickable={
                                    this.props.theme.canClickAnnotations &&
                                    data.body?.length > 0
                                }
                                repliesLoadingState={
                                    list.conversationsLoadState
                                }
                                hasReplies={
                                    conversation?.thread != null ||
                                    conversation?.replies.length > 0
                                }
                                getListNameById={this.props.getListNameById}
                            />
                            <ConversationReplies
                                {...eventHandlers}
                                conversation={conversation}
                                annotation={{
                                    body: data.body,
                                    linkId: data.id,
                                    comment: data.comment,
                                    createdWhen: data.createdWhen,
                                    reference: sharedAnnotationRef,
                                }}
                            />
                        </React.Fragment>
                    )
                })}
            </FollowedNotesContainer>
        )
    }

    private renderSharedListNotes(
        listId,
        dropdownIcon,
        sharedListStyleContext,
        onClickTitle,
        buttonOpenIsolated,
        renderNotes,
    ) {
        const { followedListLoadState, followedLists } = this.props
        const listData = followedLists.byId[listId]

        return (
            <FollowedListNotesContainer bottom="10px" key={listId}>
                {/* <React.Fragment key={listId}> */}
                <FollowedListRow
                    onClick={onClickTitle}
                    bottom="5px"
                    title={listData.name}
                    context={sharedListStyleContext}
                >
                    {dropdownIcon}
                    <FollowedListTitleContainer
                        context={sharedListStyleContext}
                    >
                        <FollowedListTitle
                            context={sharedListStyleContext}
                            onClick={onClickTitle}
                        >
                            {listData.name}
                        </FollowedListTitle>
                        <FollowedListNoteCount left="10px" right="15px">
                            {listData.sharedAnnotationReferences.length}
                        </FollowedListNoteCount>
                    </FollowedListTitleContainer>
                    <FollowedListActionItems>
                        {buttonOpenIsolated}
                        <ButtonTooltip
                            tooltipText="Go to collection"
                            position="bottomLeft"
                        >
                            <FollowedListIconContainer
                                onClick={(event) => {
                                    event.stopPropagation()
                                    this.props.openCollectionPage(listId)
                                }}
                            >
                                <FollowedListActionIcon src={icons.goTo} />
                            </FollowedListIconContainer>
                        </ButtonTooltip>
                    </FollowedListActionItems>
                </FollowedListRow>
                {renderNotes}
            </FollowedListNotesContainer>
        )
    }

    private renderSharedListNotesNotIsolated(listId) {
        const { followedLists } = this.props

        const listData = followedLists.byId[listId]

        const dropdownIcon = (
            <FollowedListIconContainer
                onClick={(event) => {
                    event.stopPropagation()
                    this.props.expandFollowedListNotes(listId)
                }}
            >
                <FollowedListDropdownIcon
                    icon="triangle"
                    height="12px"
                    isExpanded={listData.isExpanded}
                    marginLeft="0px"
                />
            </FollowedListIconContainer>
        )
        const sharedListStyleContext = null

        const onClickTitle = (event) => {
            event.stopPropagation()
            this.props.toggleIsolatedListView(listId)
        }

        const buttonOpenIsolated = (
            <ButtonTooltip
                tooltipText="Add Highlights and Notes"
                position="bottom"
            >
                <FollowedListIconContainer onClick={onClickTitle}>
                    <FollowedListActionIcon src={icons.commentAdd} />
                </FollowedListIconContainer>
            </ButtonTooltip>
        )
        const renderNotes = (
            <>
                {listData.isExpanded &&
                    this.renderNewAnnotation('isolatedView')}
                {this.renderFollowedListNotes(listId)}
            </>
        )

        return this.renderSharedListNotes(
            listId,
            dropdownIcon,
            sharedListStyleContext,
            onClickTitle,
            buttonOpenIsolated,
            renderNotes,
        )
    }

    private renderSharedListNotesIsolated(listId) {
        const sharedListStyleContext = 'isolatedView'

        const renderNotes = (
            <>
                {this.renderNewAnnotation('isolatedView')}
                {this.renderFollowedListNotes(listId)}
            </>
        )
        return this.renderSharedListNotes(
            listId,
            null,
            sharedListStyleContext,
            null,
            null,
            renderNotes,
        )
    }

    private renderIsolatedView(listId) {
        const ContributorTooltip = (
            <span>You can add highlights to this page.</span>
        )

        return (
            <FollowedListNotesContainer bottom="10px">
                <IsolatedViewTopBar>
                    <BackButton
                        onClick={(event) => {
                            this.props.toggleIsolatedListView(listId)
                        }}
                    >
                        <BackButtonArrow icon="triangle" height="12px" />{' '}
                        {'Back'}
                    </BackButton>
                    {this.props.followedLists.byId[listId]?.isContributable ? (
                        <ButtonTooltip
                            tooltipText={ContributorTooltip}
                            position="bottomLeft"
                        >
                            <ContributorBadge>
                                <ContributorIcon src={icons.shared} />
                                Contributor
                            </ContributorBadge>
                        </ButtonTooltip>
                    ) : (
                        <p>{'@ Commentor'}</p>
                    )}
                </IsolatedViewTopBar>
                {this.state.showIsolatedViewNotif && (
                    <IsolatedViewTutorial>
                        <IsolatedViewText>
                            While you are in this view, all annotations <br />{' '}
                            and notes you make are added to this space.
                        </IsolatedViewText>
                        <IsolatedViewTutorialClose
                            onClick={() => {
                                this.setState({ showIsolatedViewNotif: false }),
                                    setLocalStorage(
                                        SHOW_ISOLATED_VIEW_KEY,
                                        false,
                                    )
                            }}
                        >
                            <CloseIconStyled background={'white'} />
                        </IsolatedViewTutorialClose>
                    </IsolatedViewTutorial>
                )}
                {this.props.isExpandedSharedSpaces &&
                    (this.props.followedListLoadState === 'running' ? (
                        this.renderLoader()
                    ) : this.props.followedListLoadState === 'error' ? (
                        <FollowedListsMsgContainer>
                            <FollowedListsMsgHead>
                                Something went wrong
                            </FollowedListsMsgHead>
                            <FollowedListsMsg>
                                Reload the page and if the problem persists{' '}
                                <ExternalLink
                                    label="contact
                                    support"
                                    href="mailto:support@worldbrain.io"
                                />
                                .
                            </FollowedListsMsg>
                        </FollowedListsMsgContainer>
                    ) : (
                        <>{this.renderSharedListNotesIsolated(listId)}</>
                    ))}
            </FollowedListNotesContainer>
        )
    }

    private renderSharedNotesByList() {
        const { followedListLoadState, followedLists } = this.props

        // if (!followedLists.allIds.length) {
        //     return null
        // }

        const sharedNotesByList = followedLists.allIds.map((listId) =>
            this.renderSharedListNotesNotIsolated(listId),
        )
        return (
            <FollowedListNotesContainer bottom="10px">
                <FollowedListTitleContainer
                    onClick={() =>
                        this.props.expandSharedSpaces(followedLists.allIds)
                    }
                    left="5px"
                    bottom="5px"
                >
                    <FollowedListSectionTitle>
                        From Shared Spaces
                    </FollowedListSectionTitle>

                    {this.props.followedListLoadState ===
                    'running' ? null : followedLists.allIds.length ? (
                        <FollowedListDropdownIcon
                            icon="triangle"
                            height="12px"
                            isExpanded={this.props.isExpandedSharedSpaces}
                            marginLeft="5px"
                            marginRight="5px"
                        />
                    ) : (
                        <FollowedListNoteCount left="5px" right="15px">
                            0
                        </FollowedListNoteCount>
                    )}
                </FollowedListTitleContainer>
                {this.props.isExpandedSharedSpaces &&
                    (this.props.followedListLoadState === 'running' ? (
                        this.renderLoader()
                    ) : this.props.followedListLoadState === 'error' ? (
                        <FollowedListsMsgContainer>
                            <FollowedListsMsgHead>
                                Something went wrong
                            </FollowedListsMsgHead>
                            <FollowedListsMsg>
                                Reload the page and if the problem persists{' '}
                                <ExternalLink
                                    label="contact
                                    support"
                                    href="mailto:support@worldbrain.io"
                                />
                                .
                            </FollowedListsMsg>
                        </FollowedListsMsgContainer>
                    ) : (
                        sharedNotesByList
                    ))}
            </FollowedListNotesContainer>
        )
    }

    private renderResultsBody() {
        if (this.props.isSearchLoading) {
            return this.renderLoader()
        }
        return this.props.isolatedView ? (
            <AnnotationsSectionStyled>
                {this.renderIsolatedView(this.props.isolatedView)}
            </AnnotationsSectionStyled>
        ) : (
            <React.Fragment>
                <AnnotationsSectionStyled>
                    {this.renderAnnotationsEditable()}
                </AnnotationsSectionStyled>
                <AnnotationsSectionStyled>
                    {this.renderSharedNotesByList()}
                </AnnotationsSectionStyled>
            </React.Fragment>
        )
    }

    private renderCopyPasterManager(annotationUrls) {
        return (
            <HoverBox>
                <PageNotesCopyPaster
                    copyPaster={this.props.copyPaster}
                    annotationUrls={annotationUrls}
                    normalizedPageUrls={this.props.normalizedPageUrls}
                    onClickOutside={() =>
                        this.setState({ showAllNotesCopyPaster: false })
                    }
                />
            </HoverBox>
        )
    }

    private renderAllNotesCopyPaster() {
        if (!this.state.showAllNotesCopyPaster) {
            return null
        }

        const annotUrls = this.props.annotationUrls()
        return (
            <CopyPasterWrapperTopBar>
                {this.renderCopyPasterManager(annotUrls)}
            </CopyPasterWrapperTopBar>
        )
    }

    private renderAllNotesShareMenu() {
        if (!this.state.showAllNotesShareMenu) {
            return null
        }

        return (
            <ShareMenuWrapperTopBar>
                <ClickAway
                    onClickAway={() =>
                        this.setState({ showAllNotesShareMenu: false })
                    }
                >
                    <HoverBox width="340px">
                        <AllNotesShareMenu
                            contentSharingBG={this.props.contentSharing}
                            annotationsBG={this.props.annotationsShareAll}
                            normalizedPageUrl={this.props.normalizedPageUrl}
                            copyLink={async (link) => {
                                this.props.copyPageLink(link)
                            }}
                            postBulkShareHook={(shareInfo) =>
                                this.props.postBulkShareHook(shareInfo)
                            }
                        />
                    </HoverBox>
                </ClickAway>
            </ShareMenuWrapperTopBar>
        )
    }

    private renderAnnotationsEditable() {
        const annots = this.props.annotations.map((annot, i) => {
            const footerDeps = this.props.bindAnnotationFooterEventProps(annot)
            return (
                <>
                    <AnnotationEditable
                        key={i}
                        {...annot}
                        {...this.props}
                        body={annot.body}
                        comment={annot.comment}
                        createdWhen={annot.createdWhen!}
                        isShared={annot.isShared}
                        isBulkShareProtected={annot.isBulkShareProtected}
                        mode={this.props.annotationModes[annot.url]}
                        isActive={this.props.activeAnnotationUrl === annot.url}
                        onHighlightClick={this.props.setActiveAnnotationUrl(
                            annot.url,
                        )}
                        onGoToAnnotation={footerDeps.onGoToAnnotation}
                        annotationEditDependencies={this.props.bindAnnotationEditProps(
                            annot,
                        )}
                        annotationFooterDependencies={footerDeps}
                        isClickable={
                            this.props.theme.canClickAnnotations &&
                            annot.body?.length > 0
                        }
                        ref={(ref) => (this.annotationEditRef = ref)}
                    />
                </>
            )
        })

        if (this.props.needsWaypoint) {
            annots.push(
                <Waypoint
                    key="sidebar-pagination-waypoint"
                    onEnter={this.props.handleScrollPagination}
                />,
            )
        }

        if (this.props.appendLoader) {
            annots.push(this.renderLoader('sidebar-pagination-spinner'))
        }

        if (this.props.showCongratsMessage) {
            annots.push(<CongratsMessage key="sidebar-congrats-msg" />)
        }

        return (
            <FollowedListNotesContainer
                bottom={this.props.isExpanded ? '20px' : '0px'}
            >
                <FollowedListTitleContainerMyNotes left="5px">
                    <MyNotesClickableArea
                        onClick={
                            !this.props.annotations.length
                                ? null
                                : () => this.props.expandMyNotes()
                        }
                    >
                        <FollowedListSectionTitle title={'My Notes'}>
                            {'My Notes'}
                        </FollowedListSectionTitle>
                        {this.props.annotations.length > 0 && (
                            <FollowedListDropdownIcon
                                icon="triangle"
                                height="12px"
                                isExpanded={this.props.isExpanded}
                                marginLeft="5px"
                                marginRight="5px"
                            />
                        )}
                    </MyNotesClickableArea>
                    <TopBarActionBtns>
                        {this.renderAllNotesShareMenu()}
                        {this.renderAllNotesCopyPaster()}
                        <SortingDropdownMenuBtn
                            onMenuItemClick={(sortingFn) =>
                                this.props.onMenuItemClick(sortingFn)
                            }
                        />
                        <ButtonTooltip
                            tooltipText="Copy All Notes"
                            position="bottomSidebar"
                        >
                            <ActionBtn
                                onClick={() =>
                                    this.setState({
                                        showAllNotesCopyPaster: true,
                                    })
                                }
                                isActive={this.state.showAllNotesCopyPaster}
                            >
                                <ActionIcon src={icons.copy} />
                            </ActionBtn>
                        </ButtonTooltip>
                        <ButtonTooltip
                            tooltipText="Share annotated Page"
                            position="bottomRightEdge"
                        >
                            <ActionBtn
                                onClick={() =>
                                    this.setState({
                                        showAllNotesShareMenu: true,
                                    })
                                }
                                isActive={this.state.showAllNotesShareMenu}
                            >
                                <ActionIcon src={icons.link} />
                            </ActionBtn>
                        </ButtonTooltip>
                    </TopBarActionBtns>
                </FollowedListTitleContainerMyNotes>
                {!this.props.annotations.length ? (
                    <EmptyMessage />
                ) : (
                    this.props.isExpanded && annots
                )}
            </FollowedListNotesContainer>
        )
    }

    render() {
        return (
            <>
                {/* {this.renderSearchSection()} */}
                <ResultBodyContainer sidebarContext={this.props.sidebarContext}>
                    {!this.props.isolatedView && this.renderNewAnnotation()}
                    {this.renderResultsBody()}
                </ResultBodyContainer>
            </>
        )
    }
}

export default onClickOutside(AnnotationsSidebar)

/// Search bar
// TODO: Move icons to styled components library, refactored shared css

const EmptyMessage = () => (
    <FollowedListsMsgContainer>
        <FollowedListsMsgHead>
            No notes or highlights on this page
        </FollowedListsMsgHead>
        <FollowedListsMsg>
            Type in the text field above <br />
            or highlight sections of the page
        </FollowedListsMsg>
    </FollowedListsMsgContainer>
)

const ContributorBadge = styled.div`
    display: grid;
    justify-content: flex-end;
    align-items: center;
    color: #00000050;
    font-size: 14px;
    font-weight: bold;
    grid-auto-flow: column;
    grid-gap: 5px;
    cursor: default;
}`

const FollowedListActionItems = styled.div`
    display: grid;
    grid-auto-flow: column;
    grid-gap: 10px;
    align-items: center;
`

const IsolatedViewTutorial = styled.div`
    background: ${(props) => props.theme.colors.purple};
    display: grid;
    justify-content: space-between;
    padding: 15px;
    align-items: center;
    border-radius: 5px;
    grid-auto-flow: column;
    grid-gap: 20px;
    width: fill-available;
    margin-bottom: 20px;
`

const IsolatedViewTutorialClose = styled.div`
    height: 16px;
    width: 16px;
`

const IsolatedViewText = styled.div`
    color: white;
    font-size: 14px;
    text-align: left;
    cursor: default;
`

const ButtonStyled = styled.button`
    cursor: pointer;
    z-index: 3000;
    line-height: normal;
    background: transparent;
    border: none;
    outline: none;
`

const IsolatedViewTopBar = styled.div`
    display: flex;
    justify-content: space-between;
    padding: 5px 0px 15px 0px;
    align-items: center;
    width: 100%;
`

const BackButton = styled.div`
    display: flex;
    justify-content: space-between;
    width: 50px;
    align-items: center;
    color: #00000050;
    font-size: 14px;
    cursor: pointer;
`

const SearchIcon = styled.span`
    background-image: url('/img/searchIcon.svg');
    background-size: 15px;
    display: block;
    background-repeat: no-repeat;
    width: 29px;
    height: 29px;
    background-position: center;
    border-radius: 50%;
    background-color: transparent;
`

const SearchInputStyled = styled(TextInputControlled)`
    color: ${(props) => props.theme.colors.primary};
    border-radius: 3px;
    font-size: 14px;
    font-weight: 400;
    text-align: left;
    width: 100%;
    height: 30px;
    border: none;
    outline: none;
    background-color: transparent;

    &::placeholder {
        color: ${(props) => props.theme.colors.primary};
        font-weight: 500;
        opacity: 0.7;
    }

    &:focus {
        outline: none;
        border: none;
        box-shadow: none;
    }
    padding: 5px 0px;
`

const FollowedListNotesContainer = styled(Margin)`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
`

const FollowedNotesContainer = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
`

const FollowedListsMsgContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding-bottom: 50px;
    flex-direction: column;
`

const FollowedListsMsgHead = styled.span`
    font-weight: bold;
    text-align: center;
    color: ${(props) => props.theme.colors.primary};
    padding-top: 10px;
    padding-bottom: 5px;
    font-size: 14px;
    line-height: 20px;
`
const FollowedListsMsg = styled.span`
    color: ${(props) => props.theme.colors.darkgrey};
    text-align: center;
    font-size: 14px;
    line-height: 17px;
`

const FollowedListsContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 10px 10px 100px 10px;
`

const FollowedListRow = styled(Margin)<{ context: string }>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px 5px 5px;
    width: 415px;
    cursor: ${(props) =>
        props.context === 'isolatedView' ? 'default' : 'pointer'};
    border-radius: 3px;

    &:hover {
        background: ${(props) =>
            props.context === 'isolatedView' ? 'none' : '#d0d0d0'};
    }
`

const FollowedListSectionTitle = styled(Margin)`
    font-size: 16px;
    color: #c0c0c0;
    justify-content: flex-start;
    width: max-content;
`

const FollowedListTitleContainer = styled(Margin)`
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: ${(props) =>
        props.context === 'isolatedView' ? 'default' : 'pointer'};
    justify-content: flex-start;
    flex: 1;
`

const FollowedListTitleContainerMyNotes = styled(Margin)`
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    justify-content: space-between;
    width: 420px;
    z-index: 20;
`

const FollowedListTitle = styled.span<{ context: string }>`
    font-weight: bold;
    font-size: ${(props) =>
        props.context === 'isolatedView' ? '18px' : '14px'};
    white-space: pre;
    max-width: 295px;
    text-overflow: ellipsis;
    overflow-x: hidden;
    color: ${(props) => props.theme.colors.primary};
`

const FollowedListNoteCount = styled(Margin)`
    font-weight: bold;
    border-radius: 30px;
    background-color: ${(props) => props.theme.colors.grey};
    width: 30px;
    font-size: 12px;
`

const FollowedListIconContainer = styled.div`
    height: 24px;
    width: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 3px;
    margin-right: 5px;

    &:hover {
        background: white;
    }
`

const FollowedListDropdownIcon = styled(Icon)<{
    isExpanded: boolean
    marginLeft: string
}>`
    transform: ${(props) => (props.isExpanded ? 'none' : 'rotate(-90deg)')};
    margin-left: ${(props) => (props.marginLeft ? props.marginLeft : 'none')};
    margin-right: ${(props) =>
        props.marginRight ? props.marginRight : 'none'};
`

const BackButtonArrow = styled(Icon)<{}>`
    transform: rotate(90deg);
`

const CloseIconStyled = styled.div<{ background: string }>`
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: 100%;
    background-color: ${(props) =>
        props.background ? props.background : props.theme.colors.primary};
    mask-image: url(${icons.close});
    background-size: 12px;
    display: block;
    cursor: pointer;
    background-repeat: no-repeat;
    width: 100%;
    height: 100%;
    background-position: center;
    border-radius: 3px;
`

const CloseButtonStyled = styled.button`
    cursor: pointer;
    z-index: 2147483647;
    line-height: normal;
    background: transparent;
    border: none;
    outline: none;
`

const TopBarStyled = styled.div`
    position: static;
    top: 0;
    background: #f6f8fb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2147483647;
    padding: 7px 8px 5px 3px;
    height: 40px;
    box-sizing: border-box;
    width: 100%;
`

const LoadingIndicatorContainer = styled.div`
    width: 100%;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
`

const LoadingIndicatorStyled = styled(LoadingIndicator)`
    width: 100%;
    display: flex;
    height: 50px;
    margin: 30px 0;
    justify-content: center;
`

const annotationCardStyle = css`
    border-radius: 3px;
    box-shadow: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px,
        rgba(15, 15, 15, 0.1) 0px 2px 4px;
    transition: background 120ms ease-in 0s;
    background: white;

    &:hover {
        transition: background 120ms ease-in 0s;
        background-color: rgba(55, 53, 47, 0.03);
    }
`

const NewAnnotationSection = styled.section<{
    context: string
}>`
    font-family: sans-serif;
    height: auto;
    background: #f6f8fb;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    width: ${(props) => (props.context === 'isolatedView' ? '100%' : 'unset')};
    padding: ${(props) =>
        props.context === 'isolatedView' ? '0px' : '10px 10px 15px 10px'};
`

const NewAnnotationSeparator = styled.div`
    align-self: center;
    width: 60%;
    margin-top: 20px;
    border-bottom: 1px solid #e0e0e0;
`

const AnnotationsSectionStyled = styled.section`
    font-family: sans-serif;
    background: #f6f8fb;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 5px 10px;
`

const NewAnnotationBoxStyled = styled.div`
    position: relative;
    width: 100%;
`

const TopSectionStyled = styled.div`
    position: sticky;
    top: 0px;
    z-index: 2600;
    background: white;
    overflow: hidden;
    padding: 0 5px;
`

const EmptyMessageStyled = styled.div`
    width: 80%;
    margin: 0px auto;
    text-align: center;
    margin-top: 90px;
    animation: onload 0.3s cubic-bezier(0.65, 0.05, 0.36, 1);
`

const EmptyMessageEmojiStyled = styled.div`
    font-size: 20px;
    margin-bottom: 15px;
    color: rgb(54, 54, 46);
`

const EmptyMessageTextStyled = styled.div`
    margin-bottom: 15px;
    font-weight: 400;
    font-size: 15px;
    color: #a2a2a2;
`

const ActionBtn = styled.button<{ isActive: boolean }>`
    border-radius: 3px;
    padding: 2px;
    width: 24px;
    height: 24px;
    padding: 3px;
    border-radius: 3px;
    background-repeat: no-repeat;
    background-position: center;
    border: none;
    background-color: ${(props) =>
        props.isActive ? '#e0e0e0' : 'transparent'};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: #e0e0e0;
    }

    &:active {
    }

    &:focus {
        outline: none;
    }

    &:disabled {
        opacity: 0.4;
        background-color: transparent;
    }
`

const ActionIcon = styled.img`
    height: 80%;
    width: auto;
`

const FollowedListActionIcon = styled.img`
    height: 14px;
    width: auto;
    cursor: pointer;
`

const ContributorIcon = styled.img`
    height: 14px;
    width: auto;
`

const TopBarActionBtns = styled.div`
    display: grid;
    justify-content: space-between;
    align-items: center;
    display: flex;
    gap: 10px;
    height: 24px;
`

const MyNotesClickableArea = styled.div`
    cursor: pointer;
    display: flex;
    align-items: center;
`

const CopyPasterWrapperTopBar = styled.div`
    position: relative;
    right: 225px;
    z-index: 10;
    top: 20px;
`

const ShareMenuWrapperTopBar = styled.div`
    position: relative;
    right: 240px;
    z-index: 10;
    top: 20px;
`

const ResultBodyContainer = styled.div<{ sidebarContext: string }>`
    height: fill-available;
    overflow-y: scroll;
    padding-bottom: 150px;
    width: 450px;
    padding-right: ${(props) =>
        props.sidebarContext === 'dashboard' ? '0' : '20px'};
    position: absolute;
    right: ${(props) => (props.sidebarContext === 'dashboard' ? '0' : '20px')};

    &::-webkit-scrollbar {
        display: none;
    }

    scrollbar-width: none;
`
