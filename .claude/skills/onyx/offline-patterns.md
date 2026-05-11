# Optimistic Patterns Code Examples

## Pattern A: Optimistic Without Feedback

No `successData`/`failureData` — fire and forget.

```typescript
function pinDrinkingSession(sessionID: string) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {isPinned: true},
        },
    ];

    API.write('TogglePinnedSession', {sessionID}, {optimisticData});
}
```

## Pattern B: Optimistic With Feedback

Show pending state; revert or clean up on completion.

```typescript
function deleteDrinkingSession(sessionID: string) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {
                statusNum: CONST.DRINKING_SESSION.STATUS_NUM.CLOSED,
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: null,
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {
                statusNum: null,
                pendingAction: null,
                errors: {[Date.now()]: 'Failed to delete a session'},
            },
        },
    ];

    API.write('DeleteDrinkingSession', {sessionID}, {optimisticData, successData, failureData});
}
```

## Example with Loading State

```typescript
function addSessionNote(sessionID: string, text: string) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {
                isLoading: true,
                note: text,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {
                isLoading: false,
                pendingAction: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`,
            value: {
                isLoading: false,
                note: null,
                pendingAction: null,
                errors: {[Date.now()]: 'Failed to add note'},
            },
        },
    ];

    API.write('AddSessionNote', {sessionID, text}, {optimisticData, successData, failureData});
}
```

## Using finallyData

When `successData` and `failureData` would be identical, use `finallyData` instead:

```typescript
const finallyData: OnyxUpdate[] = [
    {
        onyxMethod: Onyx.METHOD.MERGE,
        key: ONYXKEYS.SOME_KEY,
        value: {
            isLoading: false,
            pendingAction: null,
        },
    },
];

API.write('SomeCommand', params, {optimisticData, finallyData});
```
