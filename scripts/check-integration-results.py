"""Fail release checks when an integration suite is absent or silently skipped."""
import pathlib
import sys
import xml.etree.ElementTree as ET

reports = pathlib.Path(sys.argv[1])
required = (
    'DatabaseMigrationIT', 'UnifiedWorkflowRuntimeIT',
    'LudongPocEmployeeReuseIT', 'QualityHardeningIT',
    'BuyerAdminIntegrityPostgresIT', 'ProcurementAnalyticsPostgresIT',
    'AiBackendPostgresIT', 'NumberingCreationPostgresIT', 'NumberingMigrationPostgresIT',
)
for suite in required:
    report = reports / f'TEST-com.procurement.{suite}.xml'
    if not report.exists():
        raise SystemExit(f'Missing integration report: {suite}')
    root = ET.parse(report).getroot()
    if int(root.get('tests', '0')) == 0 or any(
        int(root.get(key, '0')) for key in ('failures', 'errors', 'skipped')
    ):
        raise SystemExit(f'Integration suite failed or skipped: {suite}')
    print(f'{suite}: {root.get("tests")} executed, no skips or failures')
