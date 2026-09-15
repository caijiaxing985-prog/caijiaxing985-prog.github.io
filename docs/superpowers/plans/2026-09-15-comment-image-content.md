# Comment Image Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each public comment a complete text-and-image item and manage its images directly from the comment editor.

**Architecture:** Keep `gallery[].commentIds` as the single relationship source. Add pure association helpers, render associated gallery items inside comment cards, and let the admin toggle or upload those associations without changing the persisted schema.

**Tech Stack:** React 19, Vite 7, Vitest, Node 24 backend.

## Global Constraints

- Preserve existing content, gallery order, database schema, draft flow, and publish flow.
- Support multiple images per comment.
- Keep `/wenan` path support on every image URL and API request.
- Keep each uploaded image at 15 MB maximum and existing accepted formats.

---

### Task 1: Association Helpers

**Files:**
- Create: `src/commentImages.js`
- Test: `src/commentImages.test.js`

**Interfaces:**
- Produces: `imagesForComment(gallery, commentId)`, `setCommentImageLinked(gallery, imageId, commentId, linked)`, and `appendCommentImages(gallery, uploads, commentId)`.

- [ ] Write tests asserting gallery-order lookup, immutable link toggling, deduplicated IDs, and sequential IDs for new uploads.
- [ ] Run `npx vitest run src/commentImages.test.js` and confirm failure because the module does not exist.
- [ ] Implement the three pure helpers.
- [ ] Re-run the focused test and confirm all assertions pass.

### Task 2: Public Comment Cards

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `imagesForComment(gallery, commentId)` and `sitePath(file)`.

- [ ] Render associated images inside each comment card with thumbnail, image name, original-image link, and a download link.
- [ ] Keep the existing copy action adjacent to the text and add responsive fixed image sizing.
- [ ] Build and use browser automation at `/wenan/` to verify visible comment text, image, copy control, and save control with no failed public requests.

### Task 3: Comment Image Management

**Files:**
- Modify: `src/Admin.jsx`
- Modify: `src/admin.css`

**Interfaces:**
- Consumes: all Task 1 helpers and the existing `/api/admin/upload` endpoint.

- [ ] Add a comment-only image panel with gallery checkboxes and previews.
- [ ] Add a multiple-file upload input; upload sequentially, append each result as a named gallery item, and link it to the selected comment.
- [ ] Preserve successful uploads if a later file fails and show the existing error message.
- [ ] Verify in the browser that toggling and uploading mark the draft dirty and that publishing exposes the image in the public comment card.

### Task 4: Release Verification

**Files:**
- Modify: `.codex-task.md`
- Generate: `outputs/文案库管理版-评论图文-20260915.zip`

- [ ] Run `npm test`, `npm run build`, and `git diff --check`.
- [ ] Run the production app behind the `/wenan` proxy simulation and inspect public/admin pages with browser automation.
- [ ] Commit and push `codex/admin-library`, then confirm GitHub tests pass.
- [ ] Package `dist`, `server`, Docker files, deployment configuration, and instructions; verify the archive contains the web build and server.
