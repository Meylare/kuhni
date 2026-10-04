create function public.record_price_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.price_history (price_item_id, old_price, new_price, changed_by)
    values (new.id, null, new.price, auth.uid());
  elsif new.price is distinct from old.price then
    insert into public.price_history (price_item_id, old_price, new_price, changed_by)
    values (new.id, old.price, new.price, auth.uid());
  end if;

  return new;
end;
$$;

create trigger price_items_record_price_history
after insert or update of price on public.price_items
for each row execute function public.record_price_history();
