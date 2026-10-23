-- =====================================================================
-- Mascota de pareja — esquema de Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin perder datos (usa "if not exists" / "or replace").
--
-- Seguridad
--  * RLS activado: solo los miembros de una mascota pueden leerla.
--  * Nadie puede escribir directamente en las tablas: todo cambio pasa por funciones
--    (security definer) que comprueban la pertenencia y aplican las reglas con la hora
--    del servidor (tiempos de espera, límites diarios, vidas, mudanza, racha).
--  * Máximo dos cuidadores por mascota.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  birth_date date not null,
  tz text not null default 'America/La_Paz',
  invite_code text not null unique,
  settings jsonb not null default '{"stageDays":[0,600,900],"minCareDays":[0,20,40]}',
  state jsonb not null,
  version int not null default 1,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_members (
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_care_at timestamptz,
  primary key (pet_id, user_id)
);

create table if not exists public.care_log (
  id bigserial primary key,
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid,
  display_name text,
  action text not null,
  item text,
  client_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists care_log_pet_idx on public.care_log (pet_id, created_at desc);

alter table public.pets enable row level security;
alter table public.pet_members enable row level security;
alter table public.care_log enable row level security;

-- ¿El usuario actual es miembro de la mascota?
create or replace function public.is_member(p_pet uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pet_members where pet_id = p_pet and user_id = auth.uid());
$$;

drop policy if exists pets_select on public.pets;
create policy pets_select on public.pets for select using (public.is_member(id));
drop policy if exists members_select on public.pet_members;
create policy members_select on public.pet_members for select using (public.is_member(pet_id));
drop policy if exists log_select on public.care_log;
create policy log_select on public.care_log for select using (public.is_member(pet_id));
-- Sin políticas de insert/update/delete: las escrituras solo ocurren dentro de las funciones.
grant select on public.pets, public.pet_members, public.care_log to authenticated;
revoke insert, update, delete on public.pets, public.pet_members, public.care_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- Reglas (deben coincidir con src/app/rules.js)
-- ---------------------------------------------------------------------
create or replace function public._rules() returns jsonb language sql immutable as $$
  select '{
    "decay": {"hunger": 3.2, "happiness": 2.4, "energy": 2, "hygiene": 1.6},
    "floor": 5, "lives": 3,
    "actions": {
      "feed":  {"cooldownMin": 3,   "dailyMax": 10},
      "pet":   {"cooldownMin": 2,   "dailyMax": 20, "effect": {"happiness": 6, "xp": 1}},
      "play":  {"cooldownMin": 15,  "dailyMax": 8,  "minEnergy": 15, "effect": {"happiness": 14, "energy": -12, "hunger": -6, "xp": 5}},
      "bath":  {"cooldownMin": 60,  "dailyMax": 4,  "effect": {"hygiene": 45, "happiness": 3, "xp": 3}},
      "sleep": {"cooldownMin": 120, "dailyMax": 3,  "effect": {"energy": 40, "xp": 2}}
    },
    "foods": {
      "manzana":  {"hunger": 18, "happiness": 4,  "energy": 2,  "xp": 4},
      "galleta":  {"hunger": 14, "happiness": 8,  "energy": 3,  "xp": 4},
      "caramelo": {"hunger": 6,  "happiness": 14, "energy": 6,  "xp": 3},
      "pastel":   {"hunger": 24, "happiness": 16, "energy": 4,  "xp": 8},
      "onigiri":  {"hunger": 32, "happiness": 10, "energy": 12, "xp": 10},
      "estrella": {"hunger": 20, "happiness": 28, "energy": 20, "xp": 25}
    },
    "foodLimits": {"estrella": 1, "pastel": 3, "onigiri": 3}
  }'::jsonb;
$$;

create or replace function public._new_state(p_today date) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'stats', jsonb_build_object('hunger', 70, 'happiness', 70, 'energy', 80, 'hygiene', 80),
    'statsAt', to_jsonb(now()),
    'xp', 0, 'careDaysTotal', 0, 'lastCareDay', null, 'createdDay', p_today::text,
    'days', '{}'::jsonb, 'today', jsonb_build_object('day', p_today::text, 'counts', '{}'::jsonb, 'last', '{}'::jsonb),
    'streak', 0, 'bestStreak', 0, 'streakDay', null, 'movedOutAt', null, 'evolutions', '[]'::jsonb
  );
$$;

