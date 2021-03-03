import React, { PureComponent } from 'react'
import styled, { css } from 'styled-components'
import moment from 'moment'

import styles, { fonts } from 'src/dashboard-refactor/styles'
import colors from 'src/dashboard-refactor/colors'

import { LoadingIndicator } from 'src/common-ui/components'
import { Icon } from 'src/dashboard-refactor/styled-components'

import { DisableableState, RootState } from './types'
import { HoverState } from 'src/dashboard-refactor/types'
import { HoverBox } from 'src/common-ui/components/design-library/HoverBox'
import * as icons from 'src/common-ui/components/design-library/icons'

const Container = styled(HoverBox)<{
    isDisplayed: boolean
}>`
    height: min-content;
    width: 183px;
    padding: 7px;
    background-color: ${colors.white};
    flex-direction: column;
    box-shadow: ${styles.boxShadow.overlayElement};
`

const Row = styled.div`
    height: min-content;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
`

const RowContainer = styled.div`
    height: max-content;
    width: 100%;
    padding-top: 5px;
    padding-bottom: 5px;
    padding-left: 10px;
    padding-right: 10px;
    display: flex;
    flex-direction: column;
`

const NotificationBox = styled(RowContainer)`
    height: 32px;
    padding: 0 !important;
    justify-content: center;
    align-items: center;
    background-color: ${colors.error.pink};
    box-shadow: ${styles.boxShadow.overlayElement};
    border-radius: ${styles.borderRadius.medium};
`

const IconContainer = styled(Icon)<{
    disabled: boolean
}>`
    padding-right: 10px;
    ${(props) =>
        props.disabled &&
        css`
            opacity: 0.5;
        `}
    ${(props) =>
        !props.disabled &&
        css`
            cursor: pointer;
        `}
`

const textStyles = `
    font-family: ${fonts.primary.name};
    color: ${colors.fonts.primary};
`

const TextBlock = styled.div<{
    bold: boolean
}>`
    height: 18px;
    ${textStyles}
    font-size: 10px;
    line-height: 15px;
    ${(props) =>
        css`
            font-weight: ${props.bold
                ? fonts.primary.weight.bold
                : fonts.primary.weight.normal};
        `}
`

const TextBlockSmall = styled.div`
    ${textStyles}
    font-weight: ${fonts.primary.weight.bold};
    font-size: 8px;
    line-height: 12px;
    text-align: center;
`

const StyledAnchor = styled.a`
    color: ${colors.fonts.secondary};
    text-decoration: none;
`

export const timeSinceNowToString = (date: Date): string => {
    const now = moment(new Date())
    const dt = moment(date)
    const seconds = now.diff(dt, 'seconds')
    const minutes = now.diff(dt, 'minutes')
    const hours = now.diff(dt, 'hours')
    const days = now.diff(dt, 'days')
    const years = now.diff(dt, 'years')

    if (seconds < 60) {
        return 'Seconds ago'
    }
    if (minutes < 2) {
        return '1 min ago'
    }
    if (minutes < 15) {
        return 'Minutes ago'
    }
    if (minutes < 30) {
        return '15 min ago'
    }
    if (hours < 1) {
        return '30 min ago'
    }
    if (hours < 2) {
        return 'An hour ago'
    }
    if (days < 1) {
        return `${hours} ago`
    }
    if (days < 2) {
        return 'One day ago'
    }
    if (days < 30) {
        return `${days} ago`
    }
    if (years < 1) {
        return dt.format('MMM Do')
    }
    return dt.format('ll')
}

export interface SyncStatusMenuProps extends RootState {
    goToSyncRoute: () => void
    goToBackupRoute: () => void
    syncRunHoverState: HoverState
    backupRunHoverState: HoverState
    onInitiateSync: React.MouseEventHandler
    onInitiateBackup: React.MouseEventHandler
    onToggleDisplayState: React.MouseEventHandler
    onShowUnsyncedItemCount: React.MouseEventHandler
    onHideUnsyncedItemCount: React.MouseEventHandler
}

export default class SyncStatusMenu extends PureComponent<SyncStatusMenuProps> {
    private renderNotificationBox = (
        topSpanContent: JSX.Element | string,
        bottomSpanContent: JSX.Element | string,
    ) => {
        return (
            <Row>
                <NotificationBox>
                    <TextBlockSmall>{topSpanContent}</TextBlockSmall>
                    <TextBlockSmall>{bottomSpanContent}</TextBlockSmall>
                </NotificationBox>
            </Row>
        )
    }

    private renderBackupReminder = () => {
        return this.renderNotificationBox(
            'Memex is an offline app.',
            'Backup your data.',
        )
    }

    private renderError = (syncType: 'Sync' | 'Backup') => {
        return this.renderNotificationBox(
            `Your last ${syncType.toLocaleLowerCase()} failed.`,
            <span>
                <StyledAnchor href="">Contact Support</StyledAnchor> if retry
                fails too.
            </span>,
        )
    }

    private renderRow = (
        syncType: 'Sync' | 'Backup',
        serviceStatus: DisableableState,
        otherServiceStatus: DisableableState,
        timeSinceLastRun: Date,
        clickHandler: React.MouseEventHandler,
    ) => {
        return (
            <>
                <Row>
                    <RowContainer>
                        <TextBlock bold>{`${syncType} Status`}</TextBlock>
                        <TextBlock>
                            {serviceStatus === 'disabled' &&
                                (syncType === 'Sync'
                                    ? 'No device paired yet'
                                    : 'No backup set yet')}
                            {serviceStatus === 'enabled' &&
                                `${syncType} enabled`}
                            {serviceStatus === 'running' && `In progress`}
                            {(serviceStatus === 'success' ||
                                serviceStatus === 'error') &&
                                `Last ${syncType.toLocaleLowerCase()}: ${timeSinceNowToString(
                                    timeSinceLastRun,
                                )}`}
                        </TextBlock>
                    </RowContainer>
                    {serviceStatus === 'running' ? (
                        <LoadingIndicator />
                    ) : (
                        <IconContainer
                            path={
                                serviceStatus === 'disabled'
                                    ? icons.arrowRight
                                    : icons.reload
                            }
                            disabled={otherServiceStatus === 'running'}
                            onClick={clickHandler}
                            heightAndWidth="15px"
                        />
                    )}
                </Row>
                {serviceStatus === 'error' && this.renderError(syncType)}
            </>
        )
    }
    render() {
        const {
            syncState,
            isDisplayed,
            backupState,
            onInitiateSync,
            goToSyncRoute,
            goToBackupRoute,
            onInitiateBackup,
            lastSuccessfulSyncDateTime,
            lastSuccessfulBackupDateTime,
        } = this.props
        if (!isDisplayed) {
            return null
        }

        return (
            <Container width="min-content" left="50px" top="50px">
                {this.renderRow(
                    'Sync',
                    syncState,
                    backupState,
                    lastSuccessfulSyncDateTime,
                    syncState === 'disabled' ? goToSyncRoute : onInitiateSync,
                )}
                {this.renderRow(
                    'Backup',
                    backupState,
                    syncState,
                    lastSuccessfulBackupDateTime,
                    syncState === 'disabled'
                        ? goToBackupRoute
                        : onInitiateBackup,
                )}
                {backupState === 'disabled' && this.renderBackupReminder()}
            </Container>
        )
    }
}
