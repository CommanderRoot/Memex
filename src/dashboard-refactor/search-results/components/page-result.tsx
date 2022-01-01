import React, { PureComponent, HTMLProps } from 'react'
import styled from 'styled-components'
import ItemBox from '@worldbrain/memex-common/lib/common-ui/components/item-box'
import ItemBoxBottom, {
    ItemBoxBottomAction,
} from '@worldbrain/memex-common/lib/common-ui/components/item-box-bottom'

import { Icon } from 'src/dashboard-refactor/styled-components'
import * as icons from 'src/common-ui/components/design-library/icons'
import {
    PageData,
    PageInteractionProps,
    PageResult,
    PagePickerProps,
} from '../types'
import TagPicker from 'src/tags/ui/TagPicker'
import { PageNotesCopyPaster } from 'src/copy-paster'
import CollectionPicker from 'src/custom-lists/ui/CollectionPicker'
import Margin from 'src/dashboard-refactor/components/Margin'
import { HoverBox } from 'src/common-ui/components/design-library/HoverBox'
import TagsSegment from 'src/common-ui/components/result-item-tags-segment'
import AllNotesShareMenu, {
    Props as ShareMenuProps,
} from 'src/overview/sharing/AllNotesShareMenu'
import { ButtonTooltip } from 'src/common-ui/components'
import isUserBeforeTagsUnification from 'src/util/isUserBeforeTagsUnification'

export interface Props
    extends PageData,
        PageResult,
        PageInteractionProps,
        PagePickerProps {
    onTagClick?: (tag: string) => void
    isSearchFilteredByList: boolean
    filteredbyListID: number
    shareMenuProps: Omit<ShareMenuProps, 'annotationsBG' | 'contentSharingBG'>
}

export interface State {
    userBeforeTagUnification: boolean
}

export default class PageResultView extends PureComponent<Props> {
    async componentDidMount() {
        await this.userBeforeTagUnification()
    }

    state = {
        userBeforeTagUnification: false,
    }

    private get fullUrl(): string {
        return this.props.type === 'pdf'
            ? this.props.fullPdfUrl!
            : this.props.fullUrl
    }

    private get domain(): string {
        let fullUrl: URL
        try {
            fullUrl = new URL(this.fullUrl)
        } catch (err) {
            return ''
        }

        if (fullUrl.protocol.startsWith('http')) {
            return decodeURIComponent(fullUrl.hostname.replace('www.', ''))
        } else if (fullUrl.protocol === 'file:') {
            return decodeURIComponent(fullUrl.pathname)
        }
        return ''
    }

    private get hasTags(): boolean {
        return this.props.tags.length > 0
    }

    private get hasNotes(): boolean {
        return (
            this.props.hasNotes ||
            this.props.noteIds[this.props.notesType].length > 0
        )
    }

    private get hasLists(): boolean {
        return this.props.lists.length > 0
    }

    async userBeforeTagUnification() {
        const isfrombefore = await isUserBeforeTagsUnification()
        this.setState({ userBeforeTagUnification: isfrombefore })
    }

    private renderPopouts() {
        if (this.props.isTagPickerShown) {
            return (
                <HoverBox right="0" withRelativeContainer>
                    <TagPicker
                        onUpdateEntrySelection={this.props.onTagPickerUpdate}
                        initialSelectedEntries={() => this.props.tags}
                        onClickOutside={this.props.onTagPickerBtnClick}
                    />
                </HoverBox>
            )
        }

        if (this.props.isListPickerShown) {
            return (
                <HoverBox right="0" withRelativeContainer>
                    <CollectionPicker
                        onUpdateEntrySelection={this.props.onListPickerUpdate}
                        initialSelectedEntries={() => this.props.lists}
                        onClickOutside={this.props.onListPickerBtnClick}
                    />
                </HoverBox>
            )
        }

        if (this.props.isCopyPasterShown) {
            return (
                <HoverBox right="0" withRelativeContainer>
                    <PageNotesCopyPaster
                        normalizedPageUrls={[this.props.normalizedUrl]}
                        onClickOutside={this.props.onCopyPasterBtnClick}
                    />
                </HoverBox>
            )
        }

        if (this.props.isShareMenuShown) {
            return (
                <HoverBox right="0" withRelativeContainer>
                    <AllNotesShareMenu {...this.props.shareMenuProps} />
                </HoverBox>
            )
        }

        return null
    }

