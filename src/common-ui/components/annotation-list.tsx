import React, { Component, MouseEventHandler } from 'react'
import cx from 'classnames'

import analytics from 'src/analytics'
import { Annotation as AnnotationFlawed } from 'src/annotations/types'
import { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import {
    AnnotationSharingInfo,
    AnnotationSharingAccess,
} from 'src/content-sharing/ui/types'
import {
    contentSharing,
    auth,
    tags,
    collections,
} from 'src/util/remote-functions-background'
// import SingleNoteShareMenu from 'src/overview/sharing/SingleNoteShareMenu'
import { INIT_FORM_STATE } from 'src/sidebar/annotations-sidebar/containers/logic'
import type {
    EditForm,
    EditForms,
} from 'src/sidebar/annotations-sidebar/containers/types'
import { copyToClipboard } from 'src/annotations/content_script/utils'
import { ContentSharingInterface } from 'src/content-sharing/background/types'
import { RemoteCopyPasterInterface } from 'src/copy-paster/background/types'
import { linkStreams } from 'openpgp'
import { getAnnotationPrivacyState } from '@worldbrain/memex-common/lib/content-sharing/utils'

const styles = require('./annotation-list.css')

// TODO (sidebar-refactor): somewhere this type regressed and `isBookmarked` got
//  changed to `hasBookmark`
type Annotation = Omit<AnnotationFlawed, 'isBookmarked'> & {
    hasBookmark: boolean
}

export interface Props {
    activeShareMenuNoteId: string | undefined
    activeTagPickerNoteId: string | undefined
    activeListPickerNoteId: string | undefined
    activeCopyPasterAnnotationId: string | undefined
    /** Override for expanding annotations by default */
    isExpandedOverride: boolean
    /** Array of matched annotations, limited to 3 */
    annotations: Annotation[]
    /** URL of the page to which these annotations belong */
    pageUrl: string
    /** Opens the annotation sidebar with all of the annotations */
    openAnnotationSidebar: MouseEventHandler
    goToAnnotation: (annotation: Annotation) => void
    handleEditAnnotation: (url: string, comment: string, tags: string[]) => void
    handleDeleteAnnotation: (url: string) => void
    setActiveTagPickerNoteId: (id: string) => void
    setActiveListPickerNoteId: (id: string) => void
    setActiveShareMenuNoteId?: (id: string) => void
    setActiveCopyPasterAnnotationId?: (id: string) => void
    contentSharing: ContentSharingInterface
    copyPaster: RemoteCopyPasterInterface
}

interface SharingInfo {
    [annotationUrl: string]: AnnotationSharingInfo
}

interface State {
    /** Boolean to denote whether the list is expanded or not */
    isExpanded: boolean
    /** The previous prop to compare in getDerivedStateFromProps */
    prevIsExpandedOverride: boolean
    /** Received annotations are stored and manipulated through edit/delete */
    annotations: Annotation[]
    editForms: EditForms
    annotationsSharingInfo: SharingInfo
    sharingAccess: AnnotationSharingAccess
}

class AnnotationList extends Component<Props, State> {
    private authBG = auth
    private tagsBG = tags
    private collectionsBG = collections
    private contentShareBG = contentSharing

    state: State = {
        /* The initial value is set to the isExpandedOverride which is
        fetched from localStorage. */
        isExpanded: this.props.isExpandedOverride,
        prevIsExpandedOverride: this.props.isExpandedOverride,
        // TODO: This shouldn't be in state - get it out and ensure wherever it gets passed down as props from properly handles state mutations
        annotations: this.props.annotations,
        editForms: this.props.annotations.reduce(
            (acc, curr) => ({
                ...acc,
                [curr.url]: {
                    ...INIT_FORM_STATE,
                    commentText: curr.comment,
                    tags: curr.tags,
                },
            }),
            {},
        ),
        sharingAccess: 'sharing-allowed',
        annotationsSharingInfo: {},
    }

    /**
     * We compare if the previous isExpandedOverride prop is different from
     * the current isExpandedOverride, then we set the state accordingly.
     */
    static getDerivedStateFromProps(props: Props, state: State): State {
        if (props.isExpandedOverride !== state.prevIsExpandedOverride) {
            return {
                ...state,
                isExpanded: props.isExpandedOverride,
                prevIsExpandedOverride: props.isExpandedOverride,
            }
        }
        return state
    }

    async componentDidMount() {
        await this.detectSharedAnnotations()
    }

    private async detectSharedAnnotations() {
        const annotationSharingInfo: SharingInfo = {}
        const annotationUrls = this.props.annotations.map((a) => a.url)
        const remoteIds = await this.contentShareBG.getRemoteAnnotationIds({
            annotationUrls,
        })
        for (const localId of Object.keys(remoteIds)) {
            annotationSharingInfo[localId] = {
                status: 'shared',
                taskState: 'pristine',
                privacyLevel: AnnotationPrivacyLevels.SHARED,
            }
        }
        this.setState(() => ({
            annotationsSharingInfo: annotationSharingInfo,
        }))
    }

    // private updateAnnotationShareState = (annotationUrl: string) => (
    //     info: AnnotationSharingInfo,
    // ) =>
    //     this.setState((state) => ({
    //         annotationsSharingInfo: {
    //             ...state.annotationsSharingInfo,
    //             [annotationUrl]: info,
    //         },
    //     }))

    // private toggleIsExpanded = () => {
    //     this.setState(
    //         (prevState: State): State => ({
    //             ...prevState,
    //             isExpanded: !prevState.isExpanded,
    //         }),
    //     )
    // }

    // private handleEditAnnotation = (url: string) => () => {
    //     const { annotations, editForms } = this.state

    //     const index = annotations.findIndex((annot) => annot.url === url)
    //     const form = editForms[url]
    //     const annotation: Annotation = annotations[index]

    //     if (
    //         !annotation ||
    //         (!annotation.body &&
    //             !form.commentText?.length &&
    //             !form.tags?.length)
    //     ) {
    //         return
    //     }

    //     const newAnnotations: Annotation[] = [
    //         ...annotations.slice(0, index),
    //         {
    //             ...annotation,
    //             comment: form.commentText,
    //             tags: form.tags,
    //             lastEdited: new Date(),
    //         },
    //         ...annotations.slice(index + 1),
    //     ]

    //     this.props.handleEditAnnotation(url, form.commentText, form.tags)

    //     this.setState((state) => ({
    //         annotations: newAnnotations,
    //         annotationModes: { ...state.annotationModes, [url]: 'default' },
    //         editForms: {
    //             ...state.editForms,
    //             [url]: {
    //                 ...INIT_FORM_STATE,
    //                 commentText: state.editForms[url].commentText,
    //                 tags: state.editForms[url].tags,
    //             },
    //         },
    //     }))
    // }

    // private handleDeleteAnnotation = (url: string) => () => {
    //     this.props.handleDeleteAnnotation(url)

    //     // Delete the annotation in the state too
    //     const { annotations } = this.state
    //     const index = this.state.annotations.findIndex(
    //         (annot) => annot.url === url,
    //     )
    //     const newAnnotations = [
    //         ...annotations.slice(0, index),
    //         ...annotations.slice(index + 1),
    //     ]
    //     this.setState({
    //         annotations: newAnnotations,
    //     })
    // }

    // private handleGoToAnnotation = (annotation: Annotation) => () => {
    //     this.props.goToAnnotation(annotation)
    // }

    // private handleTagPickerClick = (url: string) => () => {
    //     this.props.setActiveTagPickerNoteId(url)
    // }
    // private handleListPickerClick = (url: string) => () => {
    //     this.props.setActiveListPickerNoteId(url)
    // }

    // private handleEditCancel = (url: string, commentText: string) => () =>
    //     this.setState((state) => ({
    //         annotationModes: { [url]: 'default' },
    //         editForms: {
    //             ...state.editForms,
    //             [url]: {
    //                 ...state.editForms[url],
    //                 commentText,
    //             },
    //         },
    //     }))

    // private handleShareClick = (url: string) => () => {
    //     if (this.props.setActiveShareMenuNoteId != null) {
    //         this.props.setActiveShareMenuNoteId(url)
    //     }
    // }

    // private renderTagPicker(annot: Annotation) {
    //     if (this.props.activeTagPickerNoteId !== annot.url) {
    //         return null
    //     }

    //     return (
    //         <div className={styles.hoverBoxWrapper}>
    //             <HoverBox>
    //                 {/* <TagPicker
    //                     onUpdateEntrySelection={(args) =>
    //                         this.tagsBG.updateTagForPage({
    //                             ...args,
    //                             url: annot.url,
    //                         })
    //                     }
    //                     initialSelectedEntries={() => annot.tags}
    //                     onClickOutside={() =>
    //                         this.props.setActiveTagPickerNoteId(undefined)
    //                     }
    //                 /> */}
    //             </HoverBox>
    //         </div>
    //     )
    // }
    // private renderListPicker(annot: Annotation) {
    //     if (this.props.activeListPickerNoteId !== annot.url) {
    //         return null
    //     }

    //     return (
    //         <div className={styles.hoverBoxWrapper}>
    //             <HoverBox>
    //                 {/* <CollectionPicker
    //                     onUpdateEntrySelection={async (args) => {
    //                         //  TODO implement picker
    //                         const name = args.added ?? args.deleted
    //                         const list = await this.collectionsBG.fetchListByName(
    //                             { name },
    //                         )
    //                         const id = list.id
    //                         if (args.added != null) {
    //                             this.contentShareBG.shareAnnotationToSomeLists({
    //                                 annotationUrl: annot.url,
    //                                 localListIds: [id],
    //                             })
    //                         } else if (args.deleted != null) {
    //                             this.contentShareBG.unshareAnnotationFromSomeLists(
    //                                 {
    //                                     annotationUrl: annot.url,
    //                                     localListIds: [id],
    //                                 },
    //                             )
    //                         }
    //                     }}
    //                     initialSelectedEntries={() => annot.lists}
    //                     onClickOutside={() =>
    //                         this.props.setActiveListPickerNoteId(undefined)
    //                     }
    //                 /> */}
    //             </HoverBox>
    //         </div>
    //     )
    // }

    // private renderCopyPasterManager(annot: Annotation) {
    //     if (this.props.activeCopyPasterAnnotationId !== annot.url) {
    //         return null
    //     }

    //     return (
    //         <div className={styles.hoverBoxWrapper}>
    //             <HoverBox>
    //                 <PageNotesCopyPaster
    //                     copyPaster={this.props.copyPaster}
    //                     annotationUrls={[annot.url]}
    //                     normalizedPageUrls={[annot.pageUrl]}
    //                     onClickOutside={() =>
    //                         this.props.setActiveCopyPasterAnnotationId?.(
    //                             undefined,
    //                         )
    //                     }
    //                 />
    //             </HoverBox>
    //         </div>
    //     )
    // }

    // private renderShareMenu(annot: Annotation) {
    //     if (this.props.activeShareMenuNoteId !== annot.url) {
    //         return null
    //     }

    //     return (
    //         <div className={styles.hoverBoxWrapper}>
    //             <HoverBox>
    //                 {/* <SingleNoteShareMenu
    //                     contentSharingBG={this.props.contentSharing}
    //                     copyLink={async (link) => {
    //                         analytics.trackEvent({
    //                             category: 'ContentSharing',
    //                             action: 'copyNoteLink',
    //                         })

    //                         await copyToClipboard(link)
    //                     }}
    //                     annotationUrl={annot.url}
    //                     postShareHook={(state) => {
    //                         const privacyState = getAnnotationPrivacyState(
    //                             state.privacyLevel,
    //                         )
    //                         return this.updateAnnotationShareState(annot.url)({
    //                             status: privacyState.public
    //                                 ? 'shared'
    //                                 : 'unshared',
    //                             taskState: 'success',
    //                             privacyLevel: privacyState.protected
    //                                 ? AnnotationPrivacyLevels.PROTECTED
    //                                 : undefined,
    //                         })
    //                     }}
    //                     closeShareMenu={() =>
    //                         this.props.setActiveShareMenuNoteId?.(undefined)
    //                     }
    //                 /> */}
    //             </HoverBox>
    //         </div>
    //     )
    // }

    private handleEditFormUpdate = (
        url: string,
        deriveState: (state: State) => Partial<EditForm>,
    ) => {
        this.setState((state) => ({
            editForms: {
                ...state.editForms,
                [url]: {
                    ...state.editForms[url],
                    ...deriveState(state),
                },
            },
        }))
    }

    private renderAnnotations() {
        return null
        // return this.state.annotations.map((annot) => (
        //     <AnnotationEditable
        //         getListDetailsById={(i) => ({
        //             name: 'dead code',
        //             isShared: false,
        //         })}
        //         key={annot.url}
        //         {...annot}
        //         body={annot.body}
        //         comment={annot.comment}
        //         className={styles.annotation}
        //         createdWhen={annot.createdWhen!}
        //         isShared={false}
        //         isBulkShareProtected={false}
        //         mode={this.state.annotationModes[annot.url]}
        //         onGoToAnnotation={this.handleGoToAnnotation(annot)}
        //         renderShareMenuForAnnotation={() => this.renderShareMenu(annot)}
        //         renderCopyPasterForAnnotation={() =>
        //             this.renderCopyPasterManager(annot)
        //         }
        //         renderTagsPickerForAnnotation={() =>
        //             this.renderTagPicker(annot)
        //         }
        //         renderListsPickerForAnnotation={() =>
        //             this.renderListPicker(annot)
        //         }
        //         annotationEditDependencies={{
        //             comment: this.state.editForms[annot.url].commentText,
        //             onCommentChange: (commentText) =>
        //                 this.handleEditFormUpdate(annot.url, () => ({
        //                     commentText,
        //                 })),
        //             onEditCancel: this.handleEditCancel(
        //                 annot.url,
        //                 annot.comment,
        //             ),
        //             onEditConfirm: () => this.handleEditAnnotation(annot.url),
        //         }}
        //         annotationFooterDependencies={{
        //             onEditIconClick: () =>
        //                 this.setState({
        //                     annotationModes: {
        //                         [annot.url]: 'edit',
        //                     },
        //                 }),
        //             onDeleteCancel: this.handleEditCancel(
        //                 annot.url,
        //                 annot.comment,
        //             ),
        //             onDeleteConfirm: this.handleDeleteAnnotation(annot.url),
        //             onDeleteIconClick: () =>
        //                 this.setState({
        //                     annotationModes: { [annot.url]: 'delete' },
        //                 }),
        //             onTagIconClick: this.handleTagPickerClick(annot.url),
        //             onListIconClick: this.handleListPickerClick(annot.url),
        //             onShareClick: this.handleShareClick(annot.url),
        //             onCopyPasterBtnClick:
        //                 this.props.setActiveCopyPasterAnnotationId != null
        //                     ? () =>
        //                           this.props.setActiveCopyPasterAnnotationId(
        //                               annot.url,
        //                           )
        //                     : undefined,
        //         }}
        //     />
        // ))
    }

    render() {
        const { isExpanded } = this.state
        return undefined
        // <div
        //     className={cx({
        //         [styles.parentExpanded]: isExpanded,
        //     })}
        // >
        //     {/* Annotation count text and toggle arrow */}
        //     <div
        //         className={cx(styles.resultCount, {
        //             [styles.expandedCount]: this.state.isExpanded,
        //         })}
        //         onClick={this.toggleIsExpanded}
        //     >
        //         <b>{this.props.annotations.length}</b>{' '}
        //         <span className={styles.resultsText}>results</span>
        //         <span
        //             className={cx(styles.icon, {
        //                 [styles.inverted]: this.state.isExpanded,
        //             })}
        //         />
        //     </div>

        //     {/* Container for displaying AnnotationBox */}
        //     <div className={styles.annotationList}>
        //         {isExpanded ? this.renderAnnotations() : null}
        //     </div>
        // </div>
    }
}

export default AnnotationList
