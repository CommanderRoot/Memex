import {
    UILogic,
    loadInitial,
    executeUITask,
    UIEventHandler,
} from '@worldbrain/memex-common/lib/main-ui/classes/logic'
import type { Dependencies, State, Event } from './types'
import delay from 'src/util/delay'
import { browser } from 'webextension-polyfill-ts'
import {
    TypedRemoteEventEmitter,
    getRemoteEventEmitter,
} from 'src/util/webextensionRPC'

type EventHandler<EventName extends keyof Event> = UIEventHandler<
    State,
    Event,
    EventName
>

export default class Logic extends UILogic<State, Event> {
    syncPromise: Promise<any>
    isExistingUser = false
    action?: 'login' | 'register'
    hasLinkToOpen = false
    hasAccountSynced = false
    personalCloudEvents: TypedRemoteEventEmitter<'personalCloud'>

    constructor(private dependencies: Dependencies) {
        super()
    }

    getInitialState = (): State => ({
        step: 'tutorial',
        loadState: 'running',
        syncState: 'pristine',
        shouldShowLogin: true,
        newSignUp: false,
        mode: 'signup',
        email: '',
        password: '',
        displayName: '',
        passwordMatch: false,
        passwordConfirm: '',
        preventOnboardingFlow: false,
        autoLoginState: 'pristine',
        showSyncNotification: false,
        showOnboardingVideo: false,
    })

    async init() {
        const { authBG } = this.dependencies
        this.emitMutation({
            mode: { $set: 'signup' },
            loadState: { $set: 'running' },
        })

        if (await this.checkIfMemexSocialTabOpen()) {
            this.emitMutation({
                autoLoginState: { $set: 'running' },
            })
            await this.autoLoginAvailable()

            if (this.hasAccountSynced) {
                await this.checkIfAutoOpenLinkAvailable()
                await this._onUserLogIn(false)
            } else {
                this.emitMutation({
                    loadState: { $set: 'pristine' },
                    autoLoginState: { $set: 'pristine' },
                })
            }
        } else {
            await loadInitial(this, async () => {
                const user = await authBG.getCurrentUser()
                if (user != null) {
                    this.isExistingUser = true
                    await this._onUserLogIn(false)
                }
            })
        }
    }

    private autoLoginAvailable = async () => {
        let user = undefined
        let retries = 0
        let maxRetries = 30
        while (user == null && retries !== maxRetries + 1) {
            user = await this.dependencies.authBG.getCurrentUser()

            if (user != null) {
                this.hasAccountSynced = true
                this.isExistingUser = true
                return true
            } else {
                retries++
                if (retries === maxRetries) {
                    return false
                }
                await delay(500)
            }
        }
    }

    private openLinkIfAvailable = async () => {
        let linkAvailable = false
        let payLoad
        let retries = 0
        let maxRetries = 20

        while (!linkAvailable && retries !== maxRetries + 1) {
            const linkToOpen = await browser.storage.local.get('@URL_TO_OPEN')
            if (linkToOpen['@URL_TO_OPEN'] != null) {
                payLoad = linkToOpen['@URL_TO_OPEN']
                await browser.storage.local.remove('@URL_TO_OPEN')
                if (payLoad.type === 'pageToOpen') {
                    await this.dependencies.contentScriptsBG.openPageWithSidebarInSelectedListMode(
                        {
                            fullPageUrl: payLoad.originalPageUrl,
                            sharedListId: payLoad.sharedListId,
                        },
                    )
                }
                if (payLoad.type === 'returnToFollowedSpace') {
                    await browser.tabs
                        .query({
                            url: payLoad.originalPageUrl,
                            currentWindow: true,
                        })
                        .then((tab) => {
                            browser.tabs.update(tab[0].id, { active: true })
                        })
                }
                return true
            } else {
                retries++
                if (retries === maxRetries) {
                    return false
                }
                await delay(500)
            }
        }
    }

