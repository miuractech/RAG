-- Update the embed function to support batch processing with recursion
-- This replaces the previous version to handle large files that exceed CPU time limits

create or replace function private.embed()
returns trigger
language plpgsql
as $$
declare
  content_column text = TG_ARGV[0];
  embedding_column text = TG_ARGV[1];
  batch_size int = case when array_length(TG_ARGV, 1) >= 3 then TG_ARGV[2]::int else 10 end;
  timeout_milliseconds int = case when array_length(TG_ARGV, 1) >= 4 then TG_ARGV[3]::int else 8 * 60 * 1000 end;
  batch_count int = ceiling((select count(*) from inserted) / batch_size::float);
  auth_header text;
begin
  -- Get authorization header
  begin
    auth_header := current_setting('request.headers')::json->>'authorization';
  exception
    when others then
      auth_header := '';
  end;

  -- Loop through each batch and invoke an edge function to handle the embedding generation
  -- Each invocation will process items in smaller sub-batches and recurse if needed
  for i in 0 .. (batch_count-1) loop
    perform
      net.http_post(
        url := supabase_url() || '/functions/v1/embed',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', auth_header
        ),
        body := jsonb_build_object(
          'ids', (select json_agg(ds.id) from (select id from inserted limit batch_size offset i*batch_size) ds),
          'table', TG_TABLE_NAME,
          'contentColumn', content_column,
          'embeddingColumn', embedding_column,
          'authToken', auth_header
        ),
        timeout_milliseconds := timeout_milliseconds
      );
  end loop;

  return null;
end;
$$;

