-- 인스타 릴스 자동 올리기 깨우기(app/reels-tick-api.ts).
-- GitHub 예약 실행이 자주 빠져서, DB의 pg_cron이 10:07~23:37(한국) 30분마다 서버 함수 /api/reels-tick 을 부른다.
-- 서버 함수가 GitHub 워크플로를 깨우고, 워크플로가 "올릴 차례인지" 본 뒤 하루 한 번만 올린다.
-- 되돌리기: select cron.unschedule('reels-tick'); drop table reels_tick;
create table if not exists reels_tick (id int primary key, last_at timestamptz);
revoke all on reels_tick from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.unschedule(jobid) from cron.job where jobname = 'reels-tick';
    -- 주소와 공개 키(anon)는 deploy.config.json과 같은 공개 값. 서버 함수는 20분에 한 번만 깨운다.
    perform cron.schedule('reels-tick', '7,37 1-14 * * *', $job$
      select net.http_post(
        url := 'https://mklluxpngagiechnfaxe.supabase.co/functions/v1/api/reels-tick',
        headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbGx1eHBuZ2FnaWVjaG5mYXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTA3MTMsImV4cCI6MjEwNjY4NjcxM30.8x_iJAt2TW_SrXPU2A5iP7cSVSOt3HIRLkHdhwJAtXM'),
        body := '{}'::jsonb)
    $job$);
  end if;
end $$;
