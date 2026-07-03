# TNG Office Design System v1.1 (Updated from Visual References)

> Legacy reference. The current PMS application visual source of truth is
> `docs/DESIGN_new.md`, which defines the strict monochrome interface system.

## Color System

### Primary Brand Color
| Token | Value |
|---------|---------|
| Primary | #5EB332 |
| Primary 50% | rgba(94,179,50,0.5) |
| Primary 10% | rgba(94,179,50,0.1) |

### Usage
- Main brand color
- Primary CTA
- Key iconography
- Highlights and emphasis
- Active states

### Status Colors

| Type | Color |
|--------|--------|
| Info | Blue |
| Success | Green |
| Warning | Orange |
| Error | Red |

> Exact HEX values for status colors are not specified in the source.

---

## Grid & Layout

### Mobile Layout

#### 375px Width
- 4 columns
- 12px gutter
- 12px margin

#### 430px Width
- 4 columns
- 12px gutter
- 12px margin

Design approach:
- Mobile-first
- Responsive
- Consistent margins
- Fixed 4-column grid

---

## Button System

### Variants
1. Primary Button
2. Secondary Button
3. Tertiary Button

### Sizes
- Small
- Regular
- Large

### States
- Default
- Hover
- Active
- Disabled

### Icon Support
- Text only
- Leading icon
- Trailing icon

### Behavior

Primary:
- Filled green
- White text

Secondary:
- Outline style
- Filled on hover/active

Tertiary:
- Text only
- Minimal emphasis

---

## Modal & Popup

### Modal Characteristics
- Dimmed overlay background
- Rounded corners
- Bottom sheet pattern heavily used
- Form-focused interactions

### Usage
- Filtering
- Data entry
- Detail editing
- Confirmation flows

---

## Input System

### Text Field States
- Default
- Active / Focus
- Entered
- Error
- Disabled
- Supporting text

### Specialized Inputs
- Password
- Show password
- Phone number

### Error Pattern
- Red border
- Red helper text

---

## Dropdown System

### States
- Default
- Active
- Entered
- Disabled
- Supporting text

### Variants
- Single select
- Multi-select with checkbox list

---

## Selection Controls

### Checkbox

States:
- Default
- Hover
- Active
- Disabled

### Radio Button

States:
- Default
- Hover
- Active
- Disabled

---

## Data Components

### Table

Characteristics:
- Green header row
- Alternating row background
- Business reporting focus

### Pagination

Elements:
- Previous
- Next
- Page number
- Ellipsis

Desktop and compact versions supported.

---

## Icon Buttons

Sizes:
- Small
- Regular

Examples:
- Heart
- Previous
- Next

States:
- Default
- Hover

---

## Tabs

Variant observed:
- Icon + Label

States:
- Active (filled green)
- Inactive (outlined)

---

## Avatar

Pattern:
- Circular initials avatar
- Name
- Supporting role/department text

---

## Additional Design Tokens Observed

### Border Radius
Estimated:
- 6–12px on inputs/buttons
- Larger radius on modal sheets

### Border Style
- Light gray stroke
- Green stroke for active brand elements

### Visual Style
- Minimalistic
- Enterprise software
- Low decoration
- High information density
- Functional over expressive

---

## Remaining Missing Items

Still not defined in source:

1. Complete color palette HEX values
2. Shadow/elevation scale
3. Spacing scale tokens
4. Component measurements
5. Motion durations
6. Accessibility standards
7. Dark mode
8. Design token naming convention
9. Developer implementation specs