    private renderRemoveFromListBtn() {
        if (
            !this.props.isSearchFilteredByList ||
            this.props.hoverState == null
        ) {
            return false
        }

        return (
            <RemoveFromListBtn onClick={this.props.onRemoveFromListBtnClick}>
                <ButtonTooltip
                    tooltipText={
                        this.props.filteredbyListID === 20201014
                            ? 'Remove from Inbox'
                            : 'Remove from \nCollection'
                    }
                    position="left"
                >
                    <Icon heightAndWidth="12px" path={icons.close} />
                </ButtonTooltip>
            </RemoveFromListBtn>
        )
    }

    private calcFooterActions(): ItemBoxBottomAction[] {
        if (this.props.hoverState === null) {
            return [
                {
                    key: 'expand-notes-btn',
                    image: this.hasNotes
                        ? icons.commentFull
                        : icons.commentEmpty,
                },
            ]
        }

        if (this.props.hoverState === 'footer') {
            if (this.state.userBeforeTagUnification === false) {
                return [
                    {
                        key: 'delete-page-btn',
                        image: icons.trash,
                        onClick: this.props.onTrashBtnClick,
                        tooltipText: 'Delete Page & all related content',
                    },
                    {
                        key: 'copy-paste-page-btn',
                        image: icons.copy,
                        onClick: this.props.onCopyPasterBtnClick,
                        tooltipText: 'Copy Page',
                    },
                    {
                        key: 'share-page-btn',
                        image: this.props.isShared ? icons.shared : icons.link,
                        onClick: this.props.onShareBtnClick,
                        tooltipText: 'Share Page and Notes',
                    },
                    {
                        key: 'list-page-btn',
                        image: this.hasLists
                            ? icons.collectionsFull
                            : icons.collectionsEmpty,
                        onClick: this.props.onListPickerBtnClick,
                        tooltipText: 'Add to Spaces',
                    },
                    {
                        key: 'expand-notes-btn',
                        image: this.hasNotes
                            ? icons.commentFull
                            : icons.commentEmpty,
                        onClick: this.props.onNotesBtnClick,
                        tooltipText: (
                            <span>
                                <strong>Add/View Notes</strong>
                                <br />
                                shift+click to open in sidebar
                            </span>
                        ),
                    },
                ]
            } else {
                return [
                    {
                        key: 'delete-page-btn',
                        image: icons.trash,
                        onClick: this.props.onTrashBtnClick,
                        tooltipText: 'Delete Page & all related content',
                    },
                    {
                        key: 'copy-paste-page-btn',
                        image: icons.copy,
                        onClick: this.props.onCopyPasterBtnClick,
                        tooltipText: 'Copy Page',
                    },
                    {
                        key: 'share-page-btn',
                        image: this.props.isShared ? icons.shared : icons.link,
                        onClick: this.props.onShareBtnClick,
                        tooltipText: 'Share Page and Notes',
                    },
                    {
                        key: 'tag-page-btn',
                        image: this.hasTags ? icons.tagFull : icons.tagEmpty,
                        onClick: this.props.onTagPickerBtnClick,
                        tooltipText: 'Tag Page',
                    },
                    {
                        key: 'list-page-btn',
                        image: this.hasLists
                            ? icons.collectionsFull
                            : icons.collectionsEmpty,
                        onClick: this.props.onListPickerBtnClick,
                        tooltipText: 'Add to Spaces',
                    },
                    {
                        key: 'expand-notes-btn',
                        image: this.hasNotes
                            ? icons.commentFull
                            : icons.commentEmpty,
                        onClick: this.props.onNotesBtnClick,
                        tooltipText: (
                            <span>
                                <strong>Add/View Notes</strong>
                                <br />
                                shift+click to open in sidebar
                            </span>
                        ),
                    },
                ]
            }
        }

        if (this.state.userBeforeTagUnification === false) {
            return [
                {
                    key: 'delete-page-btn',
                    isDisabled: true,
                    image: icons.trash,
                },
                {
                    key: 'copy-paste-page-btn',
                    isDisabled: true,
                    image: icons.copy,
                },
                {
                    key: 'share-page-btn',
                    isDisabled: true,
                    image: this.props.isShared ? icons.shared : icons.link,
                },
                {
                    key: 'list-page-btn',
                    isDisabled: true,
                    image: this.hasLists
                        ? icons.collectionsFull
                        : icons.collectionsEmpty,
                },
                {
                    key: 'expand-notes-btn',
                    image: this.hasNotes
                        ? icons.commentFull
                        : icons.commentEmpty,
                },
            ]
        } else {
            return [
                {
                    key: 'delete-page-btn',
                    isDisabled: true,
                    image: icons.trash,
                },
                {
                    key: 'copy-paste-page-btn',
                    isDisabled: true,
                    image: icons.copy,
                },
                {
                    key: 'share-page-btn',
                    isDisabled: true,
                    image: this.props.isShared ? icons.shared : icons.link,
                },
                {
                    key: 'tag-page-btn',
                    isDisabled: true,
                    image: this.hasTags ? icons.tagFull : icons.tagEmpty,
                },
                {
                    key: 'list-page-btn',
                    isDisabled: true,
                    image: this.hasLists
                        ? icons.collectionsFull
                        : icons.collectionsEmpty,
                },
                {
                    key: 'expand-notes-btn',
                    image: this.hasNotes
                        ? icons.commentFull
                        : icons.commentEmpty,
                },
            ]
        }
    }

