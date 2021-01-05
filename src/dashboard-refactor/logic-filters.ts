import { SEARCH_QUERY_END_FILTER_KEY_PATTERN } from 'src/dashboard-refactor/constants'
import { FilterKey, SearchFilterType } from './header/types'
import {
    ParsedSearchQuery,
    QueryFilterPart,
    SearchFilterDetail,
    SearchQueryPart,
} from './types'

interface FilterKeyMapping {
    key: FilterKey
    type: SearchFilterType
    isExclusion?: boolean
    variant?: 'from' | 'to'
}

const filterKeyMapping: FilterKeyMapping[] = [
    {
        key: 't',
        type: 'tag',
    },
    {
        key: '-t',
        type: 'tag',
        isExclusion: true,
    },
    {
        key: 'd',
        type: 'domain',
    },
    {
        key: 'd',
        type: 'domain',
        isExclusion: true,
    },
    {
        key: 'c',
        type: 'list',
    },
    {
        key: 'c',
        type: 'list',
        isExclusion: true,
    },
    {
        key: 'from',
        type: 'date',
        variant: 'from',
    },
    {
        key: 'to',
        type: 'date',
        variant: 'to',
    },
]

// misc logic
const getFilterMappingFromKey = (filterKey: string): FilterKeyMapping => {
    return filterKeyMapping.find((val) => val.key === filterKey)
}

const getFilterKeyFromDetail = (
    filterDetail: SearchFilterDetail,
): FilterKey => {
    const { type, isExclusion } = filterDetail
    return filterKeyMapping.find(
        (val) =>
            val.type === type &&
            (filterDetail['variant']
                ? val.variant === filterDetail['variant']
                : true) &&
            (isExclusion ? val.isExclusion === isExclusion : true),
    ).key
}

// parsing logic
const getFilterPartFromKey = (
    endIndex: number,
    filterKey: string,
): QueryFilterPart => {
    const { type, isExclusion, variant } = getFilterMappingFromKey(filterKey)
    const queryFilterPart: QueryFilterPart = {
        type: 'filter',
        startIndex: endIndex - (`${filterKey}:`.length - 1),
        endIndex,
        detail: {
            type,
            filters: [],
            rawContent: `${filterKey}:`,
        },
    }
    if (isExclusion) {
        queryFilterPart.detail['isExclusion'] = true
    }
    if (variant) {
        queryFilterPart.detail['variant'] = variant
    }
    return queryFilterPart
}

const pushSearchStringToArray = (
    endIndex: number,
    str: string,
    parsedQuery: ParsedSearchQuery,
): ParsedSearchQuery => {
    const lastPart = parsedQuery[parsedQuery.length - 1]
    const lastStringPart =
        lastPart && lastPart.type === 'searchString' ? lastPart : null
    if (lastStringPart) {
        lastStringPart.detail['value'] += str
        lastStringPart.endIndex += str.length
    } else {
        parsedQuery.push({
            type: 'searchString',
            startIndex: endIndex - (str.length - 1),
            endIndex,
            detail: {
                value: str,
            },
        })
    }
    return parsedQuery
}

