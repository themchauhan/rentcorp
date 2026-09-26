-- Phase 6: "overdue" is computed when read (open booking, past its
-- expected return date, items still out) instead of by a scheduled job.
-- Stock commitments must therefore treat an open booking as occupying its
-- items from its start date until the later of its expected return date
-- and today, since overdue items are still with the customer.

create or replace function public.item_commitments(p_start date, p_end date)
returns table (rental_item_id uuid, committed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select li.rental_item_id, sum(li.quantity)::integer
  from public.rental_order_items li
  join public.rental_orders o on o.id = li.rental_order_id
  where o.status in ('ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE')
    and o.event_start_date <= p_end
    and greatest(o.expected_return_date, (now() at time zone 'Asia/Kolkata')::date) >= p_start
  group by li.rental_item_id
$$;
