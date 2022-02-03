import React from 'react'
import styled from 'styled-components'

import { AuthError } from '@worldbrain/memex-common/lib/authentication/types'
import Icon from '@worldbrain/memex-common/lib/common-ui/components/icon'
import { StatefulUIElement } from 'src/util/ui-logic'
import { PrimaryAction } from 'src/common-ui/components/design-library/actions/PrimaryAction'
import Margin from 'src/dashboard-refactor/components/Margin'
import * as icons from 'src/common-ui/components/design-library/icons'
import { runInBackground } from 'src/util/webextensionRPC'

import Logic from './logic'
import type { State, Event, Dependencies } from './types'

export interface Props extends Dependencies {}

const FRIENDLY_ERRORS: { [Key in AuthError['reason']]: string } = {
    'popup-blocked': 'Could not open a popup for you to log in',
    'invalid-email': 'Please enter a valid e-mail address',
    'user-not-found': `There's nobody registered with that e-mail address`,
    'wrong-password': 'You entered a wrong password',
    'email-exists': `There's already an account with that e-mail address registered`,
    'weak-password': 'Please enter a stronger password',
    unknown: 'Sorry, something went wrong on our side. Please try again later',
}

export default class AuthDialog extends StatefulUIElement<Props, State, Event> {
    static defaultProps: Pick<Props, 'authBG'> = {
        authBG: runInBackground(),
    }

    constructor(props: Props) {
        super(props, new Logic(props))
    }

    private checkPasswordMatch(value) {
        if (this.state.password === value) {
            this.processEvent('passwordMatch', { value: true })
        } else {
            this.processEvent('passwordMatch', { value: false })
        }
    }

