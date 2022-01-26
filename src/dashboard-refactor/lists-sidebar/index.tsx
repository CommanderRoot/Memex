import React, { PureComponent } from 'react'
import styled, { css } from 'styled-components'
import { SPECIAL_LIST_IDS } from '@worldbrain/memex-common/lib/storage/modules/lists/constants'

import colors from 'src/dashboard-refactor/colors'
import { SidebarLockedState, SidebarPeekState } from './types'
import ListsSidebarGroup, {
    ListsSidebarGroupProps,
} from './components/sidebar-group'
import ListsSidebarSearchBar, {
    ListsSidebarSearchBarProps,
} from './components/search-bar'
import Margin from '../components/Margin'
import ListsSidebarItem, {
    Props as ListsSidebarItemProps,
} from './components/sidebar-item-with-menu'
import { sizeConstants } from '../constants'
import { DropReceivingState } from '../types'
import ListsSidebarEditableItem from './components/sidebar-editable-item'
import { UIElementServices } from '@worldbrain/memex-common/lib/services/types'

const Sidebar = styled.div<{
    locked: boolean
    peeking: boolean
}>`
    display: flex;
    flex-direction: column;
    justify-content: start;
    width: ${sizeConstants.listsSidebar.widthPx}px;
    position: fixed;
    z-index: 3000;

    ${(props) =>
        props.locked &&
        css`
            height: 100%;
            background-color: ${colors.white};
            box-shadow: rgb(16 30 115 / 3%) 4px 0px 16px;
            top: ${sizeConstants.header.heightPx}px;
        `}
    ${(props) =>
        props.peeking &&
        css`
            height: max-content;
            background-color: ${colors.white};
            box-shadow: rgb(16 30 115 / 3%) 4px 0px 16px;
            margin-top: 50px;
            margin-bottom: 9px;
            height: 90vh;
            top: 5px;
            border-top-right-radius: 3px;
            border-bottom-right-radius: 3px;
        `}
    ${(props) =>
        !props.peeking &&
        !props.locked &&
        css`
            display: none;
        `}
`

const Container = styled.div``

const PeekTrigger = styled.div`
    height: 100vh;
    width: 10px;
    position: fixed;
    background: transparent;
`

const TopGroup = styled.div`
    border-top: 1px solid ${colors.lightGrey};
`
const BottomGroup = styled.div`
    overflow-y: scroll;
    overflow-x: visible;
    padding-bottom: 100px;
    height: fill-available;

    &::-webkit-scrollbar {
      display: none;
    }

    scrollbar-width: none;
}
`

const NoCollectionsMessage = styled.div`
    font-size: 12px;
    color: #3a2f45;
    padding: 5px 18px 10px 18px;

    & u {
        cursor: pointer;
    }
`

export interface ListsSidebarProps {
    openFeedUrl: () => void
    onListSelection: (id: number) => void
    isAllSavedSelected: boolean
    onAllSavedSelection: () => void
    hasFeedActivity?: boolean
    inboxUnreadCount: number
    selectedListId?: number
    addListErrorMessage: string | null
    lockedState: SidebarLockedState
    peekState: SidebarPeekState
    searchBarProps: ListsSidebarSearchBarProps
    listsGroups: ListsSidebarGroupProps[]
    initDropReceivingState: (listId: number) => DropReceivingState
}

export default class ListsSidebar extends PureComponent<ListsSidebarProps> {
    private renderLists = (
        lists: ListsSidebarItemProps[],
        canReceiveDroppedItems: boolean,
    ) =>
        lists.map((listObj, i) => (
            <ListsSidebarItem
                key={i}
                dropReceivingState={{
                    ...this.props.initDropReceivingState(listObj.listId),
                    canReceiveDroppedItems,
                }}
                {...listObj}
            />
        ))

    private bindRouteGoTo = (route: 'import' | 'sync' | 'backup') => () => {
        window.location.hash = '#/' + route
    }

