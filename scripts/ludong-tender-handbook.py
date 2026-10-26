"""Build the editable customer handbook from explicit, synthetic POC scenarios."""
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/deliverables/鲁东大学采购管理系统POC演示操作手册.docx'
OUT.parent.mkdir(parents=True, exist_ok=True)
doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Inches(8.27), Inches(11.69)
section.top_margin = section.bottom_margin = Inches(.7)
section.left_margin = section.right_margin = Inches(.78)
for name in ['Normal', 'Title', 'Heading 1', 'Heading 2']:
    style = doc.styles[name]
    style.font.name = 'Arial'
    style.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
    style.font.color.rgb = RGBColor(0, 0, 0)
doc.styles['Normal'].font.size = Pt(10.5)
doc.styles['Normal'].paragraph_format.space_after = Pt(7)
doc.styles['Normal'].paragraph_format.line_spacing = 1.18
doc.styles['Heading 1'].font.size = Pt(17)
doc.styles['Heading 2'].font.size = Pt(12)
footer = section.footer.paragraphs[0]
footer.alignment = 2
footer.add_run('鲁东大学采购管理系统 POC  |  ')
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)

def p(text): doc.add_paragraph(text)
def h(text): doc.add_heading(text, 2)
def table(headers, rows):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = 'Light Shading Accent 1'
    t.autofit = False
    for column, width in zip(t.columns, [2.1, 4.6]): column.width = Inches(width)
    for c, text in zip(t.rows[0].cells, headers): c.text = text
    for values in rows:
        for c, text in zip(t.add_row().cells, values): c.text = text
    for row in t.rows:
        props = row._tr.get_or_add_trPr(); props.append(OxmlElement('w:cantSplit'))
        for cell, width in zip(row.cells, [2.1, 4.6]):
            cell.width = Inches(width)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(4)
                paragraph.paragraph_format.line_spacing = 1.05
                for run in paragraph.runs: run.font.size = Pt(10)
    t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
def page(title):
    heading = doc.add_heading(title, 1)
    if len(doc.paragraphs) > 1: heading.paragraph_format.page_break_before = True

page('鲁东大学采购管理系统 POC 操作手册')
p('独立演示环境 · 2026年10月26日')
p('本手册用于现场演示与客户试用。所有演示人员、供应商、价格及证明文件均为合成样本，不代表学校真实业务、采购方式认定或正式制度。')
h('一、先登录正确环境')
table(['入口', '地址与用途'], [
    ['学校采购端', 'http://127.0.0.1:5288/?solution=ludong-poc\n项目申报、审批、流程配置、询价比价、合同审查、归档'],
    ['供应商端', 'http://127.0.0.1:5289/\n受邀报价、修改报价、查看报价历史'],
])
p('上述地址仅适用于当前演示电脑。异地客户不能直接访问127.0.0.1；网络部署需另行提供实际地址。本环境与原系统5173/8080相互隔离。')
h('二、登录与角色切换')
p('学校端填写工号、密码，点击“工号登录”。切换人员时先点击右上角“退出登录”，再使用另一工号登录；手机端通过左上角导航按钮展开菜单。')
p('所有下列合成账号密码均为 demo123456，仅限隔离演示环境使用。学校统一身份认证尚不属于本地演示已接通能力。')
h('三、快速找到演示样本')
table(['搜索词', '推荐操作'], [
    ['POC现场填报', '草稿：打开编辑，展示设备清单、预算累计和商城确认单'],
    ['POC现场审批', '在办：使用论证人工号进入审批中心实际办理'],
    ['POC完整验收', '已归档：查看20个审批节点、签署及完整材料；下载Word和ZIP'],
])
p('请按项目名称搜索，不依赖列表第一条位置。试用可新增项目，不要删除历史记录或覆盖已有流程版本。')