    renderAuthForm() {
        if (this.state.mode !== 'login') {
            return (
                <StyledAuthDialog>
                    <AuthBox top="medium">
                        <AuthenticationMethods>
                            <EmailPasswordLogin>
                                <DisplayNameContainer>
                                    <TextInputContainer>
                                        <Icon
                                            filePath={icons.personFine}
                                            heightAndWidth="20px"
                                            hoverOff
                                        />
                                        <TextInput
                                            type="DisplayName"
                                            placeholder="Display Name"
                                            value={this.state.displayName}
                                            onChange={(e) =>
                                                this.processEvent(
                                                    'editDisplayName',
                                                    {
                                                        value: e.target.value,
                                                    },
                                                )
                                            }
                                            onKeyDown={handleEnter(() => {
                                                this.processEvent(
                                                    'emailPasswordConfirm',
                                                    null,
                                                )
                                            })}
                                        />
                                    </TextInputContainer>
                                    <InfoText>
                                        Name shown on shared Spaces, page links
                                        and annotations
                                    </InfoText>
                                </DisplayNameContainer>
                                <TextInputContainer>
                                    <Icon
                                        filePath={icons.mail}
                                        heightAndWidth="20px"
                                        hoverOff
                                    />
                                    <TextInput
                                        type="email"
                                        placeholder="E-mail"
                                        value={this.state.email}
                                        onChange={(e) =>
                                            this.processEvent('editEmail', {
                                                value: e.target.value,
                                            })
                                        }
                                        onKeyDown={handleEnter(() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        })}
                                    />
                                </TextInputContainer>
                                <TextInputContainer>
                                    <Icon
                                        filePath={icons.lockFine}
                                        heightAndWidth="20px"
                                        hoverOff
                                    />
                                    <TextInput
                                        type="password"
                                        placeholder="Password"
                                        value={this.state.password}
                                        onChange={(e) =>
                                            this.processEvent('editPassword', {
                                                value: e.target.value,
                                            })
                                        }
                                        onKeyDown={handleEnter(() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        })}
                                    />
                                </TextInputContainer>
                                <TextInputContainer>
                                    <Icon
                                        filePath={icons.reload}
                                        heightAndWidth="20px"
                                        hoverOff
                                    />
                                    <TextInput
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={this.state.passwordConfirm}
                                        onChange={(e) => {
                                            this.processEvent(
                                                'editPasswordConfirm',
                                                {
                                                    value: e.target.value,
                                                },
                                            )
                                            this.checkPasswordMatch(
                                                e.target.value,
                                            )
                                        }}
                                        onKeyDown={handleEnter(() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        })}
                                    />
                                </TextInputContainer>
                                <ConfirmContainer>
                                    <PrimaryAction
                                        onClick={() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        }}
                                        disabled={
                                            !(
                                                this.state.passwordMatch &&
                                                this.state.email.includes(
                                                    '@',
                                                ) &&
                                                this.state.email.includes(
                                                    '.',
                                                ) &&
                                                this.state.displayName.length >=
                                                    3
                                            )
                                        }
                                        label={'Sign Up'}
                                        fontSize={'14px'}
                                    />
                                    {this.renderAuthError()}
                                </ConfirmContainer>
                                {this.renderLoginTypeSwitcher()}
                            </EmailPasswordLogin>
                        </AuthenticationMethods>
                    </AuthBox>
                </StyledAuthDialog>
            )
        } else {
            return (
                <StyledAuthDialog>
                    <AuthBox top="medium">
                        <AuthenticationMethods>
                            <EmailPasswordLogin>
                                <TextInputContainer>
                                    <Icon
                                        filePath={icons.mail}
                                        heightAndWidth="20px"
                                        hoverOff
                                    />
                                    <TextInput
                                        type="email"
                                        placeholder="E-mail"
                                        value={this.state.email}
                                        onChange={(e) =>
                                            this.processEvent('editEmail', {
                                                value: e.target.value,
                                            })
                                        }
                                        onKeyDown={handleEnter(() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        })}
                                    />
                                </TextInputContainer>
                                <TextInputContainer>
                                    <Icon
                                        filePath={icons.lockFine}
                                        heightAndWidth="20px"
                                        hoverOff
                                    />
                                    <TextInput
                                        type="password"
                                        placeholder="Password"
                                        value={this.state.password}
                                        onChange={(e) =>
                                            this.processEvent('editPassword', {
                                                value: e.target.value,
                                            })
                                        }
                                        onKeyDown={handleEnter(() => {
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        })}
                                    />
                                </TextInputContainer>
                                <ConfirmContainer>
                                    <PrimaryAction
                                        onClick={() =>
                                            this.processEvent(
                                                'emailPasswordConfirm',
                                                null,
                                            )
                                        }
                                        disabled={
                                            !(
                                                this.state.password.length >
                                                    0 &&
                                                this.state.email.includes(
                                                    '@',
                                                ) &&
                                                this.state.email.includes('.')
                                            )
                                        }
                                        label={'Login'}
                                        fontSize={'14px'}
                                    />
                                    {this.renderAuthError()}
                                </ConfirmContainer>
                                {this.renderLoginTypeSwitcher()}
                            </EmailPasswordLogin>
                        </AuthenticationMethods>
                    </AuthBox>
                </StyledAuthDialog>
            )
        }
    }

    private renderLoginTypeSwitcher() {
        return (
            <Footer>
                {this.state.mode === 'login' && (
                    <>
                        Don’t have an account?{' '}
                        <ModeSwitch
                            onClick={() =>
                                this.processEvent('toggleMode', null)
                            }
                        >
                            Sign up
                        </ModeSwitch>
                    </>
                )}
                {this.state.mode === 'signup' && (
                    <>
                        Already have an account?{' '}
                        <ModeSwitch
                            onClick={() =>
                                this.processEvent('toggleMode', null)
                            }
                        >
                            Log in
                        </ModeSwitch>
                    </>
                )}
            </Footer>
        )
    }

    renderAuthError() {
        const { state } = this

        const error = (text: string) => {
            return (
                <Margin vertical={'medium'}>
                    <EmailPasswordError>{text}</EmailPasswordError>
                </Margin>
            )
        }

        if (state.error) {
            return error(FRIENDLY_ERRORS[state.error])
        }

        if (state.saveState === 'error') {
            const action = state.mode === 'login' ? 'log you in' : 'sign you up'
            return error(
                `Something went wrong trying to ${action}. Please try again later.`,
            )
        }

        return null
    }

    render() {
        return this.state.mode === 'login' ? (
            <ContentBox>
                <LogoImg src={'/img/onlyIconLogo.svg'} />
                <Title>Welcome back!</Title>
                <DescriptionText />
                {this.renderAuthForm()}
            </ContentBox>
        ) : (
            <ContentBox>
                <LogoImg src={'/img/onlyIconLogo.svg'} />
                <Title>Welcome to Memex</Title>
                <DescriptionText>
                    Create an account to get started
                </DescriptionText>
                {this.renderAuthForm()}
            </ContentBox>
        )
    }
}

