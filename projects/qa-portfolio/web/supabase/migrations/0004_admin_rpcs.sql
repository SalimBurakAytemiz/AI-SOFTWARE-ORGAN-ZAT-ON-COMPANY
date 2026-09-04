-- =============================================================================
-- 0004_admin_rpcs.sql - Admin yayın durumu geçişleri (transactional RPC)
-- Kaynak: projects/qa-portfolio/planning/02-database-schema.md §2.8
--         projects/qa-portfolio/planning/14-planning-review.md (R7 - "transactional publish")
--         src/lib/admin/project-store.ts (mock geçiş makinesi - buraya taşınır)
--
-- İŞ KURALI: Yayın durumu geçişi + denetim (audit) kaydı TEK atomik işlemdir.
-- "Yayınladım ama audit'e yazılmadı" ya da yarım durum oluşamaz. Her RPC
-- SECURITY DEFINER'dır ve İLK İŞ olarak public.is_admin() kontrol eder -
-- yetkisiz çağrı exception ile reddedilir (RLS'e ek katman; ADR-0006).
--
-- Geçerli geçişler (project-store.ts ile birebir):
--   draft --publish--> published(visible=true)
--   published --unpublish--> draft
--   published --hide--> published(visible=false)
--   * --show--> visible=true
--   * --archive--> archived
--   archived --restore--> draft
-- Arşivlenmiş proje DOĞRUDAN yayınlanamaz (önce restore).
-- =============================================================================

-- content_audit.actor_user_id: uygulama ayrıca göndermek zorunda kalmasın diye
-- oturumdaki kullanıcıya (auth.uid()) varsayılan bağlanır. actor_name yine
-- uygulamadan gelir (görünen ad). append-only kuralı değişmez.
alter table public.content_audit
  alter column actor_user_id set default auth.uid();

-- -----------------------------------------------------------------------------
-- Ortak denetim yazıcı - RPC'ler içinden çağrılır (SECURITY DEFINER bağlamında
-- auth.uid() yine oturumdaki kullanıcıdır çünkü DEFINER = postgres değil,
-- fonksiyon current_setting üzerinden JWT'yi görür).
-- -----------------------------------------------------------------------------
create or replace function public.admin_audit(
  p_actor_name text, p_entity_type text, p_entity_id text, p_action text, p_summary text
) returns void
language sql security definer set search_path = public as $$
  insert into public.content_audit (actor_user_id, actor_name, entity_type, entity_id, action, summary)
  values (auth.uid(), coalesce(p_actor_name, 'admin'), p_entity_type, p_entity_id, p_action, coalesce(p_summary, ''));
$$;

-- -----------------------------------------------------------------------------
-- Proje yayın durumu geçişi - tek giriş noktası.
-- p_transition: 'publish' | 'unpublish' | 'hide' | 'show' | 'archive' | 'restore'
-- Dönüş: güncellenmiş projenin (id, status, visible) satırı.
-- -----------------------------------------------------------------------------
create or replace function public.admin_project_transition(
  p_id uuid, p_transition text, p_actor_name text default 'admin'
) returns table (id uuid, status content_status, visible boolean)
language plpgsql security definer set search_path = public as $$
declare
  cur public.projects%rowtype;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz: yalnızca admin' using errcode = '42501';
  end if;

  select * into cur from public.projects p where p.id = p_id for update;
  if not found then
    raise exception 'proje bulunamadı: %', p_id using errcode = 'P0002';
  end if;

  if p_transition = 'publish' then
    if cur.status = 'archived' then
      raise exception 'arşivlenmiş proje doğrudan yayınlanamaz; önce geri yükleyin' using errcode = '22023';
    end if;
    update public.projects
      set status = 'published', visible = true,
          published_at = coalesce(published_at, now())
      where projects.id = p_id;

  elsif p_transition = 'unpublish' then
    if cur.status <> 'published' then
      raise exception 'yalnızca yayınlanmış proje yayından kaldırılabilir' using errcode = '22023';
    end if;
    update public.projects set status = 'draft' where projects.id = p_id;

  elsif p_transition = 'hide' then
    if cur.status <> 'published' then
      raise exception 'yalnızca yayınlanmış proje gizlenebilir' using errcode = '22023';
    end if;
    update public.projects set visible = false where projects.id = p_id;

  elsif p_transition = 'show' then
    update public.projects set visible = true where projects.id = p_id;

  elsif p_transition = 'archive' then
    update public.projects set status = 'archived' where projects.id = p_id;

  elsif p_transition = 'restore' then
    if cur.status <> 'archived' then
      raise exception 'yalnızca arşivlenmiş proje geri yüklenebilir' using errcode = '22023';
    end if;
    update public.projects set status = 'draft' where projects.id = p_id;

  else
    raise exception 'geçersiz geçiş: %', p_transition using errcode = '22023';
  end if;

  perform public.admin_audit(
    p_actor_name, 'project', p_id::text, p_transition,
    format('%s: %s -> %s', cur.slug, cur.status, p_transition)
  );

  return query
    select p.id, p.status, p.visible from public.projects p where p.id = p_id;
end;
$$;

-- Anon/authenticated çağrı yüzeyi: fonksiyon is_admin() kontrolü yaptığı için
-- execute yetkisi authenticated'e verilir (anon zaten is_admin()=false'ta patlar).
revoke all on function public.admin_project_transition(uuid, text, text) from public;
grant execute on function public.admin_project_transition(uuid, text, text) to authenticated;
revoke all on function public.admin_audit(text, text, text, text, text) from public;
grant execute on function public.admin_audit(text, text, text, text, text) to authenticated;
