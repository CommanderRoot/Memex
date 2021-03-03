import GenericPickerLogic, {
    GenericPickerDependencies,
    GenericPickerEvent,
    GenericPickerState,
} from 'src/common-ui/GenericPicker/logic'

export interface ListPickerDependencies extends GenericPickerDependencies {
    onClickOutside?: React.MouseEventHandler
    query?: string
    onSearchInputChange?: (evt: { query: string }) => void
    onSelectedEntriesChange?: (evt: { selectedEntries: string[] }) => void
    searchInputPlaceholder?: string
    removeToolTipText?: string
}

export type ListPickerEvent = GenericPickerEvent
export type ListPickerState = GenericPickerState

export default class CollectionPickerLogic extends GenericPickerLogic {
    protected pickerName = 'Collection'

    validateEntry = this._validateEntry
}
