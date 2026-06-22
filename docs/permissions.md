# World's Kitchen Hub Permissions

This document describes the intended default permissions. Owner-granted custom admin levels can add specific permissions without changing a user's Discord role.

## Default Role Access

| Role | Main resources | Staff Activity | Logs | Assignments | Admin Users | Category structure |
| --- | --- | --- | --- | --- | --- | --- |
| World's Kitchen Team | Basic Information only | Hidden | Hidden | Hidden | Hidden | Hidden |
| Supervision Team | Basic + Supervision | Visible | Read published logs only | Hidden | Hidden | Hidden |
| Management Team | Basic through Management | Visible | Create/edit/delete own logs | Hidden | Hidden | Hidden |
| Corporate Team | Basic through Corporate | Visible | Delete logs, view lookup | View assignments only | Hidden | Hidden |
| HR Department | HR access plus lower shared areas | Visible | Department-level access | View assignments only | Hidden | Hidden |
| PR Department | PR access plus lower shared areas | Visible | Department-level access | View assignments only | Hidden | Hidden |
| Leadership Team | All normal categories | Visible | Manage activity logs | Create/edit/delete assignments | Hidden | Hidden |
| Owner | Everything | Everything | Everything | Everything | Visible | Create/edit/delete/reorder categories |

## Owner-Only Defaults

- Preview access as another role.
- Create, edit, delete, and reorder categories.
- Manage home quick links.
- Grant or revoke custom admin levels.
- Edit the permission matrix for custom admin levels.

## Leadership Defaults

- Create and edit resources.
- Move resources to the recovery bin.
- Create announcements.
- View audit logs.
- Manage category links.
- Manage activity logs.
- Manage weekly assignments.
- Edit visible training and shift time slots.

Leadership does not receive owner-level category structure controls by default.

## Recovery Bin

- Leadership can see the bin because they can move resources and logs into it.
- Leadership can restore standard content such as resources, activity logs, assignments, and category links.
- Owner controls structural bin items such as categories and home quick links by default.
- Permanent delete requires Owner or the explicit custom permission `delete_permanently`.

## Preview Mode

When Owner previews a lower role, the UI hides owner-only controls such as New Category and Admin Users. Custom owner permissions are also ignored during non-owner preview so the preview reflects the selected role instead of the real owner account.