page('审批岗位与演示账号')
p('一个工号可对应多个岗位；是否有待办，以当前真实任务和数据权限为准。管理员不等于所有节点办理人。')
table(['工号', '岗位 / 操作'], [
    ['LDU000001', 'POC管理员：菜单、组织、配置和全局查看'],
    ['LDU100001', '申报人；同时负责“申请材料提交确认”'],
    ['LDU200001', '购置必要性论证人'],
    ['LDU200017', '技术负责人、参与编制人员、网上商城选型参与人'],
    ['LDU200002', '教育信息技术部审核'],
    ['LDU200003', '申报单位负责人'],
    ['LDU200004', '经费主管单位负责人'],
    ['LDU200005 / 006 / 007', '资产处审核 / 分管领导 / 单位负责人（完整前缀LDU200）'],
    ['LDU200008 / 009 / 010', '实验室审核 / 分管领导 / 单位负责人（完整前缀LDU200）'],
    ['LDU200011', '分管校领导'],
    ['LDU200012', '财务预算办公室'],
    ['LDU200013', '采购预算办公室'],
    ['LDU200014', '申请材料受理确认'],
    ['LDU200015', '财经处采购方式审核'],
    ['LDU200016', '财经处负责人终审'],
])
h('供应商账号')
p('甲方：ldu.supplier.a@example.com；企业编号 ent-ldu-demo-a\n乙方：ldu.supplier.b@example.com；企业编号 ent-ldu-demo-b\n丙方：ldu.supplier.c@example.com；企业编号 ent-ldu-demo-c')
p('供应商登录时须同时填写账号、密码和对应企业编号，点击“账号登录”。')
p('三个账号分别进入自己的企业工作区，不能查看其他供应商未公开的报价和附件。')

page('场景一：项目填报、分级审批与归档')
h('1. 申请人准备材料')
p('以LDU100001登录 → 项目申报 → 搜索“POC现场填报” → 编辑。先核对申报单位、经费来源、负责人和购置理由，再打开拟采购设备清单。')
p('从采购目录选择设备，也可手工新增。目录价格、参数与型号为参考，可按实际调研修改；使用方向、进口情况、使用人与地点由填报人确认。预算按明细自动累计，无需另填。')
p('设备属于网上商城目录时，在商城确认区域补充品牌、型号、供应商、价格及选型参与人。自动判断依据可查看，人工调整需确认；这不是已经接入政府商城的证明。')
p('按页面提示补齐必填项与必备附件，保存后提交。勘察、样品、演示选择“否”时，不再填写其后续内容。')
h('2. 审批人实际办理')
p('退出后以LDU200001登录 → 审批中心 → 待审批 → 找到“POC现场审批” → 详情查看全部申报材料、设备、商城确认与附件 → 办理。填写论证结论和意见，再确认提交。不同意不能按通过办理。')
p('下一节点为技术负责人时使用LDU200017。该工号首次通过后，同实例后续重复岗位自动复用结论，节点表单、历史和签署仍会留存。退回后的失效意见不用于新一轮复用。')
p('需要展示转审、加审、抄送、催办或指定节点退回时，在当前真实办理任务的协同区操作。被转交人必须有相应权限；抄送不新增数据访问权限。')
h('3. 展示可配置流程')
p('管理员进入“流程配置”，展示节点、办理岗位、金额条件、时限及附件要求。保存草稿不改变运行中实例；发布后新实例使用新版本，旧实例继续使用原版本。演示前不要随意发布新的正式路径。')
h('4. 查看已完成全过程并下载')
p('搜索“POC完整验收” → 详情：查看20/20节点、同工号自动复用标记、完整操作记录及统一附件台账。点击“需求表”“申请单”分别下载；点击“打包归档”下载两份Word、原始材料及带SHA-256的材料清单。')

page('场景二：完整报价、延期与技术比价')
h('1. 采购方准备询价')
p('管理员 → 询价比价 → 选择已邀请三家演示供应商的项目。使用已有报价中案例演示，避免现场临时填写复杂采购要求。未开标阶段采购方只能看到家数，不应展示封闭报价明细。')
h('2. 供应商完整填报')
p('供应商端以甲方演示供应商账号登录 → 询价邀请 → 选择对应项目 → 报价。逐项填写含税单价、品牌、型号、实际参数、技术响应或偏离；补充税率、发票类型、交期与备注，上传原件后提交。')
p('截止前修改报价会生成新版本。演示V1与V2的单价或型号差异，并打开历史确认提交人、时间和原件关联；不能用过期版本覆盖最新报价。其余两家使用各自账号操作。')
h('3. 展示不足三家的延期规则')
p('采购方查看延期设置及台账。有效报价按受邀供应商去重，完整模式须资料齐全且金额为正；不足三家按配置的自然小时和次数上限延期。人工延期填写新截止时间与原因。')
p('自动延期需到达真实截止时间后才能触发，不应为现场演示修改系统时钟。次数达到上限、已开标或报价满三家等情况按实际规则限制。')
h('4. 技术比较与导出')
p('满足开标条件后由采购方按实际权限操作。进入报价对比，横向查看采购参数、供应商品牌型号、价格、技术响应与偏离；宽矩阵在区域内横向滚动。')
p('导出Excel，核对报价汇总、逐项技术比价、附件台账、版本记录四张工作表。价格排序仅供参考，不能代替人工技术评审和定标。')
h('注意')
p('以上供应商、报价和资质均为合成演示资料。单独报价脚本的测试项目带有验收标识；演示时以当前页面状态为准，不要修改已开标项目要求。')

