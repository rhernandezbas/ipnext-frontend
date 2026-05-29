# Spec — task-attachments-on-comments (delta)

## ADDED requirements

### Requirement: attachments live on the comment composer, not on a separate tab

The "Adjuntos" tab in `TaskTabs` SHALL be removed. Attachments SHALL be authored exclusively inside the comment composer of the "Comentarios" tab.

#### Scenario: Adjuntos tab is gone

- **WHEN** the user opens the task detail page
- **THEN** the `TaskTabs` component SHALL NOT render a tab with id `adjuntos` or label `Adjuntos`
- **AND** the tab order SHALL be `Detalles, Comentarios, Relacionado, Inventory, Registro de trabajo, Actividad`

### Requirement: URL-only attachment composer

The attachment composer SHALL accept a single URL per row. There SHALL be NO file picker, NO drag-and-drop, and NO multipart upload. Each row SHALL render:

- a `type="url"` input for the attachment URL (required when row exists)
- an optional `type="text"` input for the display filename (auto-derived from URL pathname if left blank)
- a remove button that drops the row from the draft list

#### Scenario: filename auto-derived from URL

- **GIVEN** the user typed `https://cdn.example.com/img/cable-roto.jpg` and left the filename blank
- **WHEN** the user submits
- **THEN** the request SHALL send `filename = "cable-roto.jpg"`

#### Scenario: empty URL rows are dropped

- **WHEN** the user submits with an attachment row whose URL is empty
- **THEN** that row SHALL be discarded and not included in the payload

### Requirement: image attachments render as inline thumbnails

Attachments whose URL ends in a recognized image extension (`.png, .jpg, .jpeg, .gif, .webp, .avif`) — case-insensitive — SHALL render as `<img>` thumbnails on the comment item. Non-image attachments SHALL render as link chips as today.

#### Scenario: image URL renders as thumbnail

- **GIVEN** a comment has an attachment with URL `https://cdn.example.com/photo.JPG`
- **THEN** the comment item SHALL render an `<img>` element with `src` equal to that URL inside the thumbnails row

#### Scenario: non-image URL renders as link chip

- **GIVEN** a comment has an attachment with URL `https://docs.example.com/pdf-roto.pdf`
- **THEN** the comment item SHALL render an `<a>` chip with the filename, not an `<img>`

### Requirement: thumbnail click opens a lightbox

Clicking an image thumbnail SHALL open an overlay lightbox showing the image at natural size. The lightbox SHALL close on:

- click on the overlay backdrop
- press of the Escape key
- click of an explicit close button

The lightbox SHALL render via React portal and SHALL trap focus to the close button.

#### Scenario: open and close lightbox

- **WHEN** the user clicks a thumbnail
- **THEN** an overlay with `role="dialog"` and `aria-modal="true"` SHALL appear
- **WHEN** the user presses Escape
- **THEN** the overlay SHALL be removed and focus SHALL return to the originating thumbnail

### Requirement: broken image URL falls back gracefully

When an `<img>` thumbnail fails to load, the comment item SHALL replace it with a link chip showing the filename. The user SHALL NOT see a broken-image icon.

#### Scenario: broken image

- **GIVEN** a thumbnail's URL returns 404
- **WHEN** the `<img>` fires `onError`
- **THEN** the rendered element SHALL become an `<a>` chip pointing at the same URL with the attachment filename