    render() {
        const hasTitle = this.props.fullTitle && this.props.fullTitle.length > 0

        return (
            <ItemBox
                firstDivProps={{
                    onMouseLeave: this.props.onUnhover,
                    onDragStart: this.props.onPageDrag,
                    onDragEnd: this.props.onPageDrop,
                }}
            >
                <StyledPageResult>
                    {this.renderRemoveFromListBtn()}
                    <PageContentBox
                        onMouseOver={this.props.onMainContentHover}
                        href={this.fullUrl}
                        target="_blank"
                    >
                        <ResultContent>
                            {this.props.favIconURI && (
                                <FavIconBox>
                                    <FavIconImg src={this.props.favIconURI} />
                                </FavIconBox>
                            )}
                            {this.props.type === 'pdf' && (
                                <PDFIcon>PDF</PDFIcon>
                            )}
                            <PageUrl>{this.domain}</PageUrl>
                        </ResultContent>
                        <PageTitle top="10px" bottom="5px">
                            {hasTitle
                                ? this.props.fullTitle === this.props.fullUrl
                                    ? this.props.fullTitle.split('/').slice(-1)
                                    : this.props.fullTitle
                                : this.props.fullUrl}
                        </PageTitle>
                    </PageContentBox>
                    <TagsSegment
                        tags={this.props.tags}
                        onMouseEnter={this.props.onTagsHover}
                        showEditBtn={this.props.hoverState === 'tags'}
                        onEditBtnClick={this.props.onTagPickerBtnClick}
                        onTagClick={this.props.onTagClick}
                    />
                    <ItemBoxBottom
                        firstDivProps={{
                            onMouseEnter: this.props.onFooterHover,
                        }}
                        creationInfo={{ createdWhen: this.props.displayTime }}
                        actions={this.calcFooterActions()}
                    />
                </StyledPageResult>
                <PopoutContainer>{this.renderPopouts()}</PopoutContainer>
            </ItemBox>
        )
    }
}

const PDFIcon = styled.div`
    border: 1px solid rgb(184, 184, 184);
    border-radius: 5px;
    padding: 0 8px;
    font-weight: 500;
    color: black;
    margin-right: 10px;
`

const PopoutContainer = styled.div``

const StyledPageResult = styled.div`
    display: flex;
    flex-direction: column;
    position: relative;
    border-radius: 5px;

    &:hover {
        box-shadow: 0px 0px 4px 2px #d6d6d6;
    }
`

const RemoveFromListBtn = styled.div`
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    outline: none;
    border: none;
    display: flex;
    height: 20px;
    width: 20px;
    justify-content: center;
    align-items: center;
    cursor: pointer;
`

const FavIconBox = styled.div`
    width: 20px;
    height: 20px;
    border: 1px solid #efefef;
    border-radius: 30px;
    margin-right: 5px;
`

const FavIconPlaceholder = styled.div`
    border-radius: 30px;
`

const FavIconImg = styled.img`
    width: 100%;
    height: 100%;
    border-radius: 30px;
`

const PageContentBox = styled.a`
    display: flex;
    flex-direction: column;
    cursor: pointer;
    padding: 15px 15px 5px 15px;
    text-decoration: none;
    border-radius: 5px;

    &:hover {
        background-color: #fafafa;
    }
`

const ResultContent = styled(Margin)`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
`

const PageTitle = styled(Margin)`
    font-size: 14px;
    font-weight: 600;
    color: ${(props) => props.theme.colors.primary};
    justify-content: flex-start;
`
const PageUrl = styled.span`
    font-size: 12px;
    color: #545454;
    display: flex;
    height: 20px;
    align-items: center;
    padding-top: 2px;
`
