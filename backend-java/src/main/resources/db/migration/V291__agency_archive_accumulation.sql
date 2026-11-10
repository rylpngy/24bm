-- Lifecycle flags do not increment package content version or alter frozen evaluation inputs.
create function agency_archive_accumulate() returns trigger language plpgsql as $$
begin
 update agency_packages set archive_completion='accumulating' where tenant_id=new.tenant_id and id=new.package_id and archive_completion='complete';
 return new;
end $$;
create trigger agency_archive_post_results after insert on agency_post_results for each row execute function agency_archive_accumulate();
create trigger agency_archive_post_docs after insert or update on agency_post_documents for each row execute function agency_archive_accumulate();
create trigger agency_archive_post_issues after insert or update on agency_post_issues for each row execute function agency_archive_accumulate();
create trigger agency_archive_finance_accounts after insert or update on agency_finance_accounts for each row execute function agency_archive_accumulate();
create trigger agency_archive_finance_entries after insert or update on agency_finance_entries for each row execute function agency_archive_accumulate();
create trigger agency_archive_file_created after insert on agency_files for each row execute function agency_archive_accumulate();
create function agency_archive_version_accumulate() returns trigger language plpgsql as $$
begin
 update agency_packages p set archive_completion='accumulating' from agency_files f where f.tenant_id=new.tenant_id and f.id=new.file_id and p.tenant_id=f.tenant_id and p.id=f.package_id and p.archive_completion='complete';return new;
end $$;
create trigger agency_archive_version_changed after insert or update on agency_file_versions for each row execute function agency_archive_version_accumulate();