page('场景三：合同智能审查与人工确认')
h('1. 规则与版本')
p('管理员 → 采购合同 → 合同智能审查。查看关键词命中、缺失条款和模型语义规则，展示风险等级、适用视角、依据来源、条款、依据正文与修改建议。保存草稿后发布，形成不可覆盖版本。')
p('当前例示依据明确标注为内部演示规则，不等于学校正式制度。正式规则必须由学校业务或法务确认，不能把第三方搜索内容直接当作学校采购管理办法。')
h('2. 上传与审查')
p('上传2MB内TXT或DOCX，选规则版本和甲方/乙方视角。普通规则检查不调用模型；主动选择AI审查后，才会将本次所需合同文本发送至已配置的大模型服务。现场仅使用合成合同，不上传未经授权的真实敏感文件。')
p('系统显示规则版本、正文版本、分析模式及风险线索。点击原文位置，核对对应段落或表格单元格；将结论与依据、原文逐一对照，不宣传100%准确。')
h('3. 人工处理与追溯')
p('查看完整原段落及建议，按业务需要修改建议内容，填写人工说明后采纳；不采纳也要留痕。采纳会生成新正文版本，不覆盖上传原件或正式合同。旧版本的冲突意见不能继续覆盖新正文。')
p('展开人工处理历史，查看工号、时间、采纳情况及前后正文。分别下载原件和DOCX校对稿，说明校对稿不保留原文件完整版式，不是签署正本。')
h('异常情况')
p('模型不可用或结果不符合约束时，页面提示语义未评估，仍展示实际完成的规则检查，不伪造AI结论。PDF、扫描件及OCR不在本轮合同解析范围。AI不会自动批准、驳回或签署。')

page('现场演示顺序与检查清单')
h('建议18分钟操作 + 2分钟缓冲')
table(['时间', '现场操作重点'], [
    ['0—2分钟', '工号登录、角色权限、导航与合成样本说明'],
    ['2—7分钟', '项目明细、自动预算、流程配置、实际办理、工号复用与历史'],
    ['7—12分钟', '供应商完整报价、V1/V2、延期台账、采购方技术比较及Excel'],
    ['12—17分钟', '合同规则版本、甲乙方视角、原文定位、人工确认与历史'],
    ['17—18分钟', '已完成项目两份Word、ZIP原件归档'],
    ['18—20分钟', '网络、模型延迟及切换账号的缓冲'],
])
p('上述为建议控时安排，不是已经完成20分钟综合彩排的证明。演示前应由实际讲解人按此顺序计时走一遍。')
h('开场前逐项核对')
p('① 采购端、供应商端均可登录；② 已备好草稿、在办和已归档样本；③ 三家供应商报价状态清楚；④ 合同原件与已完成审查可查；⑤ 能下载Word、Excel和ZIP；⑥ 网络可访问模型服务。')
h('演示过程中的常见问题')
p('没有待办：先核对工号及当前节点，不用管理员账号代替所有审批人。\n无法提交：查看必填项、设备清单与必备附件提示。\n看不到报价：先核对是否已开标，勿绕过封闭规则。\n模型失败：如实说明语义未评估，可查看已有真实审查历史，不假称本次调用成功。\n手机找不到菜单：点击左上角导航，明细较多时上下滚动。')
h('数据与环境边界')
p('本地独立POC保留历史数据与原件，不清库。备份及冻结构建保存在本机受限目录，密钥不在本手册、源码或前端中。离线可展示已保存结果和规则检查；新AI分析仍依赖模型网络。跨机运行需另行配置数据库、对象存储及模型密钥。')
doc.core_properties.title = '鲁东大学采购管理系统POC演示操作手册'
doc.core_properties.subject = '独立演示环境的账号、操作步骤与三项演示场景'
doc.save(OUT)
print(OUT)
