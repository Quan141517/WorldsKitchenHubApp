insert into categories (id, name, sort_order, allowed_role_ids)
values
  ('basic-information', 'Basic Information', 10, array['worlds-kitchen-team','supervision-team','management-team','corporate-team','human-resources-department','public-relations-department','leadership-team','owner']),
  ('supervision-resources', 'Supervision Resources', 20, array['supervision-team','management-team','corporate-team','human-resources-department','public-relations-department','leadership-team','owner']),
  ('management-resources', 'Management Resources', 30, array['management-team','corporate-team','human-resources-department','public-relations-department','leadership-team','owner']),
  ('corporate-resources', 'Corporate Resources', 40, array['corporate-team','human-resources-department','public-relations-department','leadership-team','owner']),
  ('human-resources-information', 'Human Resources Information', 50, array['human-resources-department','leadership-team','owner']),
  ('public-relations-information', 'Public Relations Information', 60, array['public-relations-department','leadership-team','owner']),
  ('leadership-information', 'Leadership Information', 70, array['leadership-team','owner'])
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  allowed_role_ids = excluded.allowed_role_ids,
  updated_at = now();

insert into quick_links (id, label, url, sort_order)
values
  ('discord-server', 'Discord Server', 'https://discord.com/channels/1452614312798584852/1452805570254999745', 10),
  ('roblox-group', 'Roblox Group', 'https://www.roblox.com', 20)
on conflict (id) do update set
  label = excluded.label,
  url = excluded.url,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into weekly_assignments (id, team_role_id, sessions_required, minutes_required, shifts_required, starts_at)
values
  ('supervision-default', 'supervision-team', 2, 60, 0, '2026-06-15'),
  ('management-default', 'management-team', 2, 60, 1, '2026-06-15'),
  ('corporate-default', 'corporate-team', 0, 75, 1, '2026-06-15')
on conflict (id) do update set
  team_role_id = excluded.team_role_id,
  sessions_required = excluded.sessions_required,
  minutes_required = excluded.minutes_required,
  shifts_required = excluded.shifts_required,
  starts_at = excluded.starts_at;

insert into admin_levels (id, name, permissions, sort_order)
values
  ('leadership-editor', 'Leadership Editor', array['create_resources','edit_resources','move_resources_to_bin','create_announcements','delete_announcements','view_audit_logs','manage_activity_logs','manage_category_links'], 10),
  ('operations-admin', 'Operations Admin', array['create_resources','edit_resources','restore_from_bin','create_announcements','delete_announcements','view_audit_logs','manage_assignments'], 20),
  ('owner', 'Owner', array['create_resources','edit_resources','move_resources_to_bin','restore_from_bin','delete_permanently','create_announcements','delete_announcements','view_audit_logs','manage_activity_logs','manage_category_links','manage_assignments'], 999)
on conflict (id) do update set
  name = excluded.name,
  permissions = excluded.permissions,
  sort_order = excluded.sort_order,
  updated_at = now();
