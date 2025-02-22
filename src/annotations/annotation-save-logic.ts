import { getNoteShareUrl } from 'src/content-sharing/utils'
import type { AnnotationInterface } from './background/types'
import type { ContentSharingInterface } from 'src/content-sharing/background/types'
import type { Anchor } from 'src/highlighting/types'
import { copyToClipboard } from './content_script/utils'
import { shareOptsToPrivacyLvl } from './utils'
import type { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import { SyncSettingsBackground } from 'src/sync-settings/background'
import {
    SyncSettingsStore,
    createSyncSettingsStore,
} from 'src/sync-settings/util'
import { RemoteSyncSettingsInterface } from 'src/sync-settings/background/types'
import { PkmSyncInterface } from 'src/pkm-integrations/background/types'

export interface AnnotationShareOpts {
    shouldShare?: boolean
    shouldCopyShareLink?: boolean
    isBulkShareProtected?: boolean
    skipPrivacyLevelUpdate?: boolean
}

type AnnotationCreateData = {
    fullPageUrl: string
    pageTitle?: string
    localId?: string
    createdWhen?: Date
    selector?: Anchor
    localListIds?: number[]
} & ({ body: string; comment?: string } | { body?: string; comment: string })

interface AnnotationUpdateData {
    localId: string
    comment: string | null
}

export interface SaveAnnotationParams<
    T extends AnnotationCreateData | AnnotationUpdateData
> {
    annotationData: T
    annotationsBG: AnnotationInterface<'caller'>
    contentSharingBG: ContentSharingInterface
    shareOpts?: AnnotationShareOpts
    skipPageIndexing?: boolean
    keepListsIfUnsharing?: boolean
    skipListExistenceCheck?: boolean
    privacyLevelOverride?: AnnotationPrivacyLevels
    syncSettingsBG?: RemoteSyncSettingsInterface
    pkmSyncBG?: PkmSyncInterface
}

export interface SaveAnnotationReturnValue {
    remoteAnnotationId: string | null
    savePromise: Promise<string>
}

async function checkIfAutoCreateLink(
    syncSettingsBG: RemoteSyncSettingsInterface,
) {
    let syncSettings: SyncSettingsStore<'extension'>

    syncSettings = createSyncSettingsStore({
        syncSettingsBG: syncSettingsBG,
    })

    let existingSetting = await syncSettings.extension.get(
        'shouldAutoCreateNoteLink',
    )

    if (existingSetting == null) {
        await syncSettings.extension.set('shouldAutoCreateNoteLink', true)
        existingSetting = true
    }

    return existingSetting
}

export async function createAnnotation({
    annotationData,
    annotationsBG,
    contentSharingBG,
    pkmSyncBG,
    syncSettingsBG,
    skipPageIndexing,
    skipListExistenceCheck,
    privacyLevelOverride,
    shareOpts,
}: SaveAnnotationParams<AnnotationCreateData>): Promise<
    SaveAnnotationReturnValue
> {
    let remoteAnnotationId: string = null

    return {
        remoteAnnotationId,
        savePromise: (async () => {
            const annotationUrl = await annotationsBG.createAnnotation(
                {
                    url: annotationData.localId,
                    createdWhen: annotationData.createdWhen,
                    pageUrl: annotationData.fullPageUrl,
                    selector: annotationData.selector,
                    title: annotationData.pageTitle,
                    comment: annotationData.comment
                        .replace(/\\\[/g, '[')
                        .replace(/\\\]/g, ']')
                        .replace(/\\\(/g, '(')
                        .replace(/\\\)/g, ')'),
                    body: annotationData.body,
                },
                { skipPageIndexing },
            )

            if (shareOpts?.shouldShare) {
                await contentSharingBG.shareAnnotation({
                    annotationUrl,
                    remoteAnnotationId,
                    shareToParentPageLists: false,
                    skipPrivacyLevelUpdate: true,
                })
            }

            await contentSharingBG.setAnnotationPrivacyLevel({
                annotationUrl,
                privacyLevel:
                    privacyLevelOverride ?? shareOptsToPrivacyLvl(shareOpts),
            })

            if (annotationData.localListIds?.length) {
                await contentSharingBG.shareAnnotationToSomeLists({
                    annotationUrl,
                    skipListExistenceCheck,
                    localListIds: annotationData.localListIds,
                })
            }

            createAndCopyShareLink(
                remoteAnnotationId,
                annotationUrl,
                contentSharingBG,
                syncSettingsBG,
            )

            return annotationUrl
        })(),
    }
}

async function createAndCopyShareLink(
    remoteAnnotationId,
    annotationUrl,
    contentSharingBG,
    syncSettingsBG,
) {
    let shouldShareLink = await checkIfAutoCreateLink(syncSettingsBG)

    if (shouldShareLink) {
        remoteAnnotationId = await contentSharingBG.generateRemoteAnnotationId()
        copyToClipboard(getNoteShareUrl({ remoteAnnotationId }))
    }

    await contentSharingBG.shareAnnotation({
        annotationUrl: annotationUrl,
        remoteAnnotationId: remoteAnnotationId,
        shareToParentPageLists: false,
        skipPrivacyLevelUpdate: true,
    })
}

export async function updateAnnotation({
    annotationData,
    annotationsBG,
    contentSharingBG,
    shareOpts,
    keepListsIfUnsharing,
    pkmSyncBG,
}: SaveAnnotationParams<AnnotationUpdateData>): Promise<
    SaveAnnotationReturnValue
> {
    let remoteAnnotationId: string = null
    if (shareOpts?.shouldShare) {
        const remoteAnnotMetadata = await contentSharingBG.getRemoteAnnotationMetadata(
            { annotationUrls: [annotationData.localId] },
        )

        remoteAnnotationId =
            (remoteAnnotMetadata[annotationData.localId]?.remoteId as string) ??
            (await contentSharingBG.generateRemoteAnnotationId())

        if (shareOpts.shouldCopyShareLink) {
            await copyToClipboard(getNoteShareUrl({ remoteAnnotationId }))
        }
    }

    return {
        remoteAnnotationId,
        savePromise: (async () => {
            if (annotationData.comment != null) {
                await annotationsBG.editAnnotation(
                    annotationData.localId,
                    annotationData.comment
                        .replace(/\\\[/g, '[')
                        .replace(/\\\]/g, ']')
                        .replace(/\\\(/g, '(')
                        .replace(/\\\)/g, ')'),
                )
            }

            await Promise.all([
                shareOpts?.shouldShare &&
                    contentSharingBG.shareAnnotation({
                        remoteAnnotationId,
                        annotationUrl: annotationData.localId,
                        shareToParentPageLists: true,
                    }),
                !shareOpts?.skipPrivacyLevelUpdate &&
                    contentSharingBG.setAnnotationPrivacyLevel({
                        annotationUrl: annotationData.localId,
                        privacyLevel: shareOptsToPrivacyLvl(shareOpts),
                        keepListsIfUnsharing,
                    }),
            ])

            return annotationData.localId
        })(),
    }
}
