create table if not exists public.movie_coziness_ratings (
    imdb_id text primary key,
    coziness_score smallint not null check (coziness_score between 1 and 10),
    updated_at timestamptz not null default now()
);

create or replace function public.touch_movie_coziness_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_touch_movie_coziness_updated_at on public.movie_coziness_ratings;
create trigger trg_touch_movie_coziness_updated_at
before update on public.movie_coziness_ratings
for each row
execute function public.touch_movie_coziness_updated_at();

create table if not exists public.movie_catalog (
    imdb_id text primary key,
    title text,
    release_year integer,
    poster_url text,
    primary_genre text,
    genres text[],
    updated_at timestamptz not null default now()
);

create or replace function public.touch_movie_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_touch_movie_catalog_updated_at on public.movie_catalog;
create trigger trg_touch_movie_catalog_updated_at
before update on public.movie_catalog
for each row
execute function public.touch_movie_catalog_updated_at();

create or replace view public.movie_coziness_leaderboard as
select
    r.imdb_id,
    r.coziness_score,
    r.updated_at,
    m.title,
    m.release_year,
    m.poster_url,
    m.primary_genre
from public.movie_coziness_ratings r
left join public.movie_catalog m on m.imdb_id = r.imdb_id;
