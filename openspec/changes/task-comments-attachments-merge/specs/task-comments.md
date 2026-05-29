# Spec — task-comments (delta)

## ADDED requirements

### Requirement: comment author is derived from the logged-in user

The comment composer SHALL set `authorName` from the currently logged-in user, exposed by `useAuth()`. The composer SHALL NOT render an input for `authorName`.

The resolution order SHALL be: `user.displayName` → `user.username` → `user.email`. If none is present, the composer SHALL disable submission and SHALL NOT send a request.

#### Scenario: user is logged in with displayName

- **WHEN** a logged-in user with `displayName = "Ana Pérez"` types `"Llegó el equipo."` and submits the form
- **THEN** the request body SHALL contain `{ authorName: "Ana Pérez", body: "Llegó el equipo.", attachments: [] }`

#### Scenario: user has no displayName but has username

- **GIVEN** `user.displayName` is empty and `user.username = "anap"`
- **WHEN** the user submits a comment with body `"OK"`
- **THEN** the request body SHALL contain `authorName: "anap"`

#### Scenario: user is null

- **GIVEN** `useAuth().user` is `null`
- **THEN** the submit button SHALL be disabled
- **AND** the composer SHALL render the text "Iniciá sesión para comentar" in place of the submit button's action

### Requirement: submit gating

The submit button SHALL be enabled only when ALL of the following hold:

- `useAuth().user` is non-null AND has a non-empty resolved author name
- the trimmed body is non-empty OR there is at least one valid attachment row
- the addComment mutation is not currently pending

#### Scenario: body is empty but one valid attachment is present

- **GIVEN** the body is `""`
- **AND** the user added one attachment row with a non-empty URL
- **THEN** the submit button SHALL be enabled

#### Scenario: nothing to send

- **GIVEN** body is empty and no attachments
- **THEN** the submit button SHALL be disabled

## REMOVED requirements

### Requirement: ~~manual author input~~

The composer no longer renders a `<input id="comment-author">` field. The `authorName` form state is removed.
