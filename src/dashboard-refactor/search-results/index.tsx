import React, { PureComponent } from 'react'
import styled from 'styled-components'
import Waypoint from 'react-waypoint'

import {
    RootState,
    PageResult as PageResultData,
    PageData,
    PageInteractionAugdProps,
    NoteInteractionAugdProps,
    NotesType,
    NoteInteractionProps,
    PagePickerProps,
    PageInteractionProps,
    PagePickerAugdProps,
    NotePickerAugdProps,
    NoResultsType,
} from './types'
import TopBar from './components/result-top-bar'
import SearchTypeSwitch, {
    Props as SearchTypeSwitchProps,
} from './components/search-type-switch'
import ExpandAllNotes from './components/expand-all-notes'
import DayResultGroup from './components/day-result-group'
import PageResult from './components/page-result'
import NoResults from './components/no-results'
import { bindFunctionalProps, formatDayGroupTime } from './util'
import NotesTypeDropdownMenu from './components/notes-type-dropdown-menu'
import { SortingDropdownMenuBtn } from 'src/sidebar/annotations-sidebar/components/SortingDropdownMenu'
import { AnnotationsSorter } from 'src/sidebar/annotations-sidebar/sorting'
import {
    AnnotationCreate,
    AnnotationCreateEventProps,
} from 'src/annotations/components/AnnotationCreate'
import { sizeConstants } from '../constants'
import AnnotationEditable from 'src/annotations/components/AnnotationEditable'
import { LoadingIndicator } from 'src/common-ui/components'
import { HoverBox } from 'src/common-ui/components/design-library/HoverBox'
import { PageNotesCopyPaster } from 'src/copy-paster'
import TagPicker from 'src/tags/ui/TagPicker'
import SingleNoteShareMenu from 'src/overview/sharing/SingleNoteShareMenu'
import Margin from 'src/dashboard-refactor/components/Margin'
import DismissibleResultsMessage from './components/dismissible-results-message'
import MobileAppAd from 'src/sync/components/device-list/mobile-app-ad'
import OnboardingMsg from './components/onboarding-msg'

const timestampToString = (timestamp: number) =>
    timestamp === -1 ? undefined : formatDayGroupTime(timestamp)

export type Props = RootState &
    Pick<
        SearchTypeSwitchProps,
        'onNotesSearchSwitch' | 'onPagesSearchSwitch'
    > & {
        goToImportRoute: () => void
        areAllNotesShown: boolean
        isSearchFilteredByList: boolean
        pageInteractionProps: PageInteractionAugdProps
        noteInteractionProps: NoteInteractionAugdProps
        pagePickerProps: PagePickerAugdProps
        notePickerProps: NotePickerAugdProps
        onShowAllNotesClick: React.MouseEventHandler
        noResultsType: NoResultsType
        onDismissMobileAd: React.MouseEventHandler
        onDismissOnboardingMsg: React.MouseEventHandler
        filterSearchByTag: (tag: string) => void
        newNoteInteractionProps: {
            [Key in keyof AnnotationCreateEventProps]: (
                day: number,
                pageId: string,
            ) => AnnotationCreateEventProps[Key]
        }
        onPageNotesTypeSelection(
            day: number,
            pageId: string,
        ): (selection: NotesType) => void
        onPageNotesSortSelection(
            day: number,
            pageId: string,
        ): (sorter: AnnotationsSorter) => void
        paginateSearch(): Promise<void>
        onPageLinkCopy(link: string): Promise<void>
        onNoteLinkCopy(link: string): Promise<void>
    }

export default class SearchResultsContainer extends PureComponent<Props> {
    private renderLoader = (props: { key?: string } = {}) => (
        <Loader>
            <LoadingIndicator {...props} />
        </Loader>
    )

