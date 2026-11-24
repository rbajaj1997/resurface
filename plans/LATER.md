# Later: skip a bookmark without marking it viewed

Agreed with Rohit. Sometimes a post needs more time than the reader has right now. Later moves it further down the current cycle without counting it as viewed.

## Behavior

- Later removes the current card from the order and reinserts it at a random spot after the card that slides in next. The spot can be anywhere from directly after the new current card to the end of the cycle.
- `position` and `viewed` don't change. The next card takes the current slot, and the `N of M` progress stays the same.
- Later works only on the frontier card (`position === viewed`) when at least one other unviewed card remains. Otherwise it is disabled: on passed cards reached with Previous, on the last unviewed card, and on the completion screen.
- Nothing is remembered about the skip. A card can be skipped any number of times. Shuffle again and import reconciliation are unchanged.

## UI

- A secondary Later button on its own row below Previous / Next. It is always shown and disabled when Later isn't allowed.
- The `L` key triggers Later, under the same rules as the other reader keys.
- A post that fails to load shows Retry, Later, and Next. Later appears there only when allowed.

## Implementation

1. `src/cycle.ts`: `canLater(state)` is the single rule. `later(state)` returns the state unchanged when not allowed, otherwise moves the current ID using the existing random insertion.
2. `src/Reader.tsx`: the keyboard map becomes key → transition, so Previous, Next, and Later share one lookup. Add the Later button and keyboard hint, and pass `onLater` to the current `Post` when allowed.
3. `src/Post.tsx`: optional `onLater` on the failure card.
4. No storage change. `moveState`'s same-place check already guards stale writes. No scroll handling is needed, because `position` doesn't move and the next card's embed is already mounted under its key.
5. Docs: README features and keys, PLAN.md revision note and cycle rules.
