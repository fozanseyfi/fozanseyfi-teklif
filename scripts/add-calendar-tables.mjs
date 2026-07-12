// Takvim + Bildirim tablolarini ekler (solar schema):
// - solar.calendar_events      : org geneli etkinlikler
// - solar.calendar_attendees   : etkinlik katilimcilari (org uyeleri)
// - solar.calendar_reminders   : kisi bazli hatirlatmalar
// - solar.notifications        : uygulama-ici bildirimler (zil + /notifications)
//
// Idempotent — tekrar calistirilabilir, hata vermez.
//   node scripts/add-calendar-tables.mjs
import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL / DATABASE_URL bulunamadi (.env).");
  process.exit(1);
}

const SQL = `
do $$ begin create type solar."CalendarEventType" as enum ('TOPLANTI','GOREV','HATIRLATMA','TERMIN','ZIYARET','ARAMA','DIGER');
exception when duplicate_object then null; end $$;
do $$ begin create type solar."CalendarPriority" as enum ('DUSUK','NORMAL','YUKSEK');
exception when duplicate_object then null; end $$;
do $$ begin create type solar."CalendarEventStatus" as enum ('PLANLANDI','TAMAMLANDI','IPTAL');
exception when duplicate_object then null; end $$;
do $$ begin create type solar."CalendarVisibility" as enum ('ORG','KATILIMCILAR','OZEL');
exception when duplicate_object then null; end $$;
do $$ begin create type solar."AttendeeStatus" as enum ('DAVETLI','KABUL','RET');
exception when duplicate_object then null; end $$;

create table if not exists solar.calendar_events (
  id              text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_id   uuid not null,
  title           text not null,
  description     text,
  type            solar."CalendarEventType"   not null default 'TOPLANTI',
  start_at        timestamptz not null,
  end_at          timestamptz,
  all_day         boolean not null default false,
  location        text,
  priority        solar."CalendarPriority"    not null default 'NORMAL',
  status          solar."CalendarEventStatus" not null default 'PLANLANDI',
  visibility      solar."CalendarVisibility"  not null default 'ORG',
  project_id      text references solar."Project"(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists calendar_events_org_start_idx on solar.calendar_events (organization_id, start_at);
create index if not exists calendar_events_created_by_idx on solar.calendar_events (created_by_id);
create index if not exists calendar_events_project_idx on solar.calendar_events (project_id);

create table if not exists solar.calendar_attendees (
  id       text primary key,
  event_id text not null references solar.calendar_events(id) on delete cascade,
  user_id  uuid not null,
  status   solar."AttendeeStatus" not null default 'DAVETLI'
);
create unique index if not exists calendar_attendees_event_user_key on solar.calendar_attendees (event_id, user_id);
create index if not exists calendar_attendees_user_idx on solar.calendar_attendees (user_id);

create table if not exists solar.calendar_reminders (
  id             text primary key,
  event_id       text not null references solar.calendar_events(id) on delete cascade,
  user_id        uuid not null,
  minutes_before integer not null,
  remind_at      timestamptz not null,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists calendar_reminders_event_user_min_key on solar.calendar_reminders (event_id, user_id, minutes_before);
create index if not exists calendar_reminders_due_idx on solar.calendar_reminders (remind_at, sent_at);
create index if not exists calendar_reminders_user_idx on solar.calendar_reminders (user_id, sent_at);

create table if not exists solar.notifications (
  id              text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null,
  type            text not null,
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_user_read_idx on solar.notifications (user_id, read_at);
create index if not exists notifications_org_idx on solar.notifications (organization_id);
`;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(SQL);

const { rows } = await client.query(`
  select table_name from information_schema.tables
  where table_schema = 'solar'
    and table_name in ('calendar_events','calendar_attendees','calendar_reminders','notifications')
  order by table_name`);
console.log("Olusturulan/var olan tablolar:", rows.map((r) => r.table_name).join(", "));
await client.end();
