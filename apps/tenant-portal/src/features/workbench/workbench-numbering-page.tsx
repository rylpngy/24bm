import {useQuery} from '@tanstack/react-query';
import {agencyOptions} from '@24bid/api-client';
import {Hash} from 'lucide-react';
import {Panel,FeedbackNotice} from '@24bid/ui';
import {AgencyNumberingPanel} from '../agency/agency-numbering-panel';
export function WorkbenchNumberingPage(){const q=useQuery({queryKey:['agency-options'],queryFn:agencyOptions});return <Panel title="编码规则" icon={Hash} subtitle="项目分类、年度流水与编号格式">{q.isError?<FeedbackNotice tone="error" message="编码规则加载失败。"/>:q.data?<AgencyNumberingPanel value={q.data.numbering}/>:<p>正在加载编码规则…</p>}</Panel>;}
