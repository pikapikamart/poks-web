-- Give workflow tables explicit domain owners so future features do not share
-- ambiguous storage names.

alter table public.operations rename to reminder_operations;
alter table public.outbox rename to reminder_outbox;
alter table public.recurrences rename to reminder_recurrences;
alter table public.activity rename to collaboration_activity;
alter table public.inbox rename to notification_inbox;
alter table public.devices rename to notification_devices;
alter table public.deliveries rename to notification_deliveries;
alter table public.device_deliveries rename to notification_device_deliveries;

alter table public.reminder_operations rename constraint operations_pkey to reminder_operations_pkey;
alter table public.reminder_outbox rename constraint outbox_pkey to reminder_outbox_pkey;
alter table public.reminder_outbox rename constraint outbox_reminder_id_fkey to reminder_outbox_reminder_id_fkey;
alter table public.reminder_outbox rename constraint outbox_reminder_id_revision_key to reminder_outbox_reminder_revision_key;
alter table public.reminder_recurrences rename constraint recurrences_pkey to reminder_recurrences_pkey;
alter table public.reminder_recurrences rename constraint recurrences_parent_reminder_id_fkey to reminder_recurrences_parent_fkey;
alter table public.reminder_recurrences rename constraint recurrences_next_reminder_id_fkey to reminder_recurrences_next_fkey;
alter table public.collaboration_activity rename constraint activity_pkey to collaboration_activity_pkey;
alter table public.collaboration_activity rename constraint activity_reminder_id_fkey to collaboration_activity_reminder_fkey;
alter table public.collaboration_activity rename constraint activity_space_id_fkey to collaboration_activity_space_fkey;
alter table public.notification_inbox rename constraint inbox_pkey to notification_inbox_pkey;
alter table public.notification_inbox rename constraint inbox_reminder_id_fkey to notification_inbox_reminder_fkey;
alter table public.notification_inbox rename constraint inbox_event_key_key to notification_inbox_event_key_key;
alter table public.notification_devices rename constraint devices_pkey to notification_devices_pkey;
alter table public.notification_deliveries rename constraint deliveries_pkey to notification_deliveries_pkey;
alter table public.notification_deliveries rename constraint deliveries_reminder_id_fkey to notification_deliveries_reminder_fkey;
alter table public.notification_deliveries rename constraint deliveries_reminder_revision_user_kind_generation_key to notification_deliveries_reminder_user_kind_key;
alter table public.notification_device_deliveries rename constraint device_deliveries_pkey to notification_device_deliveries_pkey;
alter table public.notification_device_deliveries rename constraint device_deliveries_delivery_id_fkey to notification_device_deliveries_delivery_fkey;

alter index public.deliveries_due rename to notification_deliveries_due;
alter index public.device_receipts rename to notification_device_receipts;
alter trigger activity_notifications on public.collaboration_activity rename to collaboration_activity_notifications;

-- PL/pgSQL relation names are stored as source text. Recreate affected
-- functions after PostgreSQL has renamed the physical tables and return types.
do $$
declare
  definition text;
begin
  for definition in
    select pg_get_functiondef(procedure.oid)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prokind in ('f', 'p')
      and pg_get_functiondef(procedure.oid) ~ '\m(operations|outbox|recurrences|activity|inbox|devices|deliveries|device_deliveries)\M'
  loop
    definition:=regexp_replace(definition,'\mdevice_deliveries\M','notification_device_deliveries','g');
    definition:=regexp_replace(definition,'\mdeliveries\M','notification_deliveries','g');
    definition:=regexp_replace(definition,'\mdevices\M','notification_devices','g');
    definition:=regexp_replace(definition,'\moperations\M','reminder_operations','g');
    definition:=regexp_replace(definition,'\moutbox\M','reminder_outbox','g');
    definition:=regexp_replace(definition,'\mrecurrences\M','reminder_recurrences','g');
    definition:=regexp_replace(definition,'\mactivity\M','collaboration_activity','g');
    definition:=regexp_replace(definition,'\minbox\M','notification_inbox','g');
    execute definition;
  end loop;
end $$;
