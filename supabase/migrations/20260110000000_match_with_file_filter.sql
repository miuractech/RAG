-- Enhanced match function that supports filtering by specific file IDs
create or replace function match_document_sections(
  embedding vector(384),
  match_threshold float,
  file_ids bigint[] default null
)
returns setof document_sections
language plpgsql
as $$
#variable_conflict use_variable
begin
  return query
  select *
  from document_sections
  where 
    document_sections.embedding <#> embedding < -match_threshold
    and (
      file_ids is null 
      or document_sections.document_id = any(file_ids)
    )
  order by document_sections.embedding <#> embedding;
end;
$$;

