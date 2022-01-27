import type TypedEventEmitter from 'typed-emitter'
import { EventEmitter } from 'events'

import { Annotation } from 'src/annotations/types'
import { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import type { RemoteTagsInterface } from 'src/tags/background/types'
import type { AnnotationInterface } from 'src/annotations/background/types'
import {
    AnnotationsSorter,
    sortByPagePosition,
} from 'src/sidebar/annotations-sidebar/sorting'
import { haveTagsChanged } from 'src/util/have-tags-changed'
import type {
    AnnotationSharingState,
    ContentSharingInterface,
} from 'src/content-sharing/background/types'
import {
    createAnnotation,
    updateAnnotation,
    AnnotationShareOpts,
} from './annotation-save-logic'
import {
    PageList,
    RemoteCollectionsInterface,
} from 'src/custom-lists/background/types'
import { getAnnotationPrivacyState } from '@worldbrain/memex-common/lib/content-sharing/utils'

export type CachedAnnotation = Annotation

export const createAnnotationsCache = (
    bgModules: {
        tags: RemoteTagsInterface
        customLists: RemoteCollectionsInterface
        annotations: AnnotationInterface<'caller'>
        contentSharing: ContentSharingInterface
    },
    options: { skipPageIndexing?: boolean } = {},
): AnnotationsCache =>
    new AnnotationsCache({
        getListFromId: async (id: number) =>
            bgModules.customLists.fetchListById({ id }),
        sortingFn: sortByPagePosition,
        backendOperations: {
            load: async (pageUrl) => {
                const annotations = await bgModules.annotations.listAnnotationsByPageUrl(
                    {
                        pageUrl,
                        withTags: true,
                        withLists: true,
                    },
                )

                const annotationUrls = annotations.map((a) => a.url)
                const privacyLevels = await bgModules.contentSharing.findAnnotationPrivacyLevels(
                    {
                        annotationUrls,
                    },
                )

                return annotations.map((a) => ({
                    ...a,
                    isShared: [
                        AnnotationPrivacyLevels.SHARED,
                        AnnotationPrivacyLevels.SHARED_PROTECTED,
                    ].includes(privacyLevels[a.url]),
                    isBulkShareProtected: [
                        AnnotationPrivacyLevels.PROTECTED,
                        AnnotationPrivacyLevels.SHARED_PROTECTED,
                    ].includes(privacyLevels[a.url]),
                }))
            },
            create: async (annotation, shareOpts) => {
                const { savePromise } = await createAnnotation({
                    shareOpts,
                    annotationsBG: bgModules.annotations,
                    contentSharingBG: bgModules.contentSharing,
                    skipPageIndexing: options.skipPageIndexing,
                    annotationData: {
                        localId: annotation.url,
                        body: annotation.body,
                        comment: annotation.comment,
                        fullPageUrl: annotation.pageUrl,
                        createdWhen: annotation.createdWhen,
                        pageTitle: annotation.pageTitle,
                        selector: annotation.selector,
                    },
                })
                const localId = await savePromise
                return localId
            },
            update: async (annotation, shareOpts) => {
                const { savePromise } = await updateAnnotation({
                    shareOpts,
                    annotationsBG: bgModules.annotations,
                    contentSharingBG: bgModules.contentSharing,
                    skipPageIndexing: options.skipPageIndexing,
                    annotationData: {
                        comment: annotation.comment,
                        localId: annotation.url,
                    },
                })
                await savePromise
            },
            delete: async (annotation) =>
                bgModules.annotations.deleteAnnotation(annotation.url),
            updateTags: async (annotationUrl, tags) =>
                bgModules.tags.setTagsForAnnotation({
                    url: annotationUrl,
                    tags,
                }),

            updateLists: async (annotationUrl, listNames) => {
                const prevSharingState = await bgModules.contentSharing.getAnnotationSharingState(
                    { annotationUrl },
                )
                const existingListIds = prevSharingState.localListIds ?? []
                const existingLists = await Promise.all(
                    existingListIds.map((id) =>
                        bgModules.customLists
                            .fetchListById({ id })
                            .then((list) => list.id),
                    ),
                )

                const existingListsSet = new Set(existingLists)
                const newListsSet = new Set(listNames)

                const namesToAdd = listNames.filter(
                    (list) => !existingListsSet.has(list),
                )
                const toDelete = existingLists.filter(
                    (list) => !newListsSet.has(list),
                )
                if (namesToAdd.length) {
                    const existingListsToAdd = (
                        await Promise.all(
                            namesToAdd.map((id) =>
                                bgModules.customLists.fetchListById({ id }),
                            ),
                        )
                    ).filter((list) => list)
                    // TODO: uncomment this when we're able to assign non-shared lists to annotations
                    // Create non-existent lists
                    // const existingListNamesToAdd = existingListsToAdd.map(
                    //     (l) => l.name,
                    // )
                    // const createdIdsToAdd = await Promise.all(
                    //     namesToAdd
                    //         .filter((name) => !existingListNamesToAdd.includes(name))
                    //         .map((name) =>
                    //             bgModules.customLists.createCustomList({
                    //                 name: name,
                    //             }),
                    //         ),
                    // )

                    const {
                        sharingState,
                    } = await bgModules.contentSharing.shareAnnotationToSomeLists(
                        {
                            annotationUrl,
                            localListIds: [
                                ...existingListsToAdd.map((list) => list.id),
                                // TODO: uncomment this when we're able to assign non-shared lists to annotations
                                // ...createdIdsToAdd,
                            ],
                        },
                    )
                    return sharingState
                }
                if (toDelete.length) {
                    const toDeleteLists = await Promise.all(
                        toDelete.map((id) =>
                            bgModules.customLists.fetchListById({ id }),
                        ),
                    )
                    const {
                        sharingState,
                    } = await bgModules.contentSharing.unshareAnnotationFromSomeLists(
                        {
                            annotationUrl,
                            localListIds: toDeleteLists.map((list) => list.id),
                        },
                    )
                    return sharingState
                }
            },
        },
    })

interface AnnotationCacheChanges {
    rollback: (annotations: CachedAnnotation[]) => void
    newState: (annotation: CachedAnnotation[]) => void
    sorted: (annotations: CachedAnnotation[]) => void
    created: (annotation: CachedAnnotation) => void
    updated: (annotation: CachedAnnotation) => void
    deleted: (annotation: CachedAnnotation) => void
    load: (annotation: CachedAnnotation[]) => void
    noteAddedToRemote: (annotation: CachedAnnotation[]) => void
}

export type AnnotationCacheChangeEvents = TypedEventEmitter<
    AnnotationCacheChanges
>

export interface AnnotationsCacheDependencies {
    getListFromId: (id: number) => Promise<PageList>
    sortingFn: AnnotationsSorter
    backendOperations?: {
        load: (
            pageUrl: string,
            args?: { limit?: number; skip?: number },
        ) => Promise<CachedAnnotation[]> // url should become one concrete example of a contentFingerprint to load annotations for
        create: (
            annotation: CachedAnnotation,
            shareOpts?: AnnotationShareOpts,
        ) => Promise<string>
        update: (
            annotation: CachedAnnotation,
            shareOpts?: AnnotationShareOpts,
        ) => Promise<void>
        updateTags: (
            annotationUrl: CachedAnnotation['url'],
            tags: CachedAnnotation['tags'],
        ) => Promise<void>
        updateLists: (
            annotationUrl: CachedAnnotation['url'],
            lists: CachedAnnotation['lists'],
        ) => Promise<AnnotationSharingState>
        delete: (annotation: CachedAnnotation) => Promise<void>
    }
}

export interface AnnotationsCacheInterface {
    load: (
        pageUrl: string,
        args?: { limit?: number; skip?: number },
    ) => Promise<void>
    create: (
        annotation: Omit<CachedAnnotation, 'lastEdited' | 'createdWhen'>,
        shareOpts?: AnnotationShareOpts,
    ) => Promise<Annotation>
    update: (
        annotation: Omit<CachedAnnotation, 'lastEdited' | 'createdWhen'>,
        shareOpts?: AnnotationShareOpts,
    ) => Promise<void>
    delete: (
        annotation: Omit<CachedAnnotation, 'lastEdited' | 'createdWhen'>,
    ) => Promise<void>
    sort: (sortingFn?: AnnotationsSorter) => void
    getAnnotationById: (id: string) => CachedAnnotation

    annotations: CachedAnnotation[]
    readonly highlights: CachedAnnotation[]
    annotationChanges: AnnotationCacheChangeEvents
    isEmpty: boolean
}

export class AnnotationsCache implements AnnotationsCacheInterface {
    private _annotations: CachedAnnotation[] = []
    public annotationChanges = new EventEmitter() as AnnotationCacheChangeEvents

    constructor(private dependencies: AnnotationsCacheDependencies) {}

    set annotations(annotations: CachedAnnotation[]) {
        this._annotations = formatAnnotations(annotations)
    }

    get annotations(): CachedAnnotation[] {
        return this._annotations
    }

    get highlights(): CachedAnnotation[] {
        return this.annotations.filter((a) => a.body?.length > 0)
    }

    get isEmpty(): boolean {
        return this._annotations.length === 0
    }

    getAnnotationById = (id: string): CachedAnnotation =>
        this.annotations.find((annot) => annot.url === id)

    load = async (url: string, args = {}) => {
        const annotations = await this.dependencies.backendOperations.load(
            url,
            args,
        )

        this.annotations = annotations.sort(this.dependencies.sortingFn)
        this.annotationChanges.emit('load', this._annotations)
        this.annotationChanges.emit('newState', this.annotations)
    }

    sort = (sortingFn?: AnnotationsSorter) => {
        if (sortingFn) {
            this.dependencies.sortingFn = sortingFn
        }

        this._annotations = this._annotations.sort(this.dependencies.sortingFn)
        this.annotationChanges.emit('sorted', this._annotations)
        this.annotationChanges.emit('newState', this.annotations)
    }

    create: AnnotationsCacheInterface['create'] = async (
        annotation,
        shareOpts,
    ) => {
        const { backendOperations } = this.dependencies
        const stateBeforeModifications = this._annotations

        const annotUrl = await backendOperations.create(annotation, shareOpts)

        if (annotation.tags.length) {
            await backendOperations.updateTags(annotUrl, annotation.tags)
        }

        let annotAfterListUpdate = null
        let remoteLists = []
        if (annotation.lists.length) {
            const sharingState = await this.dependencies.backendOperations.updateLists(
                annotUrl,
                annotation.lists,
            )
            const newLists = await Promise.all(
                sharingState.localListIds.map((id) =>
                    this.dependencies.getListFromId(id),
                ),
            )
            remoteLists = newLists.filter((list) => list.remoteId)
            const newListNames = newLists.map((list) => list.name)
            const parsedPrivacyLevel = getAnnotationPrivacyState(
                sharingState.privacyLevel,
            )
            annotAfterListUpdate = {
                ...annotation,
                lastEdited: new Date(),
                isShared: shareOpts?.shouldShare ?? parsedPrivacyLevel.public,
                isBulkShareProtected:
                    shareOpts?.isBulkShareProtected ??
                    parsedPrivacyLevel.protected,
                lists: newListNames,
            }
        }

        const nextAnnotation = annotAfterListUpdate ?? {
            ...annotation,
            createdWhen: new Date(),
            isShared: shareOpts?.shouldShare,
            isBulkShareProtected: shareOpts?.isBulkShareProtected,
        }

        this.annotations = [nextAnnotation, ...stateBeforeModifications]

        this.annotationChanges.emit('created', nextAnnotation)
        this.annotationChanges.emit('newState', this.annotations)

        // try {
        // } catch (e) {
        //     this._annotations = stateBeforeModifications
        //     this.annotationChanges.emit('rollback', stateBeforeModifications)
        //     throw e
        // }
        return nextAnnotation
    }

    private maybeUpdateLists = async (
        annotation,
        previousAnnotation,
        shareOpts,
    ) => {
        // this is a function so we can get a return value while using only const
        if (haveTagsChanged(previousAnnotation.lists ?? [], annotation.lists)) {
            const sharingState = await this.dependencies.backendOperations.updateLists(
                annotation.url,
                annotation.lists,
            )
            const newLists = await Promise.all(
                sharingState.localListIds.map((id) =>
                    this.dependencies.getListFromId(id),
                ),
            )
            const newListNames = newLists.map((list) => list.name)
            const parsedPrivacyLevel = getAnnotationPrivacyState(
                sharingState.privacyLevel,
            )
            const annotAfterListUpdate = {
                ...annotation,
                lastEdited: new Date(),
                isShared: shareOpts?.shouldShare ?? parsedPrivacyLevel.public,
                isBulkShareProtected:
                    shareOpts?.isBulkShareProtected ??
                    parsedPrivacyLevel.protected,
                lists: newListNames,
            }
            return annotAfterListUpdate
        }
        return null
    }

    update: AnnotationsCacheInterface['update'] = async (
        annotation,
        shareOpts,
    ) => {
        const stateBeforeModifications = [...this._annotations]

        const resultIndex = stateBeforeModifications.findIndex(
            (existingAnnotation) => existingAnnotation.url === annotation.url,
        )

        const previousAnnotation = stateBeforeModifications[resultIndex]

        // Tags
        if (haveTagsChanged(previousAnnotation.tags ?? [], annotation.tags)) {
            await this.dependencies.backendOperations.updateTags(
                annotation.url,
                annotation.tags,
            )
        }
        // Lists

        const annotAfterListUpdate = await this.maybeUpdateLists(
            annotation,
            previousAnnotation,
            shareOpts,
        )
        const nextAnnotation = annotAfterListUpdate ?? {
            ...annotation,
            lastEdited: new Date(),
            isShared: shareOpts?.shouldShare ?? previousAnnotation.isShared,
            isBulkShareProtected:
                shareOpts?.isBulkShareProtected ??
                previousAnnotation.isBulkShareProtected,
        }

        this.annotations = [
            ...stateBeforeModifications.slice(0, resultIndex),
            nextAnnotation,
            ...stateBeforeModifications.slice(resultIndex + 1),
        ]

        this.annotationChanges.emit('updated', nextAnnotation)
        this.annotationChanges.emit('newState', this.annotations)

        try {
            const hasAnnotationChanged =
                previousAnnotation.comment.trim() !==
                    nextAnnotation.comment.trim() ||
                previousAnnotation.isShared !== nextAnnotation.isShared ||
                previousAnnotation.isBulkShareProtected !==
                    nextAnnotation.isBulkShareProtected

            if (hasAnnotationChanged) {
                await this.dependencies.backendOperations.update(
                    nextAnnotation,
                    shareOpts,
                )
            }
        } catch (e) {
            this._annotations = stateBeforeModifications
            this.annotationChanges.emit('rollback', stateBeforeModifications)
            throw e
        }
    }

    delete = async (annotation: CachedAnnotation) => {
        const stateBeforeModifications = this._annotations

        const resultIndex = this._annotations.findIndex(
            (existingAnnotation) => existingAnnotation.url === annotation.url,
        )

        this.annotations = [
            ...this._annotations.slice(0, resultIndex),
            ...this._annotations.slice(resultIndex + 1),
        ]

        this.annotationChanges.emit('deleted', annotation)
        this.annotationChanges.emit('newState', this.annotations)

        try {
            await this.dependencies.backendOperations.delete(annotation)
        } catch (e) {
            this._annotations = stateBeforeModifications
            this.annotationChanges.emit('rollback', stateBeforeModifications)
            throw e
        }
    }
}

function formatAnnotations(
    annotations: CachedAnnotation[],
): CachedAnnotation[] {
    return annotations.map((a) => ({
        ...a,
        tags: a.tags ?? [],
        isBookmarked: a.isBookmarked ?? false,
    }))
}
