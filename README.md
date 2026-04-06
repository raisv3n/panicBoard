# PanicBoard

A lightweight, deadline-focused Kanban board for tracking tasks with urgency. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools.

**Live demo:** [https://panicboard.raisv.com](https://panicboard.raisv.com)

![Board View](assets/board-view.png)
![Timeline View](assets/timeline-view.png)
![New Task](assets/new-task.png)

## Features

- **Kanban & Timeline views** — switch between a columnar board grouped by date and a horizontal timeline
- **Task management** — create, edit, and delete tasks with title, description, links, due date/time, and tag
- **Backlog board** `NEW` — permanent first column for unscheduled or postponed tasks; due date is optional
- **Per-board add button** `NEW` — "+" in each board header opens the task modal pre-filled with that board's date
- **Priority sorting** — mark tasks as 🔥 Priority to pin them to the top of their column, above time-sorted tasks
- **Manual reordering** — drag cards within a column to set a custom order; reset anytime
- **Read-only preview** — click any card to open a quick preview before deciding to edit or delete
- **Drag and drop** — move cards between columns, including to and from Backlog
- **Import / Export** — back up and restore tasks as JSON files
- **Clear all data** — reset the board with a confirmation prompt
- **Undo** — step back through the last 20 state changes with `Cmd+Z` / `Ctrl+Z`
- **Countdown timers** — live countdowns on each card (days, hours, minutes)
- **Stale indicator** — shows how long since the board was last refreshed
- **Notes panel** — persistent scratchpad for quick ideas, auto-saves as you type
- **Light / Dark theme** — persisted across sessions
- **Toast notifications** — non-blocking feedback for actions

## Getting Started

### Use the live app

Visit [https://panicboard.raisv.com](https://panicboard.raisv.com) — no install needed.

### Run locally

No install or build step required. Just open `index.html` in a browser.

```bash
open index.html
```

Or serve it locally:

```bash
npx serve .
# then visit http://localhost:3000
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `N` | New task |
| `Cmd+Z` / `Ctrl+Z` | Undo last action |
| `Esc` | Close any open modal |

## Data

All data is stored in your browser's `localStorage`. Nothing is sent to a server — your data never leaves your device.

| Key | Contents |
|---|---|
| `panicboard_v1` | Tasks array |
| `panicboard_note` | Notes scratchpad content |
| `panicboard_theme` | Light / dark preference |

### Important: Data is domain-specific

Because localStorage is tied to the domain, data does **not** carry over between different URLs automatically. For example:

- `localhost:3000` → its own storage
- `your-app.vercel.app` → separate storage
- `panicboard.raisv.com` → separate storage

### Migrating data between domains

Use **Export** to download your tasks as a `.json` file, then **Import** that file on the new domain to restore everything. This also works as a general backup strategy across any device or browser.

## Project Structure

```
index.html   — markup and modal templates
script.js    — all application logic
style.css    — styling with CSS custom properties (light + dark themes)
```
