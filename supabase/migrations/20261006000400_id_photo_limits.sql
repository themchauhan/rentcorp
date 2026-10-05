-- Keep ID photo storage small on the free plan (1 GB Storage):
--  * the browser converts every photo to a ~1280px JPEG (usually 150–300 KB);
--  * the bucket and the app refuse anything over 2 MB;
--  * at most 4 photos kept per resident (front/back of up to two IDs);
--    deleting one frees a slot.

update storage.buckets set file_size_limit = 2097152 where id = 'resident-ids';

alter table public.pg_id_documents drop constraint pg_id_documents_size_bytes_check;
alter table public.pg_id_documents
  add constraint pg_id_documents_size_bytes_check check (size_bytes between 1 and 2097152);

create function private.limit_id_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise uploads for the same resident so the count is exact.
  perform 1 from public.rental_customers
  where id = new.customer_id and tenant_id = new.tenant_id for update;
  if (select count(*) from public.pg_id_documents
      where tenant_id = new.tenant_id and customer_id = new.customer_id and removed_at is null) >= 4 then
    raise exception 'Up to 4 ID photos per resident. Delete one first.' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger pg_id_documents_limit before insert on public.pg_id_documents
  for each row execute function private.limit_id_documents();