    private renderNoteResult = (day: number, pageId: string) => (
        noteId: string,
    ) => {
        const noteData = this.props.noteData.byId[noteId]

        const interactionProps = bindFunctionalProps<
            NoteInteractionAugdProps,
            NoteInteractionProps
        >(this.props.noteInteractionProps, noteId, day, pageId)

        const dummyEvent = {} as any

        return (
            <AnnotationEditable
                key={noteId}
                tags={noteData.tags}
                body={noteData.highlight}
                comment={noteData.comment}
                createdWhen={new Date(noteData.displayTime)}
                onHighlightHover={interactionProps.onMainContentHover}
                onFooterHover={interactionProps.onFooterHover}
                onNoteHover={interactionProps.onNoteHover}
                onTagsHover={interactionProps.onTagsHover}
                onUnhover={interactionProps.onUnhover}
                hoverState={noteData.hoverState}
                onTagClick={this.props.filterSearchByTag}
                lastEdited={
                    noteData.isEdited
                        ? new Date(noteData.displayTime)
                        : undefined
                }
                mode={noteData.isEditing ? 'edit' : 'default'}
                sharingInfo={this.props.noteSharingInfo[noteId]}
                sharingAccess={this.props.sharingAccess}
                renderCopyPasterForAnnotation={() =>
                    noteData.isCopyPasterShown && (
                        <HoverBox right="0" withRelativeContainer>
                            <PageNotesCopyPaster
                                annotationUrls={[noteId]}
                                normalizedPageUrls={[pageId]}
                                onClickOutside={
                                    interactionProps.onCopyPasterBtnClick
                                }
                            />
                        </HoverBox>
                    )
                }
                renderTagsPickerForAnnotation={() =>
                    noteData.isTagPickerShown && (
                        <HoverBox right="0" withRelativeContainer>
                            <TagPicker
                                initialSelectedEntries={() => noteData.tags}
                                onClickOutside={
                                    interactionProps.onTagPickerBtnClick
                                }
                                onUpdateEntrySelection={
                                    interactionProps.updateTags
                                }
                            />
                        </HoverBox>
                    )
                }
                renderShareMenuForAnnotation={() =>
                    noteData.isShareMenuShown && (
                        <HoverBox right="0" withRelativeContainer>
                            <SingleNoteShareMenu
                                annotationUrl={noteId}
                                copyLink={this.props.onNoteLinkCopy}
                                closeShareMenu={
                                    interactionProps.onShareBtnClick
                                }
                                postShareHook={() =>
                                    interactionProps.updateShareInfo({
                                        status: 'shared',
                                        taskState: 'success',
                                    })
                                }
                                postUnshareHook={() =>
                                    interactionProps.updateShareInfo({
                                        status: 'unshared',
                                        taskState: 'success',
                                    })
                                }
                            />
                        </HoverBox>
                    )
                }
                annotationEditDependencies={{
                    comment: noteData.editNoteForm.inputValue,
                    onCommentChange: (value) =>
                        interactionProps.onCommentChange({
                            target: { value },
                        } as any),
                    onEditCancel: () =>
                        interactionProps.onEditCancel(dummyEvent),
                    onEditConfirm: () =>
                        interactionProps.onEditConfirm(dummyEvent),
                }}
                annotationFooterDependencies={{
                    onDeleteCancel: () => undefined,
                    onDeleteConfirm: () => undefined,
                    onTagIconClick: interactionProps.onTagPickerBtnClick,
                    onDeleteIconClick: interactionProps.onTrashBtnClick,
                    onCopyPasterBtnClick: interactionProps.onCopyPasterBtnClick,
                    onGoToAnnotation: interactionProps.onGoToHighlightClick,
                    onEditCancel: interactionProps.onEditCancel,
                    onEditConfirm: interactionProps.onEditConfirm,
                    onEditIconClick: interactionProps.onEditBtnClick,
                    onShareClick: interactionProps.onShareBtnClick,
                    onUnshareClick: interactionProps.onShareBtnClick,
                }}
            />
        )
    }

    private renderPageNotes(
        {
            areNotesShown,
            notesType,
            normalizedUrl,
            newNoteForm,
            noteIds,
        }: PageResultData & PageData,
        day: number,
    ) {
        if (!areNotesShown) {
            return null
        }
        const { newNoteInteractionProps } = this.props

        const boundAnnotCreateProps = bindFunctionalProps<
            typeof newNoteInteractionProps,
            AnnotationCreateEventProps
        >(this.props.newNoteInteractionProps, day, normalizedUrl)

        return (
            <PageNotesBox bottom="10px" left="10px">
                <NoteTopBarBox
                    leftSide={
                        <NotesTypeDropdownMenu
                            notesTypeSelection={notesType}
                            onNotesTypeSelection={this.props.onPageNotesTypeSelection(
                                day,
                                normalizedUrl,
                            )}
                        />
                    }
                    rightSide={
                        <SortingDropdownMenuBtn
                            onMenuItemClick={({ sortingFn }) =>
                                this.props.onPageNotesSortSelection(
                                    day,
                                    normalizedUrl,
                                )(sortingFn)
                            }
                        />
                    }
                />
                <Margin bottom="3px" />
                <AnnotationCreate
                    autoFocus={this.props.shouldFormsAutoFocus}
                    comment={newNoteForm.inputValue}
                    tags={newNoteForm.tags}
                    {...boundAnnotCreateProps}
                />
                {noteIds[notesType].map(
                    this.renderNoteResult(day, normalizedUrl),
                )}
            </PageNotesBox>
        )
    }