-- Vista completa de una mascota para el cliente (solo miembros).
create or replace function public.pet_view(p_pet uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_member(p_pet) then raise exception 'not_member'; end if;
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'birthDate', p.birth_date::text, 'tz', p.tz, 'inviteCode', p.invite_code,
    'settings', p.settings, 'state', p.state, 'version', p.version, 'serverNow', now(),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', m.display_name,
        'lastSeenAt', m.last_seen_at, 'lastCareAt', m.last_care_at) order by m.joined_at)
      from pet_members m where m.pet_id = p.id), '[]'::jsonb)
  ) into v from pets p where p.id = p_pet;
  return v;
end $$;

create or replace function public.my_pets() returns setof uuid
language sql stable security definer set search_path = public as $$
  select pet_id from pet_members where user_id = auth.uid() order by joined_at desc;
$$;

create or replace function public.create_pet(p_name text, p_birth date, p_display text, p_tz text default 'America/La_Paz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_today date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_birth > (now() at time zone p_tz)::date then raise exception 'birth_in_future'; end if;
  v_today := (now() at time zone p_tz)::date;
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    exit when char_length(v_code) = 6 and not exists (select 1 from pets where invite_code = v_code);
  end loop;
  insert into pets (name, birth_date, tz, invite_code, state)
    values (trim(p_name), p_birth, p_tz, v_code, _new_state(v_today)) returning id into v_id;
  insert into pet_members (pet_id, user_id, display_name) values (v_id, auth.uid(), trim(p_display));
  return pet_view(v_id);
end $$;

create or replace function public.join_pet(p_code text, p_display text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into v_id from pets where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid_code'; end if;
  if exists (select 1 from pet_members where pet_id = v_id and user_id = auth.uid()) then
    update pet_members set display_name = trim(p_display), last_seen_at = now() where pet_id = v_id and user_id = auth.uid();
  else
    select count(*) into v_count from pet_members where pet_id = v_id;
    if v_count >= 2 then
      -- recuperar el acceso desde un dispositivo nuevo: mismo código y mismo nombre
      update pet_members set user_id = auth.uid(), last_seen_at = now()
        where pet_id = v_id and lower(display_name) = lower(trim(p_display));
      if not found then raise exception 'pet_full'; end if;
    else
      insert into pet_members (pet_id, user_id, display_name) values (v_id, auth.uid(), trim(p_display));
    end if;
  end if;
  return pet_view(v_id);
end $$;

create or replace function public.touch(p_pet uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pet_members set last_seen_at = now() where pet_id = p_pet and user_id = auth.uid();
end $$;

-- Acción de cuidado validada en el servidor.
-- Devuelve {ok, reason?, pet, log?}. Repetir el mismo p_client no duplica recompensas.
create or replace function public.perform_action(p_pet uuid, p_action text, p_item text, p_client uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb := _rules();
  p pets%rowtype;
  s jsonb; t jsonb; def jsonb; eff jsonb; stats jsonb;
  v_today date; v_ref date; v_missed int; v_hours numeric; v_name text;
  k text; v_last timestamptz; v_cnt int; v_list jsonb; v_before int; v_after int;
  v_uid text := auth.uid()::text;
begin
  if not is_member(p_pet) then raise exception 'not_member'; end if;
  if exists (select 1 from care_log where client_id = p_client) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'pet', pet_view(p_pet));
  end if;
  select * into p from pets where id = p_pet for update;
  s := p.state;
  v_today := (now() at time zone p.tz)::date;
  update pet_members set last_seen_at = now() where pet_id = p_pet and user_id = auth.uid();

  -- vidas / mudanza
  v_ref := coalesce(s->>'lastCareDay', s->>'createdDay')::date;
  v_missed := greatest(0, v_today - v_ref - 1);
  if s->>'movedOutAt' is not null or v_missed >= (r->>'lives')::int then
    if s->>'movedOutAt' is null then
      s := jsonb_set(s, '{movedOutAt}', to_jsonb((v_ref + (r->>'lives')::int)::text));
      update pets set state = s, version = version + 1, updated_at = now() where id = p_pet;
    end if;
    return jsonb_build_object('ok', false, 'reason', 'moved_out', 'pet', pet_view(p_pet));
  end if;

  def := r->'actions'->p_action;
  if def is null then return jsonb_build_object('ok', false, 'reason', 'unknown_action', 'pet', pet_view(p_pet)); end if;
  if p_action = 'feed' then
    eff := r->'foods'->p_item;
    if eff is null then return jsonb_build_object('ok', false, 'reason', 'unknown_food', 'pet', pet_view(p_pet)); end if;
  else
    eff := def->'effect';
  end if;

  -- contadores del día
  t := s->'today';
  if t->>'day' is distinct from v_today::text then
    t := jsonb_build_object('day', v_today::text, 'counts', '{}'::jsonb, 'last', '{}'::jsonb);
  end if;
  if coalesce((t->'counts'->>p_action)::int, 0) >= (def->>'dailyMax')::int then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'pet', pet_view(p_pet));
  end if;
  if p_action = 'feed' and r->'foodLimits' ? p_item
     and coalesce((t->'counts'->>('feed:' || p_item))::int, 0) >= (r->'foodLimits'->>p_item)::int then
    return jsonb_build_object('ok', false, 'reason', 'food_limit', 'pet', pet_view(p_pet));
  end if;
  v_last := (t->'last'->>p_action)::timestamptz;
  if v_last is not null and now() - v_last < make_interval(mins => (def->>'cooldownMin')::int) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown',
      'waitMin', ceil(extract(epoch from (v_last + make_interval(mins => (def->>'cooldownMin')::int) - now())) / 60),
      'pet', pet_view(p_pet));
  end if;

  -- decaimiento hasta ahora (hora del servidor)
  v_hours := greatest(0, extract(epoch from (now() - (s->>'statsAt')::timestamptz)) / 3600);
  stats := '{}'::jsonb;
  for k in select jsonb_object_keys(r->'decay') loop
    stats := stats || jsonb_build_object(k, greatest((r->>'floor')::numeric, least(100,
      coalesce((s->'stats'->>k)::numeric, 50) - (r->'decay'->>k)::numeric * v_hours)));
  end loop;
  if def ? 'minEnergy' and (stats->>'energy')::numeric < (def->>'minEnergy')::numeric then
    return jsonb_build_object('ok', false, 'reason', 'too_tired', 'pet', pet_view(p_pet));
  end if;
  -- efecto
  for k in select jsonb_object_keys(r->'decay') loop
    if eff ? k then
      stats := jsonb_set(stats, array[k], to_jsonb(greatest((r->>'floor')::numeric, least(100, (stats->>k)::numeric + (eff->>k)::numeric))));
    end if;
  end loop;
  s := jsonb_set(s, '{stats}', stats);
  s := jsonb_set(s, '{statsAt}', to_jsonb(now()));
  s := jsonb_set(s, '{xp}', to_jsonb(coalesce((s->>'xp')::int, 0) + coalesce((eff->>'xp')::int, 0)));
  t := jsonb_set(t, array['counts', p_action], to_jsonb(coalesce((t->'counts'->>p_action)::int, 0) + 1));
  if p_action = 'feed' then
    t := jsonb_set(t, array['counts', 'feed:' || p_item], to_jsonb(coalesce((t->'counts'->>('feed:' || p_item))::int, 0) + 1));
  end if;
  t := jsonb_set(t, array['last', p_action], to_jsonb(now()));
  s := jsonb_set(s, '{today}', t);

  -- día de cuidado y racha compartida
  if s->>'lastCareDay' is distinct from v_today::text then
    s := jsonb_set(s, '{careDaysTotal}', to_jsonb(coalesce((s->>'careDaysTotal')::int, 0) + 1));
  end if;
  s := jsonb_set(s, '{lastCareDay}', to_jsonb(v_today::text));
  v_list := coalesce(s->'days'->v_today::text, '[]'::jsonb);
  v_before := jsonb_array_length(v_list);
  if not v_list ? v_uid then v_list := v_list || to_jsonb(v_uid); end if;
  v_after := jsonb_array_length(v_list);
  s := jsonb_set(s, array['days', v_today::text], v_list);
  if v_before < 2 and v_after >= 2 then
    if s->>'streakDay' = (v_today - 1)::text then
      s := jsonb_set(s, '{streak}', to_jsonb(coalesce((s->>'streak')::int, 0) + 1));
    else
      s := jsonb_set(s, '{streak}', '1'::jsonb);
    end if;
    s := jsonb_set(s, '{streakDay}', to_jsonb(v_today::text));
    s := jsonb_set(s, '{bestStreak}', to_jsonb(greatest(coalesce((s->>'bestStreak')::int, 0), (s->>'streak')::int)));
  end if;
  -- conservar solo 30 días de asistencia
  s := jsonb_set(s, '{days}', coalesce((select jsonb_object_agg(key, value) from jsonb_each(s->'days')
         where key::date >= v_today - 30), '{}'::jsonb));

  update pets set state = s, version = version + 1, updated_at = now() where id = p_pet;
  update pet_members set last_care_at = now() where pet_id = p_pet and user_id = auth.uid()
    returning display_name into v_name;
  insert into care_log (pet_id, user_id, display_name, action, item, client_id)
    values (p_pet, auth.uid(), v_name, p_action, p_item, p_client);
  return jsonb_build_object('ok', true, 'pet', pet_view(p_pet),
    'log', jsonb_build_object('name', v_name, 'action', p_action, 'item', p_item, 'at', now()));
end $$;

-- Registrar una evolución (solo si la edad y los cuidados la permiten).
create or replace function public.record_evolution(p_pet uuid, p_stage int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p pets%rowtype; v_age int; v_ok boolean;
begin
  if not is_member(p_pet) then raise exception 'not_member'; end if;
  select * into p from pets where id = p_pet for update;
  v_age := (now() at time zone p.tz)::date - p.birth_date;
  v_ok := p_stage between 2 and jsonb_array_length(p.settings->'stageDays')
    and v_age >= (p.settings->'stageDays'->>(p_stage - 1))::int
    and coalesce((p.state->>'careDaysTotal')::int, 0) >= coalesce((p.settings->'minCareDays'->>(p_stage - 1))::int, 0);
  if v_ok and not exists (select 1 from jsonb_array_elements(p.state->'evolutions') e where (e->>'stage')::int = p_stage) then
    update pets set state = jsonb_set(state, '{evolutions}', (state->'evolutions') || jsonb_build_object('stage', p_stage, 'at', now())),
      version = version + 1, updated_at = now() where id = p_pet;
  end if;
  return pet_view(p_pet);
end $$;

-- Cambiar nombre, fecha de nacimiento o días de evolución (cualquiera de los dos).
create or replace function public.update_pet(p_pet uuid, p_name text, p_birth date, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not is_member(p_pet) then raise exception 'not_member'; end if;
  if p_settings is not null then
    d := p_settings->'stageDays';
    if jsonb_typeof(d) <> 'array' or jsonb_array_length(d) < 2 or (d->>0)::int <> 0
       or exists (select 1 from generate_series(1, jsonb_array_length(d) - 1) i where (d->>i)::int <= (d->>(i - 1))::int) then
      raise exception 'invalid_settings';
    end if;
  end if;
  update pets set
    name = coalesce(nullif(trim(p_name), ''), name),
    birth_date = coalesce(p_birth, birth_date),
    settings = coalesce(p_settings, settings),
    version = version + 1, updated_at = now()
  where id = p_pet;
  return pet_view(p_pet);
end $$;

create or replace function public.set_my_name(p_pet uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update pet_members set display_name = trim(p_name) where pet_id = p_pet and user_id = auth.uid();
  return pet_view(p_pet);
end $$;

-- Volver a empezar después de la mudanza (nueva fecha de nacimiento).
create or replace function public.reset_pet(p_pet uuid, p_birth date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tz text;
begin
  if not is_member(p_pet) then raise exception 'not_member'; end if;
  select tz into v_tz from pets where id = p_pet;
  update pets set birth_date = coalesce(p_birth, (now() at time zone v_tz)::date),
    state = _new_state((now() at time zone v_tz)::date), version = version + 1, updated_at = now()
  where id = p_pet;
  insert into care_log (pet_id, user_id, display_name, action)
    select p_pet, auth.uid(), display_name, 'reset' from pet_members where pet_id = p_pet and user_id = auth.uid();
  return pet_view(p_pet);
end $$;

revoke all on function public._rules(), public._new_state(date) from public, anon;
grant execute on function public.pet_view(uuid), public.my_pets(), public.create_pet(text, date, text, text),
  public.join_pet(text, text), public.touch(uuid), public.perform_action(uuid, text, text, uuid),
  public.record_evolution(uuid, int), public.update_pet(uuid, text, date, jsonb), public.set_my_name(uuid, text),
  public.reset_pet(uuid, date), public.is_member(uuid) to authenticated;

-- Tiempo real: avisar a la pareja de cada cambio
do $$ begin
  begin alter publication supabase_realtime add table public.pets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.care_log; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pet_members; exception when duplicate_object then null; end;
end $$;
