create table clientes (
id uuid primary key default gen_random_uuid(),
nombre text,
telefono text,
created_at timestamp default now()
);
