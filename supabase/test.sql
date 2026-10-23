-- Prueba funcional del esquema (se ejecuta en un Postgres local con auth simulado).
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'
\set C 'cccccccc-0000-0000-0000-000000000003'
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select (create_pet('Mushu', '2025-09-25', 'Ana'))->>'inviteCode' as code \gset
select id as pet from pets \gset
\echo '1. creada, codigo:' :code
select (perform_action(:'pet', 'feed', 'manzana', '11111111-1111-1111-1111-111111111111'))->>'ok' as feed1;
select (perform_action(:'pet', 'feed', 'manzana', '11111111-1111-1111-1111-111111111111'))->>'duplicate' as dup_no_double;
select (perform_action(:'pet', 'feed', 'galleta', gen_random_uuid()))->>'reason' as cooldown;
select state->>'xp' as xp_tras_duplicado from pets;
\echo '2. C no ve la mascota:'
select set_config('request.jwt.claim.sub', :'C', false);
select count(*) as c_ve from pets;
\echo '3. B se une; C no puede (maximo dos)'
select set_config('request.jwt.claim.sub', :'B', false);
select jsonb_array_length((join_pet(:'code', 'Leo'))->'members') as miembros;
select (perform_action(:'pet', 'pet', null, gen_random_uuid()))->'pet'->'state'->>'streak' as racha_hoy;
select set_config('request.jwt.claim.sub', :'C', false);
select set_config('x.code', :'code', false);
do $$ begin perform join_pet(current_setting('x.code'), 'Intruso'); exception when others then raise notice 'join C: %', sqlerrm; end $$;
\echo '4. escritura directa bloqueada'
select set_config('request.jwt.claim.sub', :'A', false);
do $$ begin update pets set name = 'X'; raise notice 'update directo: filas %', (select count(*) from pets where name = 'X'); exception when others then raise notice 'update directo: %', sqlerrm; end $$;
\echo '5. tres dias sin cuidados -> mudanza'
reset role;
update pets set state = jsonb_set(state, '{lastCareDay}', to_jsonb(((now() at time zone tz)::date - 4)::text));
set role authenticated;
select (perform_action(:'pet', 'pet', null, gen_random_uuid()))->>'reason' as razon;
select state->>'movedOutAt' as mudanza from pets;
\echo '6. evolucion: no antes de tiempo'
select jsonb_array_length((record_evolution(:'pet', 2))->'state'->'evolutions') as evoluciones;
select count(*) as registros from care_log;
\echo '7. recuperar acceso desde otro dispositivo (mismo codigo y nombre)'
reset role;
insert into auth.users values ('dddddddd-0000-0000-0000-000000000004');
set role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', false);
select (join_pet(:'code', 'leo'))->'members' as miembros_tras_recuperar;