const DisplayNameContainer = styled.div`
    display: grid;
    grid-gap: 5px;
    grid-auto-flow: row;
    justify-content: flex-start;
    align-items: center;
`

const InfoText = styled.div`
    color: ${(props) => props.theme.colors.lighterText};
    font-size: 12px;
    opacity: 0.7;
    padding-left: 10px;
`

const FeatureInfoBox = styled.div`
    display: grid;
    grid-gap: 10px;
    grid-auto-flow: row;
    justify-content: center;
    align-items: center;
`

const ConfirmContainer = styled.div`
    & > div {
        width: 100%;
        border-radius: 8px;
        height: 50px;
    }
`
const TextInputContainer = styled.div`
    display: flex;
    grid-auto-flow: column;
    grid-gap: 10px;
    align-items: center;
    justify-content: flex-start;
    border: 1px solid ${(props) => props.theme.colors.lineLightGrey};
    height: 50px;
    border-radius: 8px;
    width: 350px;
    padding: 0 15px;
`

const TextInput = styled.input`
    outline: none;
    height: fill-available;
    width: fill-available;
    color: ${(props) => props.theme.colors.lighterText};
    font-size: 14px;
    border: none;
    background: transparent;

    &::placeholder {
        color: ${(props) => props.theme.colors.lighterText};
    }
`

const WelcomeContainer = styled.div`
    display: flex;
    justify-content: space-between;
    overflow: hidden;
`

const LeftSide = styled.div`
    width: 60%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;

    @media (max-width: 1000px) {
        width: 100%;
    }
`

const LogoImg = styled.img`
    height: 50px;
    width: auto;
`

const ContentBox = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
`

const Title = styled.div`
    color: ${(props) => props.theme.colors.darkerText};
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 10px;
    margin-top: 30px;
`

const DescriptionText = styled.div`
    color: ${(props) => props.theme.colors.normalText};
    font-size: 18px;
    font-weight: normal;
    margin-bottom: 30px;
    text-align: center;
`

const RightSide = styled.div`
    width: 40%;
    background-image: url('img/onboardingBackground1.svg');
    height: 100vh;
    background-size: cover;
    background-repeat: no-repeat;
    display: grid;
    grid-auto-flow: row;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 100px 0 50px 0;
    overflow: hidden;

    @media (max-width: 1000px) {
        display: none;
    }
`

const CommentDemo = styled.img`
    height: 70%;
    width: auto;
    margin: auto;
`

const TitleSmall = styled.div`
    color: ${(props) => props.theme.colors.darkerText};
    font-size: 22px;
    font-weight: 800;
    text-align: center;
`

const StyledAuthDialog = styled.div`
    font-family: 'Inter';
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
`
const AuthenticationMethods = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  }
`
const EmailPasswordLogin = styled.div`
    display: grid;
    grid-auto-flow: row;
    grid-gap: 15px;
    justify-content: center;
    align-items: center;
`

const EmailPasswordError = styled.div`
    color: red;
    font-weight: bold;
    text-align: center;
`

const AuthBox = styled(Margin)`
    display: flex;
    justify-content: center;
    width: 100%;
`

const Footer = styled.div`
    text-align: center;
    user-select: none;
    color: ${(props) => props.theme.colors.darkerText};
    font-size: 14px;
    opacity: 0.8;
`
const ModeSwitch = styled.span`
    cursor: pointer;
    font-weight: bold;
    color: ${(props) => props.theme.colors.purple};
    font-weight: 14px;
`

function handleEnter(f: () => void) {
    const handler = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.keyCode === 13) {
            f()
        }
    }
    return handler
}
