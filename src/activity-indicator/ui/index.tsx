import React from 'react'
import styled from 'styled-components'
import { StatefulUIElement } from 'src/util/ui-logic'
import { StaticListItem } from 'src/custom-lists/components/overview/sidebar/static-list-item'
import Logic, { Dependencies, State, Events } from './logic'

export interface Props extends Dependencies {}

export default class FeedActivityIndicator extends StatefulUIElement<
    Props,
    State,
    Events
> {
    constructor(props: Props) {
        super(props, new Logic(props))
    }

    private handleFeedIndicatorClick: React.MouseEventHandler = (e) =>
        this.processEvent('clickFeedEntry', null)

    render() {
        if (this.state.isShown) {
            return (
                <StaticListItem
                    listName="Feed"
                    unreadCount={this.state.hasFeedActivity ? 1 : 0}
                    onListItemClick={this.handleFeedIndicatorClick}
                />
            )
        }

        return null
    }
}

export class FeedActivityDot extends StatefulUIElement<Props, State, Events> {
    constructor(props: Props) {
        super(props, new Logic(props))
    }

    private handleFeedIndicatorClick: React.MouseEventHandler = (e) =>
        this.processEvent('clickFeedEntry', null)

    render() {
        if (this.state.isShown) {
            return (
                <Dot
                    unread={this.state.hasFeedActivity ? 1 : 0}
                    onClick={this.handleFeedIndicatorClick}
                />
            )
        }

        return null
    }
}

const Dot = styled.div<{ unread: boolean }>`
    border-radius: 10px;
    width: 16px;
    height: 16px;
    background: ${(props) => (props.unread ? '#5cd9a6' : 'unset')};
    border: 2px solid ${(props) => (props.unread ? '#5cd9a6' : '#5671cf')};
    cursor: pointer;
`
