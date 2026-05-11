---
ruleId: CLEAN-REACT-PATTERNS-2
title: Let components own their behavior and effects
---

## [CLEAN-REACT-PATTERNS-2] Let components own their behavior and effects

### Reasoning

When parent components compute and pass behavioral state to children, if a child's requirements change, then parent components must change as well, increasing coupling and causing behavior to leak across concerns. Letting components own their behavior keeps logic local, allows independent evolution, and follows the principle: "If removing a child breaks parent behavior, coupling exists."

**Distinction from CLEAN-REACT-PATTERNS-3**: This rule is about data flow DOWN (parent -> child) — "Don't pass data the child can get itself."

### Incorrect

#### Incorrect (parent micromanages child's state)

- Parent gathers, computes, and dictates the child's entire contextual awareness
- Parent imports hooks/stores only because the child needs the information
- Double coupling: parent -> child's dependencies, child -> prop names/types

```tsx
<SessionListItem
    sessionID={sessionID}
    sessionData={itemSessionData}
    sessionStats={itemSessionStats}
    userProfile={itemUserProfile}
    preferences={itemPreferences}
    viewMode={optionMode}
    isItemFocused={!shouldDisableFocusOptions}
    onSelectRow={onSelectRow}
    preferredLocale={preferredLocale}
    hasDraftNote={hasDraftNote}
    onLayout={onLayoutItem}
    isScreenFocused={isScreenFocused}
    testID={index}
/>
```

In this example:
- The parent fetches `sessionData`, `sessionStats`, `userProfile`, `preferences`, and layout state
- These dependencies exist only because the child needs them — the parent is a data intermediary
- If `SessionListItem` requirements change, the parent must change too

### Correct

#### Correct (component owns its behavior)

- Component receives only IDs and handlers
- Internally accesses stores, contexts, and computes values
- Children follow the same pattern

```tsx
<SessionListItem
    sessionID={sessionID}
    onSelectRow={onSelectRow}
/>
```

```tsx
function SessionListItem({sessionID, onSelectRow}) {
   // Component fetches its own data
   const [session] = useOnyx(`${ONYXKEYS.COLLECTION.DRINKING_SESSION}${sessionID}`);
   const [userProfile] = useOnyx(ONYXKEYS.USER_PROFILE);
   // ... other data this component needs

   return (
        <View>
            {/* Children own their state too */}
            <SessionIcon sessionID={sessionID} />
            <SessionTitle sessionID={sessionID} />
            <SessionStats sessionID={sessionID} />
        </View>
   );
}
```

---

### Review Metadata

#### Condition

Flag when a parent component acts as a pure data intermediary — fetching or computing state only to pass it to children without using it for its own logic.

**Signs of violation:**
- Parent imports hooks/contexts only to satisfy child's data needs
- Props that are direct pass-throughs of hook results (e.g., `report={reportOnyx}`)
- Component receives props that are just passed through to children or that it could fetch itself
- Removing or commenting out the child would leave unused variables in the parent

**DO NOT flag if:**
- Props are minimal, domain-relevant identifiers (e.g., `sessionID`, `userID`)
- Props are callback/event handlers for coordination (e.g., `onSelectRow`, `onLayout`, `onPress`)
- Props are structural/presentational that can't be derived internally (e.g., `style`, `testID`)
- Parent genuinely uses the data for its own rendering or logic
- Data is shared coordination state that parent legitimately owns (e.g., selection state managed by parent)

**Search Patterns** (hints for reviewers):
- `Report`
- `Policy`
- `Transaction`
- `Actions`
- `useOnyx`