    render() {
        const {
            lockedState: { isSidebarLocked },
            peekState: { isSidebarPeeking },
            addListErrorMessage,
            searchBarProps,
            listsGroups,
        } = this.props
        return (
            <Container
                onMouseLeave={this.props.peekState.setSidebarPeekState(false)}
            >
                <PeekTrigger
                    onMouseEnter={this.props.peekState.setSidebarPeekState(
                        true,
                    )}
                    onDragEnter={this.props.peekState.setSidebarPeekState(true)}
                />
                <Sidebar
                    peeking={isSidebarPeeking}
                    locked={isSidebarLocked}
                    onMouseEnter={
                        isSidebarPeeking &&
                        this.props.peekState.setSidebarPeekState(true)
                    }
                >
                    <BottomGroup>
                        <Margin vertical="10px">
                            <ListsSidebarGroup
                                isExpanded
                                loadingState="success"
                            >
                                {this.renderLists(
                                    [
                                        {
                                            name: 'All Saved',
                                            listId: -1,
                                            selectedState: {
                                                isSelected: this.props
                                                    .isAllSavedSelected,
                                                onSelection: this.props
                                                    .onAllSavedSelection,
                                            },
                                        },
                                        {
                                            name: 'Inbox',
                                            listId: SPECIAL_LIST_IDS.INBOX,
                                            newItemsCount: this.props
                                                .inboxUnreadCount,
                                            selectedState: {
                                                isSelected:
                                                    this.props
                                                        .selectedListId ===
                                                    SPECIAL_LIST_IDS.INBOX,
                                                onSelection: this.props
                                                    .onListSelection,
                                            },
                                        },
                                        {
                                            name: 'Saved on Mobile',
                                            listId: SPECIAL_LIST_IDS.MOBILE,
                                            selectedState: {
                                                isSelected:
                                                    this.props
                                                        .selectedListId ===
                                                    SPECIAL_LIST_IDS.MOBILE,
                                                onSelection: this.props
                                                    .onListSelection,
                                            },
                                        },
                                        {
                                            name: 'Feed',
                                            listId: SPECIAL_LIST_IDS.INBOX + 2,
                                            hasActivity: this.props
                                                .hasFeedActivity,
                                            selectedState: {
                                                isSelected: false,
                                                onSelection: this.props
                                                    .openFeedUrl,
                                            },
                                        },
                                    ],
                                    false,
                                )}
                            </ListsSidebarGroup>
                        </Margin>
                        <TopGroup>
                            <Margin top="5px">
                                <ListsSidebarSearchBar {...searchBarProps} />
                            </Margin>
                        </TopGroup>
                        {listsGroups.map((group, i) => (
                            <Margin key={i} vertical="10px">
                                <ListsSidebarGroup {...group}>
                                    {group.isAddInputShown && (
                                        <ListsSidebarEditableItem
                                            onConfirmClick={
                                                group.confirmAddNewList
                                            }
                                            onCancelClick={
                                                group.cancelAddNewList
                                            }
                                            errorMessage={addListErrorMessage}
                                        />
                                    )}
                                    {group.title === 'My collections' &&
                                    group.listsArray.length === 0 ? (
                                        <NoCollectionsMessage>
                                            <strong>
                                                No saved collections
                                            </strong>{' '}
                                            <br />
                                            <u
                                                onClick={this.bindRouteGoTo(
                                                    'import',
                                                )}
                                            >
                                                Import
                                            </u>{' '}
                                            bookmark folders
                                        </NoCollectionsMessage>
                                    ) : (
                                        <>
                                            {group.title ===
                                                'Followed collections' &&
                                            group.listsArray.length === 0 ? (
                                                <NoCollectionsMessage>
                                                    <u
                                                        onClick={() =>
                                                            window.open(
                                                                'https://tutorials.memex.garden/sharing-collections-annotated-pages-and-highlights',
                                                            )
                                                        }
                                                    >
                                                        Collaborate
                                                    </u>{' '}
                                                    with friends or{' '}
                                                    <u
                                                        onClick={() =>
                                                            window.open(
                                                                'https://memex.social/c/oiLz5UIXw9JXermqZmXW',
                                                            )
                                                        }
                                                    >
                                                        follow
                                                    </u>{' '}
                                                    your first collection.
                                                </NoCollectionsMessage>
                                            ) : (
                                                this.renderLists(
                                                    group.listsArray,
                                                    true,
                                                )
                                            )}
                                        </>
                                    )}
                                </ListsSidebarGroup>
                            </Margin>
                        ))}
                    </BottomGroup>
                </Sidebar>
            </Container>
        )
    }
}
