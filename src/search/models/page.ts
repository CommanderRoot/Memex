import Storex from '@worldbrain/storex'

import { VisitInteraction } from '..'
import AbstractModel from './abstract-model'
import Visit from './visit'
import Bookmark from './bookmark'
import Tag from './tag'
import { DBGet } from '../types'
import { normalizeUrl } from '@worldbrain/memex-common/lib/url-utils/normalize'
import { initErrHandler } from '../storage'

// Keep these properties as Symbols to avoid storing them to DB
const visitsProp = Symbol('assocVisits')
const tagsProp = Symbol('assocTags')
const bookmarkProp = Symbol('assocBookmark')
const latestProp = Symbol('latestEvent')
const screenshot = Symbol('screenshotURI')

export interface PageConstructorOptions {
    // Indexed/searchable data
    url: string
    terms: string[]
    urlTerms: string[]
    titleTerms: string[]
    domain: string
    hostname: string

    // Display data
    text: string
    fullUrl: string
    fullTitle: string
    screenshotURI?: string

    // Misc. opt. data
    lang?: string
    canonicalUrl?: string
    description?: string
    keywords?: string[]
    pouchMigrationError?: boolean
}

type TermsIndexName = 'terms' | 'urlTerms' | 'titleTerms'

export default class Page extends AbstractModel
    implements PageConstructorOptions {
    public url: string
    public text: string
    public fullUrl: string
    public fullTitle: string
    public terms: string[]
    public urlTerms: string[]
    public titleTerms: string[]
    public domain: string
    public hostname: string
    public screenshot: Blob
    public lang?: string
    public canonicalUrl?: string
    public description?: string
    public keywords?: string[]
    public pouchMigrationError?: boolean

    constructor(db: Storex, props: PageConstructorOptions) {
        super(db)
        this.url = props.url
        this.fullUrl = props.fullUrl
        this.fullTitle = props.fullTitle
        this.text = props.text
        this.terms = props.terms
        this.urlTerms = props.urlTerms
        this.titleTerms = props.titleTerms
        this.domain = props.domain
        this.hostname = props.hostname

        if (props.screenshotURI) {
            this.screenshotURI = props.screenshotURI
        }

        if (props.lang) {
            this.lang = props.lang
        }

        if (props.canonicalUrl) {
            this.canonicalUrl = props.canonicalUrl
        }

        if (props.description) {
            this.description = props.description
        }
        if (props.keywords) {
            this.keywords = props.keywords
        }
        if (props.pouchMigrationError) {
            this.pouchMigrationError = props.pouchMigrationError
        }

        Object.defineProperties(this, {
            [visitsProp]: {
                value: [],
                ...AbstractModel.DEF_NON_ENUM_PROP,
            },
            [bookmarkProp]: {
                value: undefined,
                ...AbstractModel.DEF_NON_ENUM_PROP,
            },
            [tagsProp]: {
                value: [],
                ...AbstractModel.DEF_NON_ENUM_PROP,
            },
            [screenshot]: AbstractModel.DEF_NON_ENUM_PROP,
            [latestProp]: AbstractModel.DEF_NON_ENUM_PROP,
        })
    }

    get data() {
        return {
            url: this.url,
            fullUrl: this.fullUrl,
            fullTitle: this.fullTitle,
            text: this.text,
            terms: this.terms,
            urlTerms: this.urlTerms,
            titleTerms: this.titleTerms,
            domain: this.domain,
            hostname: this.hostname,
            screenshot: this.screenshot,
        }
    }

    get screenshotURI() {
        return this[screenshot]
    }

    get latest() {
        return this[latestProp]
    }

    get hasBookmark() {
        return this[bookmarkProp] != null
    }

    get tags() {
        return this[tagsProp].map((tag) => tag.name)
    }

    get visits(): Visit[] {
        return this[visitsProp]
    }

    get bookmark() {
        return this[bookmarkProp]
    }

    /**
     * Pages should be deleted if no events associated with them any more.
     */
    get shouldDelete() {
        return !this.hasBookmark && this[visitsProp].length === 0
    }

    set screenshotURI(input: string) {
        if (input) {
            this.screenshot = AbstractModel.dataURLToBlob(input)
            this[screenshot] = AbstractModel.getBlobURL(this.screenshot)
        }
    }

    /**
     * @param {number} [upperBound]
     * @return {number} Latest event timestamp below `upperBound`.
     */
    public getLatest(upperBound = Date.now()) {
        let max = 0
        let visit: Visit

        for (visit of this[visitsProp]) {
            if (visit.time > max && visit.time <= upperBound) {
                max = visit.time
            }
        }

        const bm: Bookmark = this[bookmarkProp]
        if (bm != null && bm.time > max && bm.time <= upperBound) {
            max = bm.time
        }

        return max
    }

    addVisit(time = Date.now(), data: Partial<VisitInteraction> = {}) {
        this[visitsProp].push(
            new Visit(this.db, { url: this.url, time, ...data }),
        )
    }

    addTag(name: string) {
        const index = (this[tagsProp] as Tag[]).findIndex(
            (tag) => tag.name === name,
        )

        if (index === -1) {
            this[tagsProp].push(new Tag(this.db, { url: this.url, name }))
        }
    }

    delTag(name: string) {
        const index = (this[tagsProp] as Tag[]).findIndex(
            (tag) => tag.name === name,
        )

        if (index !== -1) {
            this[tagsProp] = [
                ...this[tagsProp].slice(0, index),
                ...this[tagsProp].slice(index + 1),
            ]
        }
    }

    setBookmark(time = Date.now()) {
        this[bookmarkProp] = new Bookmark(this.db, { url: this.url, time })
    }

    delBookmark() {
        this[bookmarkProp] = undefined
    }

    /**
     * Merges some terms with the current terms state.
     *
     * @param {TermsIndexName} termProp The name of which terms state to update.
     * @param {string[]} terms Array of terms to merge with current state.
     */
    _mergeTerms(termProp: TermsIndexName, terms: string[] = []) {
        this[termProp] = !this[termProp]
            ? terms
            : [...new Set([...this[termProp], ...terms])]
    }

    /**
     * Attempt to load the blobs if they are currently undefined and there is a valid data URI
     * on the corresponding hidden field.
     * Any errors encountered in trying to resolve the URI to a Blob will result in it being unset.
     * Fields accessed by Symbols are the hidden data URI fields.
     * TODO: Find a better way to manage Blobs and Data URIs on models?
     */
    loadBlobs() {
        try {
            // Got Blob, but no data URL
            if (this.screenshot && !this[screenshot]) {
                this[screenshot] = AbstractModel.getBlobURL(this.screenshot)
            }
        } catch (err) {
            this.screenshot = undefined
            this[screenshot] = undefined
        }
    }

    async loadRels() {
        this.loadBlobs()

        // Grab DB data
        const visits = await this.db
            .collection('visits')
            .findAllObjects<Visit>({ url: this.url })
        const tags = await this.db
            .collection('tags')
            .findAllObjects<Tag>({ url: this.url })
        const bookmark = await this.db
            .collection('bookmarks')
            .findOneObject<Bookmark>({ url: this.url })

        this[visitsProp] = visits.map((v) => new Visit(this.db, v))
        this[tagsProp] = tags.map((t) => new Tag(this.db, t))
        this[bookmarkProp] = bookmark
            ? new Bookmark(this.db, bookmark)
            : undefined

        // Derive latest time of either bookmark or visits
        let latest = bookmark != null ? bookmark.time : 0

        if (latest < (visits[visits.length - 1] || { time: 0 }).time) {
            latest = visits[visits.length - 1].time
        }

        this[latestProp] = latest
    }

    async delete() {
        return this.db.operation('executeBatch', [
            {
                collection: 'visits',
                operation: 'deleteObjects',
                where: { url: this.url },
            },
            {
                collection: 'bookmarks',
                operation: 'deleteObjects',
                where: { url: this.url },
            },
            {
                collection: 'tags',
                operation: 'deleteObjects',
                where: { url: this.url },
            },
            {
                collection: 'pageListEntries',
                operation: 'deleteObjects',
                where: { pageUrl: this.url },
            },
            {
                collection: 'annotations',
                operation: 'deleteObjects',
                where: { pageUrl: this.url },
            },
            {
                collection: 'locators',
                operation: 'deleteObjects',
                where: { normalizedUrl: this.url },
            },
            {
                // page should be deleted last so we can reliably delete all dependent data first during sync
                collection: 'pages',
                operation: 'deleteObjects',
                where: { url: this.url },
            },
        ])
    }

    private async saveNewVisits(): Promise<[number, string][]> {
        const existingVisits = await this.db
            .collection('visits')
            .findObjects<Visit>({ url: this.url })

        const existingVisitsTimeMap = new Map<number, Visit>()
        existingVisits.forEach((v) => existingVisitsTimeMap.set(v.time, v))

        return Promise.all<[number, string][]>(
            this[visitsProp].map(
                async (v: Visit): Promise<[number, string]> => {
                    if (!v._hasChanged(existingVisitsTimeMap.get(v.time))) {
                        return v.pk
                    }

                    return v.save()
                },
            ),
        )
    }

    private async saveNewTags(): Promise<[string, string][]> {
        const existingTags = await this.db
            .collection('tags')
            .findObjects<Tag>({ url: this.url })

        const existingTagsNameMap = new Map<string, Tag>()
        existingTags.forEach((t) => existingTagsNameMap.set(t.name, t))

        return Promise.all<[string, string][]>(
            this[tagsProp].map((t: Tag) => {
                if (existingTagsNameMap.get(t.name)) {
                    return [t.name, t.url]
                }

                return t.save()
            }),
        )
    }

    async save() {
        return this.db.operation(
            'transaction',
            { collections: this.collections },
            async () => {
                this.loadBlobs()

                // Merge any new data with any existing
                const existing = await this.db
                    .collection('pages')
                    .findOneObject<Page>({ url: this.url })

                if (existing) {
                    this._mergeTerms('terms', existing.terms)
                    this._mergeTerms('urlTerms', existing.urlTerms)
                    this._mergeTerms('titleTerms', existing.titleTerms)

                    if (!this.screenshot && existing.screenshot) {
                        this.screenshot = existing.screenshot
                    }

                    await this.db
                        .collection('pages')
                        .updateObjects({ url: this.url }, this.data)
                } else {
                    await this.db.collection('pages').createObject(this.data)
                }

                // Insert or update all associated visits + tags
                const visitIds = await this.saveNewVisits()
                const tagIds = await this.saveNewTags()

                // Either try to update or delete the assoc. bookmark
                if (this[bookmarkProp] != null) {
                    this[bookmarkProp].save()
                } else {
                    await this.db
                        .collection('bookmarks')
                        .deleteOneObject({ url: this.url })
                }

                // Remove any visits no longer associated with this page
                const visitTimes = visitIds.map(([time]) => time)
                const tagNames = tagIds.map(([name]) => name)
                await Promise.all([
                    this.db.collection('visits').deleteObjects({
                        url: this.url,
                        time: { $nin: visitTimes },
                    }),
                    this.db.collection('tags').deleteObjects({
                        url: this.url,
                        name: { $nin: tagNames },
                    }),
                ])

                return this.url
            },
        )
    }
}

export const getPage = (getDb: DBGet) => async (url: string) => {
    const normalizedUrl = normalizeUrl(url, {})
    const db = await getDb()
    const page = await db
        .collection('pages')
        .findOneObject<Page>({ url: normalizedUrl })
        .catch(initErrHandler())

    if (page == null) {
        return null
    }
    const result = new Page(db, page)
    await result.loadRels()
    return result
}
