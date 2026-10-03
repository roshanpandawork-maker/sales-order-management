-- Migrated from DEBTOR UPDATE(1).xlsx
-- Run this once AFTER 06_payment_desk.sql.
-- This imports the current Tally/Excel outstanding as opening balances.
do $$
declare
  r record;
  pid uuid;
begin
  insert into public.payment_parties(name,broker_name)
  values ("KAMADHENU FEEDS", "ASHOK AGRAWAL")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("KAMADHENU FEEDS")) order by created_at limit 1;
  update public.payment_parties set broker_name="ASHOK AGRAWAL" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,26186784,25445140,"8DAY","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("VAISHNAVI AGRO FARM-MITTAGU", "ASHOK AGRAWAL")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("VAISHNAVI AGRO FARM-MITTAGU")) order by created_at limit 1;
  update public.payment_parties set broker_name="ASHOK AGRAWAL" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,6364297,4985929,"199DAY","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("GODREJ AGROVET", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("GODREJ AGROVET")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,30350253.4,22455741,"35 DAY","Running")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("PASUPATI AGROVET", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("PASUPATI AGROVET")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,22851007,10372750,"3DAYS","Running")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("BARAMATI CATTEL FEEDS", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("BARAMATI CATTEL FEEDS")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,7396096,7202905,"45DAYS","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("PRATISHTHA COMMERCIAL", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("PRATISHTHA COMMERCIAL")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,13222886,9407250,"16DAYS","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("JAPFA COMFEEDS", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("JAPFA COMFEEDS")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,16004154,0,"14DAYS","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("AROHI FOODS AND FEEDS", "DILIP JALAN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("AROHI FOODS AND FEEDS")) order by created_at limit 1;
  update public.payment_parties set broker_name="DILIP JALAN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,3147249,1562983,"37DAY","Pending")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("AVDESH SHANKARLAL", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("AVDESH SHANKARLAL")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,3105495,3097495,"OK","LEDGER")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("KANHEIYA AGRO", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("KANHEIYA AGRO")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,2164456,2143660,"OK","LEDGER")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("NUTRIKRAFT INDIA -PERUNDURAI", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("NUTRIKRAFT INDIA -PERUNDURAI")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,16421321,8696994,"NO DUE","Running")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("ACE VENTURE", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("ACE VENTURE")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,3686755,3678255,"26DAYS","LEDGER")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("SHRINIDHI FEEDS", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("SHRINIDHI FEEDS")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,18856228,6443113,"34DAYS","Running")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("NUTRIKRAFT INDIA-CUTTACK", "SUSHIL JAIN")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("NUTRIKRAFT INDIA-CUTTACK")) order by created_at limit 1;
  update public.payment_parties set broker_name="SUSHIL JAIN" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,8864257,5635015,"NO DUE","Running")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("BUYO INDIA PVT LTD", "DIRECT")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("BUYO INDIA PVT LTD")) order by created_at limit 1;
  update public.payment_parties set broker_name="DIRECT" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,940294,0,"262DAYS","")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

  insert into public.payment_parties(name,broker_name)
  values ("MAA TARINI AQUAICS", "DIRECT")
  on conflict do nothing;

  select id into pid from public.payment_parties where lower(trim(name))=lower(trim("MAA TARINI AQUAICS")) order by created_at limit 1;
  update public.payment_parties set broker_name="DIRECT" where id=pid;

  insert into public.payment_opening_balances(party_id,opening_date,total_amount,received_amount,due_text,status)
  values(pid,current_date,735268,590000,"37 DAYS","")
  on conflict (party_id) do update set
    opening_date=excluded.opening_date,
    total_amount=excluded.total_amount,
    received_amount=excluded.received_amount,
    due_text=excluded.due_text,
    status=excluded.status,
    updated_at=now();

end $$;

select p.name,p.broker_name,o.total_amount,o.received_amount,
       greatest(o.total_amount-o.received_amount,0) as opening_pending,
       o.due_text,o.status
from public.payment_parties p
join public.payment_opening_balances o on o.party_id=p.id
order by p.broker_name,p.name;