    private renderPageResult = (pageId: string, day: number) => {
        const page = {
            ...this.props.pageData.byId[pageId],
            ...this.props.results[day].pages.byId[pageId],
        }

        const interactionProps = bindFunctionalProps<
            PageInteractionAugdProps,
            PageInteractionProps
        >(this.props.pageInteractionProps, day, pageId)

        const pickerProps = bindFunctionalProps<
            PagePickerAugdProps,
            PagePickerProps
        >(this.props.pagePickerProps, pageId)

        return (
            <ResultBox bottom="10px">
                <PageResult
                    key={pageId + day.toString()}
                    isSearchFilteredByList={this.props.isSearchFilteredByList}
                    onTagClick={this.props.filterSearchByTag}
                    shareMenuProps={{
                        normalizedPageUrl: page.normalizedUrl,
                        closeShareMenu: interactionProps.onShareBtnClick,
                        copyLink: this.props.onPageLinkCopy,
                        postShareAllHook: () =>
                            interactionProps.updatePageNotesShareInfo({
                                status: 'shared',
                                taskState: 'success',
                            }),
                        postUnshareAllHook: () =>
                            interactionProps.updatePageNotesShareInfo({
                                status: 'unshared',
                                taskState: 'success',
                            }),
                    }}
                    {...interactionProps}
                    {...pickerProps}
                    {...page}
                />
                {this.renderPageNotes(page, day)}
            </ResultBox>
        )
    }

    private renderNoResults() {
        if (this.props.noResultsType === 'onboarding-msg') {
            return (
                <NoResults title="You don't have anything saved yet">
                    <DismissibleResultsMessage
                        onDismiss={this.props.onDismissOnboardingMsg}
                    >
                        <OnboardingMsg
                            goToImportRoute={this.props.goToImportRoute}
                        />
                    </DismissibleResultsMessage>
                </NoResults>
            )
        }

        if (this.props.noResultsType === 'mobile-list') {
            return (
                <NoResults title="You don't have anything saved from the mobile app yet" />
            )
        }

        if (this.props.noResultsType === 'mobile-list-ad') {
            return (
                <NoResults title="You don't have anything saved from the mobile app yet">
                    <DismissibleResultsMessage
                        onDismiss={this.props.onDismissMobileAd}
                    >
                        <MobileAppAd />
                    </DismissibleResultsMessage>
                </NoResults>
            )
        }

        if (this.props.noResultsType === 'stop-words') {
            return (
                <NoResults title="No Results">
                    Search terms are too common, or have been filtered out to
                    increase performance.
                </NoResults>
            )
        }

        return <NoResults title="No Results">¯\_(ツ)_/¯</NoResults>
    }

    private renderResultsByDay() {
        if (this.props.noResultsType != null) {
            return this.renderNoResults()
        }

        if (this.props.searchState === 'running') {
            return this.renderLoader()
        }

        const days: JSX.Element[] = []

        for (const { day, pages } of Object.values(this.props.results)) {
            days.push(
                <DayResultGroup key={day} when={timestampToString(day)}>
                    {pages.allIds.map((id) => this.renderPageResult(id, day))}
                </DayResultGroup>,
            )
        }

        if (this.props.searchPaginationState === 'running') {
            days.push(this.renderLoader({ key: 'loader' }))
        } else if (
            !this.props.areResultsExhausted &&
            this.props.searchState !== 'pristine'
        ) {
            days.push(
                <Waypoint
                    key="pagination-waypoint"
                    onEnter={() => this.props.paginateSearch()}
                />,
            )
        }

        return days
    }

    render() {
        return (
            <ResultsContainer bottom="100px">
                <PageTopBarBox bottom="5px">
                    <TopBar
                        leftSide={<SearchTypeSwitch {...this.props} />}
                        rightSide={
                            <ExpandAllNotes
                                isEnabled={this.props.areAllNotesShown}
                                onClick={this.props.onShowAllNotesClick}
                            />
                        }
                    />
                </PageTopBarBox>
                {this.renderResultsByDay()}
            </ResultsContainer>
        )
    }
}

const PageTopBarBox = styled(Margin)`
    width: 100%;
    position: st;
`

const NoteTopBarBox = styled(TopBar)`
    width: 100%;
    display: flex;
`

const ResultBox = styled(Margin)`
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
`

const PageNotesBox = styled(Margin)`
    flex-direction: column;
    justify-content: space-between;
    width: fill-available;
    padding-left: 10px;
    padding-top: 5px;
    border-left: 4px solid #e0e0e0;
`

const Loader = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
`

const ResultsContainer = styled(Margin)`
    display: flex;
    flex-direction: column;
    align-self: center;
    max-width: ${sizeConstants.searchResults.widthPx}px;
    margin-bottom: 100px;
    width: fill-available;
`
