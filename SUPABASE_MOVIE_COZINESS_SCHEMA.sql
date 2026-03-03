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
