-- Migrated from DEBTOR UPDATE(1).xlsx
-- Run this once AFTER 06_payment_desk.sql.
-- This imports the current Tally/Excel outstanding as opening balances.
-- Text values use PostgreSQL single quotes. DIRECT rows use NULL status.

do $$
declare
  r record;
  pid uuid;
begin
  for r in
    select *
    from (values
      ('ASHOK AGRAWAL','KAMADHENU FEEDS',26186784::numeric,25445140::numeric,'8DAY','Pending'),
      ('ASHOK AGRAWAL','VAISHNAVI AGRO FARM-MITTAGU',6364297::numeric,4985929::numeric,'199DAY','Pending'),
      ('DILIP JALAN','GODREJ AGROVET',30350253.4::numeric,22455741::numeric,'35 DAY','Running'),
      ('DILIP JALAN','PASUPATI AGROVET',22851007::numeric,10372750::numeric,'3DAYS','Running'),
      ('DILIP JALAN','BARAMATI CATTEL FEEDS',7396096::numeric,7202905::numeric,'45DAYS','Pending'),
      ('DILIP JALAN','PRATISHTHA COMMERCIAL',13222886::numeric,9407250::numeric,'16DAYS','Pending'),
      ('DILIP JALAN','JAPFA COMFEEDS',16004154::numeric,0::numeric,'14DAYS','Pending'),
      ('DILIP JALAN','AROHI FOODS AND FEEDS',3147249::numeric,1562983::numeric,'37DAY','Pending'),
      ('SUSHIL JAIN','AVDESH SHANKARLAL',3105495::numeric,3097495::numeric,'OK','LEDGER'),
      ('SUSHIL JAIN','KANHEIYA AGRO',2164456::numeric,2143660::numeric,'OK','LEDGER'),
      ('SUSHIL JAIN','NUTRIKRAFT INDIA -PERUNDURAI',16421321::numeric,8696994::numeric,'NO DUE','Running'),
      ('SUSHIL JAIN','ACE VENTURE',3686755::numeric,3678255::numeric,'26DAYS','LEDGER'),
      ('SUSHIL JAIN','SHRINIDHI FEEDS',18856228::numeric,6443113::numeric,'34DAYS','Running'),
      ('SUSHIL JAIN','NUTRIKRAFT INDIA-CUTTACK',8864257::numeric,5635015::numeric,'NO DUE','Running'),
      ('DIRECT','BUYO INDIA PVT LTD',940294::numeric,0::numeric,'262DAYS',NULL::text),
      ('DIRECT','MAA TARINI AQUAICS',735268::numeric,590000::numeric,'37 DAYS',NULL::text)
    ) as v(broker_name,party_name,total_amount,received_amount,due_text,status)
  loop
    select id into pid
    from public.payment_parties
    where lower(trim(name)) = lower(trim(r.party_name))
    order by created_at
    limit 1;

    if pid is null then
      insert into public.payment_parties(name,broker_name)
      values (r.party_name,r.broker_name)
      returning id into pid;
    else
      update public.payment_parties
      set broker_name=r.broker_name
      where id=pid;
    end if;

    insert into public.payment_opening_balances(
      party_id,opening_date,total_amount,received_amount,due_text,status
    )
    values(
      pid,current_date,r.total_amount,r.received_amount,r.due_text,r.status
    )
    on conflict (party_id) do update set
      opening_date=excluded.opening_date,
      total_amount=excluded.total_amount,
      received_amount=excluded.received_amount,
      due_text=excluded.due_text,
      status=excluded.status,
      updated_at=now();
  end loop;
end $$;

select
  p.name,
  p.broker_name,
  o.total_amount,
  o.received_amount,
  greatest(o.total_amount-o.received_amount,0) as opening_pending,
  o.due_text,
  o.status
from public.payment_parties p
join public.payment_opening_balances o on o.party_id=p.id
order by p.broker_name,p.name;