    private checkIfAutoOpenLinkAvailable = async () => {
        let linkAvailable = false
        let retries = 0
        let maxRetries = 8

        while (!linkAvailable && retries !== maxRetries + 1) {
            const linkToOpen = await browser.storage.local.get('@URL_TO_OPEN')
            if (linkToOpen['@URL_TO_OPEN'] != null) {
                this.hasLinkToOpen = true
                this.emitMutation({
                    preventOnboardingFlow: { $set: true },
                })
                return true
            } else {
                retries++
                if (retries === maxRetries) {
                    return false
                }
                await delay(500)
            }
        }
    }

    private checkIfMemexSocialTabOpen = async () => {
        const tabsFromExtApi = browser.tabs
        const tabs = await tabsFromExtApi.query({
            url: ['https://*.memex.social/*', 'http://localhost:3000/*'],
        })
        if (tabs.length > 0) {
            return true
        }
    }

    private async _onUserLogIn(newSignUp: boolean) {
        this.emitMutation({
            newSignUp: { $set: newSignUp },
            loadState: { $set: 'running' },
        })

        if ((await this.dependencies.authBG.getCurrentUser()) != null) {
            this.syncPromise = executeUITask(this, 'syncState', async () =>
                this.dependencies.personalCloudBG.enableCloudSyncForNewInstall(),
            )

            if (this.hasLinkToOpen) {
                await this.openLinkIfAvailable()
                window.close()
            } else {
                // check if user has been coming from Google or Twitter login & if they account creation was in the last 10s
                if (!newSignUp) {
                    const provider = await (
                        await this.dependencies.authBG.getCurrentUser()
                    ).provider
                    const creationTime = await (
                        await this.dependencies.authBG.getCurrentUser()
                    ).creationTime

                    const now = Math.floor(Date.now() / 1000)

                    const unixCreationTime = Math.floor(
                        new Date(creationTime).getTime() / 1000,
                    )
                    if (
                        now - unixCreationTime < 20 &&
                        (provider === 'google.com' ||
                            provider === 'twitter.com')
                    ) {
                        this.emitMutation({
                            showOnboardingSelection: { $set: true },
                            loadState: { $set: 'success' },
                        })
                    } else {
                        this.emitMutation({
                            showSyncNotification: { $set: true },
                            loadState: { $set: 'success' },
                        })
                        this.personalCloudEvents = getRemoteEventEmitter(
                            'personalCloud',
                        )
                        this.personalCloudEvents.on(
                            'cloudStatsUpdated',
                            async ({ stats }) => {
                                if (
                                    stats.pendingDownloads === 0 &&
                                    stats.pendingUploads === 0
                                ) {
                                    setTimeout(() => {
                                        if (
                                            stats.pendingDownloads === 0 &&
                                            stats.pendingUploads === 0
                                        ) {
                                            this.dependencies.navToDashboard()
                                        }
                                    }, 5000)
                                }
                            },
                        )
                    }
                } else {
                    this.emitMutation({
                        showOnboardingSelection: { $set: true },
                    })
                }
            }
        } else {
            this.emitMutation({
                loadState: { $set: 'error' },
            })
        }
    }

    showOnboardingVideo: EventHandler<'showOnboardingVideo'> = async ({
        previousState,
        event,
    }) => {
        this.emitMutation({
            showOnboardingVideo: { $set: !previousState.showOnboardingVideo },
        })
    }

    onUserLogIn: EventHandler<'onUserLogIn'> = async ({ event }) => {
        this.emitMutation({
            loadState: { $set: 'running' },
        })
        await this.checkIfAutoOpenLinkAvailable()
        await this._onUserLogIn(!!event.newSignUp)
    }

    goToSyncStep: EventHandler<'goToSyncStep'> = async ({ previousState }) => {
        if (!this.isExistingUser && !previousState.newSignUp) {
            this.emitMutation({ step: { $set: 'sync' } })

            await (previousState.syncState === 'success'
                ? delay(3000)
                : this.syncPromise)
        }
        this.dependencies.navToDashboard()
    }

    setAuthDialogMode: EventHandler<'setAuthDialogMode'> = ({ event }) => {
        return { authDialogMode: { $set: event.mode } }
    }
}