const parseFilterString: (filterString: string) => string[] = (
    filterString,
) => {
    const filters = filterString.replace(/"|\"|\\\"/g, '').split(',')
    return filters
}

const parseFilterKey = (endIndex: number, str: string): ParsedSearchQuery => {
    const queryParts: ParsedSearchQuery = []
    // find valid filter key at end of string if exists
    const match = str.match(SEARCH_QUERY_END_FILTER_KEY_PATTERN)
    if (match) {
        // remove filter key from end of string
        const precedingStr = str.slice(0, str.length - match[0].length)
        if (precedingStr) {
            pushSearchStringToArray(
                endIndex - match[0].length,
                precedingStr,
                queryParts,
            )
        }
        // add filter key detail to array
        queryParts.push(getFilterPartFromKey(endIndex, match[1]))
        return queryParts
    }
}

const pushFiltersToArray = (
    endIndex: number,
    fragment: string,
    parsedQuery: ParsedSearchQuery,
    containsFilterQuery?: boolean,
): ParsedSearchQuery => {
    const filters = parseFilterString(fragment)
    const filterPart = parsedQuery[parsedQuery.length - 1]
    const { detail } = filterPart
    detail['rawContent'] += fragment
    detail['filters'].push(...filters)
    filterPart.endIndex = endIndex
    if (containsFilterQuery && filterPart.detail['type'] !== 'date') {
        detail['query'] = detail['filters'].pop()
    }
    return parsedQuery
}

/**
 * Takes a query string and returns an array of objects split into the relevant parts
 * of the query
 * @param queryString
 */
export const parseSearchQuery: (queryString: string) => ParsedSearchQuery = (
    queryString,
) => {
    const parsedQuery: ParsedSearchQuery = []
    // define var to hold unprocessed part of string
    let fragment: string = ''
    // define control booleans
    let isInFilterStr: boolean
    let isInQuotes: boolean
    let followsClosingQuote: boolean
    for (let i = 0; i < queryString.length; i++) {
        const char = queryString[i]
        fragment += char

        // this code ensures that a filter string ends after quotes if a non-comma char is detected
        if (followsClosingQuote) {
            followsClosingQuote = false
            if (char === ',') {
                continue
            } else {
                // note the fragment is altered here in order to ensure the whiteSpace is counted as searchTerm and not appended to a filter
                // note the index here is altered to account for the fact that the fragment is passed through on the char _after_ the filter string finishes
                pushFiltersToArray(
                    i - 1,
                    fragment.slice(0, fragment.length - 1),
                    parsedQuery,
                )
                fragment = fragment[fragment.length - 1]
                isInFilterStr = false
                continue
            }
        }

        // if in filter string, apply relevant rules
        if (isInFilterStr) {
            if (char === '"') {
                if (isInQuotes) {
                    followsClosingQuote = true
                }
                isInQuotes = !isInQuotes
                continue
            }
            if (isInQuotes && char === ',') {
                isInQuotes = !isInQuotes
                continue
            }
            if (char === ' ') {
                if (isInQuotes) {
                    continue
                }
                // extract filters from fragment and push into array
                // note the fragment is altered here in order to ensure the whiteSpace is counted as searchTerm and not appended to a filter
                // note the index here is altered to account for the fact that the fragment is passed through on the char _after_ the filter string finishes
                pushFiltersToArray(
                    i - 1,
                    fragment.slice(0, fragment.length - 1),
                    parsedQuery,
                )
                fragment = fragment[fragment.length - 1]
                // this is the place to emit any mutations to close state pickers
                isInFilterStr = false
                continue
            }
        }

        // check for filter key completion
        if (
            !isInFilterStr &&
            char === ':' &&
            SEARCH_QUERY_END_FILTER_KEY_PATTERN.test(fragment)
        ) {
            const filterKeyParts = parseFilterKey(i, fragment)
            if (filterKeyParts) {
                // this is the place to perform any state mutations to open pickers
                parsedQuery.push(...filterKeyParts)
                isInFilterStr = true
                fragment = ''
                continue
            }
        }
    }

    // run steps for string end
    if (fragment) {
        if (isInFilterStr) {
            pushFiltersToArray(
                queryString.length - 1,
                fragment,
                parsedQuery,
                !followsClosingQuote,
            )
        } else {
            pushSearchStringToArray(
                queryString.length - 1,
                fragment,
                parsedQuery,
            )
        }
    }

    return parsedQuery
}

// string constructing logic

/**
 * Constructs a query string (of type string) from an array of type ParsedSearchQuery.
 * The inverse of the parseSearchQuery function.
 * @param parsedQuery an array of type ParsedSearchQuery
 */
export const constructQueryString = (
    parsedQuery: ParsedSearchQuery,
): string => {
    let queryString: string = ''
    const returnString: string = parsedQuery.reduce(
        (queryString, currentPart) => {
            if (currentPart.type === 'filter') {
                // find mapped filter key and append to string
                const key = getFilterKeyFromDetail(currentPart.detail)
                const { filters, query, rawContent } = currentPart.detail
                // queryString += currentPart.detail.rawContent
                if (currentPart.detail.type === 'date') {
                    queryString += `${currentPart.detail['variant']}:`
                } else {
                    queryString += `${key}:`
                }
                if (filters) {
                    queryString += getRawContentFromFiltersArray(filters)
                }
                if (query) {
                    queryString += formatFilterQuery(query)
                }
            } else {
                // else append string value
                queryString += currentPart.detail.value
            }
            return queryString
        },
        queryString,
    )
    if (typeof queryString !== 'string') return 'ABORT! FAILURE!'
    return returnString
}

const formatFilterQuery = (filterQuery: string): string => {
    filterQuery = /\s/.test(filterQuery) ? `"${filterQuery}` : filterQuery
    filterQuery = `,${filterQuery}`
    return filterQuery
}

export const findMatchingFilterPartIndex = (
    filterDetail: Omit<SearchFilterDetail, 'rawContent'> & {
        rawContent?: string
    },
    parsedQuery: ParsedSearchQuery,
): number => {
    const { type, isExclusion } = filterDetail
    const index = parsedQuery.findIndex(
        (val) =>
            val.detail['filterType'] === type &&
            (filterDetail['variant']
                ? val.detail['variant'] === filterDetail['variant']
                : true) &&
            (isExclusion ? val.detail['isExclusion'] === isExclusion : true),
    )
    return index
}

const getRawContentFromFiltersArray = (filtersArray: string[]): string => {
    let rawContent: string = ''
    filtersArray.forEach((filter, index, arr) => {
        if (/\s/.test(filter)) {
            rawContent += `"${filter}"`
        } else {
            rawContent += filter
        }
        if (arr[index + 1]) {
            rawContent += ','
        }
    })
    return rawContent
}

// filters update logic

/**
 * takes query string and object specifying detail of filter key to be added and returns
 * correctly formatted query string
 * @param filterPart
 * @param queryString
 */
export const pushFilterKeyToQueryString = (
    filterDetail: SearchFilterDetail,
    queryString: string,
): string => {
    // ensure that if the queryString is not empty a whitespace precedes the filter part
    if (queryString.length > 1 && queryString[queryString.length - 1] !== ' ') {
        queryString += ' '
    }
    const filterKey = getFilterKeyFromDetail(filterDetail)
    queryString += `${filterKey}:`
    return queryString
}

export const removeEmptyFilterStringsFromQueryString = (
    filterDetail: SearchFilterDetail,
    queryString: string,
): string => {
    const parsedQuery: ParsedSearchQuery = parseSearchQuery(queryString)
    const filteredQuery: ParsedSearchQuery = parsedQuery.filter((queryPart) => {
        if (queryPart.type !== 'filter') {
            return true
        }
        // return false for case where filtered queryPart.detail represents the same filter key as param filterDetail
        //  and where queryPart.filters is not empty or query is not empty, else true
        return (
            queryPart.detail.filters.length > 0 ||
            queryPart.detail.query.length > 0 ||
            !(
                getFilterKeyFromDetail(filterDetail) ===
                getFilterKeyFromDetail(queryPart.detail)
            )
        )
    })

    return constructQueryString(filteredQuery)
}

/**
 * Takes query string and an object specifying the filter to be added and
 * returns the correctly formatted query string
 * @param queryString the string to update
 * @param filterPart the object of type SearchFilterDetail to use in updating the string
 */
export const updateFiltersInQueryString = (
    filterDetail: SearchFilterDetail,
    queryString: string,
): string => {
    const parsedQuery: ParsedSearchQuery = parseSearchQuery(queryString)
    const targetPart: SearchQueryPart =
        parsedQuery[findMatchingFilterPartIndex(filterDetail, parsedQuery)]
    if (targetPart.type === 'filter') {
        targetPart.detail.filters = filterDetail.filters
        targetPart.detail.rawContent = getRawContentFromFiltersArray(
            filterDetail.filters,
        )
        if (filterDetail.isExclusion) {
            targetPart.detail.isExclusion = filterDetail.isExclusion
        }
        if (filterDetail.type === 'date') {
            targetPart.detail['variant'] = filterDetail['variant']
        }
        if (filterDetail.query.length > 0) {
            targetPart.detail.query = filterDetail.query
        }
        return constructQueryString(parsedQuery)
    }
}

const getCursorPositionQueryPart = (
    queryString: string,
    cursorIndex: number,
): SearchQueryPart => {
    const parsedQuery: ParsedSearchQuery = parseSearchQuery(queryString)
    return parsedQuery.find(
        ({ startIndex, endIndex }) =>
            cursorIndex >= startIndex && cursorIndex <= endIndex,
    )
}

/**
 * Takes in the query string and the cursor's position in it and returns the type of the
 * filter string in which it resides, or false if it does not sit in a filter string
 * N.B. this is only for applications where the isExclusion and variant flag are not used
 * @param queryString a string
 * @param cursorIndex a number detailing the string index after which the cursor sits
 */
export const getCursorPositionFilterType = (
    queryString: string,
    cursorIndex: number,
): SearchFilterType | false => {
    const cursorPart: SearchQueryPart = getCursorPositionQueryPart(
        queryString,
        cursorIndex,
    )
    if (!cursorPart ?? cursorPart.type !== 'filter') {
        return false
    }
    return cursorPart.detail.type
}

// filters state shape
// interface SearchFiltersState {
//     searchQuery: string
//     searchQueryCursorPosition: number
//     isSearchBarFocused: boolean
//     searchFiltersOpen: boolean
//     isTagFilterActive: boolean
//     isDateFilterActive: boolean
//     isDomainFilterActive: boolean

//     dateFromInput: string
//     dateToInput: string
//     dateFrom?: number
//     dateTo?: number

//     tagsIncluded: string[]
//     tagsExcluded: string[]
//     tagsQuery: string
//     listsIncluded: string[]
//     listsExcluded: string[]
//     listsQuery: string[]
//     domainsIncluded: string[]
//     domainsExcluded: string[]
//     domainsQuery: string
// }