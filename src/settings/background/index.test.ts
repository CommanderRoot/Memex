import expect from 'expect'
import { makeSingleDeviceUILogicTestFactory } from 'src/tests/ui-logic-tests'
import { COLLECTION_NAMES } from './constants'

const TEST_DATA = {
    test1: 1234,
    test2: '1234',
    test3: { sub: 'hi' },
}

describe('user settings background tests', () => {
    const it = makeSingleDeviceUILogicTestFactory()

    it('should write single settings to storage', async ({ device }) => {
        await device.backgroundModules.settings.set({ test1: TEST_DATA.test1 })

        expect(
            await device.storageManager
                .collection(COLLECTION_NAMES.settings)
                .findAllObjects({}),
        ).toEqual([{ name: 'test1', value: TEST_DATA.test1 }])
    })

    it('should write multiple settings to storage', async ({ device }) => {
        await device.backgroundModules.settings.set(TEST_DATA)

        expect(
            await device.storageManager
                .collection(COLLECTION_NAMES.settings)
                .findAllObjects({}),
        ).toEqual([
            { name: 'test1', value: TEST_DATA.test1 },
            { name: 'test2', value: TEST_DATA.test2 },
            { name: 'test3', value: TEST_DATA.test3 },
        ])
    })

    it('should read settings from storage', async ({ device }) => {
        await device.backgroundModules.settings.set(TEST_DATA)

        expect(
            await device.backgroundModules.settings.get(Object.keys(TEST_DATA)),
        ).toEqual(TEST_DATA)
        expect(await device.backgroundModules.settings.get(TEST_DATA)).toEqual(
            TEST_DATA,
        )
        expect(await device.backgroundModules.settings.get('test1')).toEqual({
            test1: TEST_DATA.test1,
        })
        expect(await device.backgroundModules.settings.get('test2')).toEqual({
            test2: TEST_DATA.test2,
        })
        expect(await device.backgroundModules.settings.get('test3')).toEqual({
            test3: TEST_DATA.test3,
        })
    })
})
