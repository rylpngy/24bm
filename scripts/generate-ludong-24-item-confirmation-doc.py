from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = Path(
    "/Users/epl/Documents/Codex/代码/24Bid/artifacts/customer-deliverables/"
    "鲁东大学采购申报POC两轮24项优化内容确认说明.docx"
)

NAVY = "17365D"
BLUE = "2563EB"
BLUE_LIGHT = "EAF2FF"
BLUE_PALE = "F5F8FD"
GRAY = "64748B"
GRAY_LIGHT = "F3F6FA"
GRAY_BORDER = "D8E2EF"
TEXT = "1F2937"
AMBER = "B45309"
AMBER_LIGHT = "FFF7E6"


ITEMS = [
    {
        "round": "第一轮",
        "no": "1",
        "title": "预算金额由采购设备清单自动累计",
        "request": "预算金额应按照采购设备清单自动累计填写，无需用户手工填写。",
        "change": "预算金额调整为只读自动计算字段，按设备清单中各项“数量 × 市场调研单价”汇总；清单发生增删改时同步更新，后端保存时再次计算校验，避免前端金额被手工篡改。",
        "confirm": "请确认预算计算口径是否统一采用“市场调研单价 × 数量”，是否还需要计入运输、安装、税费等附加费用。",
    },
    {
        "round": "第一轮",
        "no": "2",
        "title": "项目标准及供应商资质不再预填",
        "request": "国家强制标准要求、供应商特殊资质要求、其他标准不预填，由用户结合项目特点自行填报。",
        "change": "上述三个字段默认保持空白，不再注入示例或推荐文字，申报人可按具体项目填写。",
        "confirm": "请确认三个字段均允许按项目实际填写；是否需要按采购品类设置必填规则。",
    },
    {
        "round": "第一轮",
        "no": "3",
        "title": "交付、服务与验收条件取消预设选择",
        "request": "“具备安装条件”“水电暖气等条件满足”等内容不要预设选择，以免误导用户。",
        "change": "相关条件默认不选择，申报人需根据现场条件自行确认；系统不再默认判定为“是”。",
        "confirm": "请确认这些条件采用人工“是/否”选择即可，是否还需要增加补充说明或现场证明附件。",
    },
    {
        "round": "第一轮",
        "no": "4",
        "title": "除付款方式外取消业务字段预填",
        "request": "除付款方式外，其他所有填报项均无需预设填写内容。",
        "change": "已清理业务意见、验收要求等字段的默认内容；组织架构、采购目录等系统基础数据仍可通过选择或规则带入，但不会替用户预填业务结论。付款方式保留模板参考表述。",
        "confirm": "请确认“基础数据自动带入、业务意见不预填”的边界是否符合预期。",
    },
    {
        "round": "第一轮",
        "no": "5",
        "title": "核心产品由采购清单自动带入采购需求表",
        "request": "核心产品在采购清单中标注后，自动填写到采购需求表。",
        "change": "采购清单支持标注核心产品，系统自动生成核心产品摘要并写入采购需求表及导出文档；当前按一个项目仅设置一个核心产品处理。",
        "confirm": "请确认一个项目是否只允许一个核心产品；如允许多个，需明确文档展示及审核规则。",
    },
    {
        "round": "第一轮",
        "no": "6",
        "title": "付款方式按正式模板表述并保留提示语",
        "request": "付款方式按照学校提供模板中的表述，并保留相应提示语。",
        "change": "付款方式保留国内设备、进口设备等模板口径，并显示“仅供参考，可按实际需求修改”的提示，申报人可结合合同及项目情况调整。",
        "confirm": "请确认当前付款方式的文字与学校正式模板一致，以及提示语是否需要改为固定不可删除内容。",
    },
    {
        "round": "第一轮",
        "no": "7",
        "title": "勘察、样品、演示采用条件显示",
        "request": "勘察、样品、演示选择“否”时，后续响应项隐藏。",
        "change": "三类事项选择“否”后隐藏并清理其后续说明；选择“是”后才展示相关时间、地点、方式或要求，并按规则提示填写。",
        "confirm": "请确认隐藏后不参与表单校验和文档输出；是否需要在导出文档中仍保留“否”的勾选结果。",
    },
    {
        "round": "第一轮",
        "no": "8",
        "title": "采购设备清单按模板补齐字段",
        "request": "设备清单按照学校模板完善，补齐遗漏项。",
        "change": "清单已覆盖设备名称、数量及单位、市场调研单价、小计、技术参数、参考品牌型号、是否进口、进口周期、用途、使用方向、使用人、存放地点、核心产品、网上商城目录等信息；商城选型阶段补充最终品牌、型号、供应商和价格。",
        "confirm": "请确认字段名称、排列顺序及必填范围是否与学校最终模板一致。",
    },
    {
        "round": "第一轮",
        "no": "9",
        "title": "台式计算机等商城目录识别与人工修正",
        "request": "填写台式计算机后应自动判定网上商城，并允许手工填写网上商城型号确认单。",
        "change": "系统结合学校采购目录中的商城标识、设备名称及品类关键词进行辅助识别；识别为商城目录的物料自动进入型号确认单，同时支持人工调整并可恢复系统建议。",
        "confirm": "请确认自动识别的目录范围、关键词维护责任，以及人工调整是否需要审批留痕。",
    },
    {
        "round": "第一轮",
        "no": "10",
        "title": "大型仪器或实验室流程按使用方向判断",
        "request": "涉及大型仪器或实验室的判断规则，按照采购清单中使用方向为教学、科研来判定。",
        "change": "当任一采购清单项的使用方向为“教学”或“科研”时，系统进入实验室管理相关审批路径；不再仅按申报单位类型判断。",
        "confirm": "请确认是否还需叠加金额、设备类别或大型仪器认定标准等条件。",
    },
    {
        "round": "第一轮",
        "no": "11",
        "title": "取消同单位判断，按工号复用重复审批",
        "request": "取消“经费主管单位与申报单位相同”的复杂判断；同一工号在一个流程中多次审批，只审批第一次，后续自动跳过。",
        "change": "流程不再依赖“经费主管单位与申报单位相同”字段。重复审批按整个流程实例内的工号查重，支持非连续重复节点；自动跳过时同步生成节点表单、审批历史、签署摘要和审计记录。",
        "confirm": "请确认按工号复用适用于本流程全部审批节点；如存在必须再次确认的关键节点，请明确例外清单。",
    },
    {
        "round": "第一轮",
        "no": "12",
        "title": "信创及办公设备辅助判断支持人工调整",
        "request": "信创产品、办公设备或家具由系统自动判断，并考虑用户填写不规范名称时的处理。",
        "change": "系统结合采购目录标识、品类和名称关键词给出判断及依据，页面展示判定过程并允许人工修正。不规范名称无法完全覆盖时，以目录选择和人工确认兜底。",
        "confirm": "请确认学校认可的关键词、品类范围和人工修正权限；该功能定位为规则辅助判断，不替代人工审核。",
    },
    {
        "round": "第一轮",
        "no": "13",
        "title": "购置理由由申请人填写，论证人签署意见",
        "request": "购置理由及必要性由申请人填报；审核时由论证人签署论证意见。",
        "change": "购置理由及必要性已前移到申报表单；论证节点仅填写论证结论、论证意见并完成签名，不再替申请人补写申报理由。",
        "confirm": "请确认申请人陈述与论证人意见在页面及下载表格中的展示位置和责任边界。",
    },
    {
        "round": "第一轮",
        "no": "14",
        "title": "移除附件三配置标准及对应型号数量信息",
        "request": "去掉配置标准附件三、附件三配置及型号数量信息。",
        "change": "已从申报、论证、流程校验、AI依据说明和归档分类中移除相关字段及必填要求，不再作为流程推进条件。",
        "confirm": "请确认彻底移除；如仍需作为可选参考材料，请明确上传位置和适用范围。",
    },
    {
        "round": "第一轮",
        "no": "15",
        "title": "审批人员查看完整申报信息，AI仅作辅助",
        "request": "审核人员应看到填报人看到的全部内容；AI辅助不能完全代替人工。",
        "change": "审批详情统一展示项目、经费、采购需求、交付服务与验收、勘察样品演示、设备清单和商城选型等信息。AI建议关联表单字段、学校制度规则和前序审批依据，不自动通过、驳回或签字，最终决定由审批人完成。",
        "confirm": "请确认审批人的信息查看范围，以及是否需要按岗位隐藏价格、供应商或个人信息。",
    },
    {
        "round": "第一轮",
        "no": "16",
        "title": "论证结论不同意时只能驳回",
        "request": "论证结论为“不同意”时，只能执行驳回。",
        "change": "前端在结论为“不同意”时禁用通过操作；后端同时校验并拒绝不一致的通过请求，避免绕过页面限制。",
        "confirm": "重点确认：驳回后应退回申请人修改、退回上一节点，还是直接终止本次流程。当前按系统现有驳回路径处理。",
        "focus": True,
    },
    {
        "round": "第二轮",
        "no": "19",
        "title": "下载申请单自动换行并优化版式",
        "request": "审批完成后下载的申请单存在排版问题，部分内容需要自动换行。",
        "change": "生成 Word 时统一启用单元格自动换行、内容自适应行高和跨页控制，保留用户输入中的显式换行，减少长文本溢出、遮挡和表格断裂。",
        "confirm": "请使用实际长文本项目核对分页、行高和签字区位置，确认是否满足学校打印归档要求。",
    },
    {
        "round": "第二轮",
        "no": "20",
        "title": "技术负责人栏审批后仅显示签名",
        "request": "技术负责人栏审核后只显示签名。",
        "change": "节点未完成时显示申报阶段填写的技术负责人；节点完成后，导出表格仅显示实际审批人的签名信息，不再附加“线上确认”等重复说明。",
        "confirm": "请确认签名显示格式采用“姓名 + 日期”，以及是否需要增加工号或电子签章图样。",
    },
    {
        "round": "第二轮",
        "no": "21",
        "title": "购置理由栏仅保留论证人审核意见",
        "request": "购置理由栏的论证意见只保留论证人意见，技术负责人、参与编制人员、商城选型确认意见不在此处显示。",
        "change": "该区域仅呈现申请人填写的购置理由及必要性、论证人的结论/意见/签名；技术负责人、参与编制人员和商城选型意见改在各自签署栏或流程记录中展示。",
        "confirm": "请确认“申请人购置理由 + 论证人意见”同区展示符合模板；其他人员只保留签名、不展示意见。",
    },
    {
        "round": "第二轮",
        "no": "22",
        "title": "采购预算选项统一使用“采购预算”表述",
        "request": "采购预算三个选项中，将“学校预算”修改为“采购预算”。",
        "change": "采购预算办公室对应的三项选择统一改为“采购预算”口径；财务预算节点仍保留学校预算相关表述，并对历史数据进行兼容转换。",
        "confirm": "请确认采购预算三项的完整句式与正式模板一致，财务预算与采购预算两组术语需要保持区分。",
    },
    {
        "round": "第二轮",
        "no": "23",
        "title": "使用方向不再按学院自动赋值",
        "request": "学院项目不应自动认定为教学，学院也可能用于行政办公或科研。",
        "change": "取消按申报单位类型自动赋值，使用方向改为申报人逐项选择“教学、科研、行政办公、其他”；历史“行政”值统一兼容为“行政办公”。",
        "confirm": "请确认使用方向为单选还是多选，是否需要增加“社会服务”等其他学校口径。",
    },
    {
        "round": "第二轮",
        "no": "24",
        "title": "进口属性、使用人和存放地点改为明确填报",
        "request": "明确采购清单中是否进口的判断方式，并解决使用人、存放地点为空的问题。",
        "change": "是否进口由申报人根据市场调研结果人工选择，不按设备名称自动推断；使用人和存放地点纳入清单必填校验。历史草稿中的空值需由申报人补齐，系统不虚构内容。",
        "confirm": "请确认进口设备是否还需上传论证材料；使用人和存放地点是否支持批量填充。",
    },
    {
        "round": "第二轮",
        "no": "25",
        "title": "商城选型参与人审核后仅显示签名",
        "request": "网上商城型号确认单中，选型参与人审核后在选型参与人栏只显示签名。",
        "change": "审批前保留申报人登记的选型参与人名单；节点审批完成后，导出签署栏仅显示实际办理人的签名信息，不再重复输出原名单或线上确认说明。",
        "confirm": "重点确认：商城选型如要求至少三名参与人，是否需要三人分别登录签署，还是由一个节点办理人代表确认后输出单一签名。",
        "focus": True,
    },
    {
        "round": "第二轮",
        "no": "26",
        "title": "采购需求表技术负责人及参与编制人仅显示签名",
        "request": "采购需求表中技术负责人和参与编制人审核后只显示签名。",
        "change": "对应节点完成后，采购需求表的签署栏仅输出实际审批签名，不再同时显示原始姓名或“在线确认”等说明；未办理前仍显示申报阶段登记信息，便于核对。",
        "confirm": "重点确认：参与编制人为多人时，是否要求每人分别登录签署并全部展示，还是由指定代表完成一次确认。",
        "focus": True,
    },
]


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width: int) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width))
    tc_w.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths: list[int], indent: int = 120) -> None:
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(indent))
    tbl_ind.set(qn("w:type"), "dxa")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        grid_col = OxmlElement("w:gridCol")
        grid_col.set(qn("w:w"), str(width))
        grid.append(grid_col)
    for row in table.rows:
        for index, cell in enumerate(row.cells):
            set_cell_width(cell, widths[min(index, len(widths) - 1)])


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def mark_header_row(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    tr_pr.append(header)


def set_run_font(run, size=10.5, bold=False, color=TEXT, latin="Calibri", east_asia="Microsoft YaHei") -> None:
    run.font.name = latin
    run._element.rPr.rFonts.set(qn("w:eastAsia"), east_asia)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def add_text(paragraph, text: str, *, size=10.5, bold=False, color=TEXT) -> None:
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color)


def style_cell_paragraph(paragraph, space_after=0, line_spacing=1.25) -> None:
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(space_after)
    paragraph.paragraph_format.line_spacing = line_spacing


def add_field(paragraph, field_name: str) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = field_name
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])
    set_run_font(run, size=9, color=GRAY)


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.88)
    section.right_margin = Inches(0.88)
    section.header_distance = Inches(0.28)
    section.footer_distance = Inches(0.28)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.25

    for style_name, size, color in (("Title", 25, NAVY), ("Heading 1", 16, NAVY), ("Heading 2", 12.5, BLUE)):
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(10 if style_name != "Title" else 0)
        style.paragraph_format.space_after = Pt(6)

    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_text(p, "鲁东大学采购申报 POC｜优化内容确认说明", size=8.5, color=GRAY)
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), GRAY_BORDER)
    border.append(bottom)
    p._p.get_or_add_pPr().append(border)

    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_text(p, "客户确认稿  ·  第 ", size=8.5, color=GRAY)
    add_field(p, "PAGE")
    add_text(p, " 页 / 共 ", size=8.5, color=GRAY)
    add_field(p, "NUMPAGES")
    add_text(p, " 页", size=8.5, color=GRAY)


def add_cover(doc: Document) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(6)
    add_text(p, "24Bid · 鲁东大学采购申报 POC", size=11, bold=True, color=BLUE)

    p = doc.add_paragraph(style="Title")
    p.paragraph_format.space_after = Pt(7)
    add_text(p, "两轮 24 项优化内容确认说明", size=25, bold=True, color=NAVY)

    p = doc.add_paragraph()
    add_text(p, "用于客户核对修改结果及确认后续业务口径", size=12, color=GRAY)
    p.paragraph_format.space_after = Pt(18)

    table = doc.add_table(rows=2, cols=3)
    table.style = "Table Grid"
    set_table_geometry(table, [3120, 3120, 3120])
    mark_header_row(table.rows[0])
    labels = [("24", "优化事项"), ("2", "反馈轮次"), ("V1.0", "确认稿版本")]
    for index, (value, label) in enumerate(labels):
        cell = table.cell(0, index)
        set_cell_shading(cell, BLUE_LIGHT)
        set_cell_margins(cell, 180, 120, 80, 120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_text(p, value, size=18, bold=True, color=BLUE)
        cell = table.cell(1, index)
        set_cell_margins(cell, 70, 120, 140, 120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_text(p, label, size=9.5, color=GRAY)

    doc.add_paragraph()
    p = doc.add_paragraph()
    add_text(p, "文件信息", size=11, bold=True, color=NAVY)
    p.paragraph_format.space_after = Pt(6)
    info = doc.add_table(rows=4, cols=2)
    info.style = "Table Grid"
    set_table_geometry(info, [1900, 7460])
    mark_header_row(info.rows[0])
    rows = [
        ("文件性质", "业务优化确认稿（不替代最终上线验收报告）"),
        ("适用范围", "鲁东大学货物类项目采购申报、线上审批、Word 下载与材料归档"),
        ("编号说明", "第一轮沿用 1–16；第二轮沿用 19–26。两轮合计 24 项，便于与客户原反馈逐项对照。"),
        ("编制日期", "2026 年 9 月 4 日"),
    ]
    for idx, (label, value) in enumerate(rows):
        left, right = info.rows[idx].cells
        set_cell_shading(left, GRAY_LIGHT)
        for cell in (left, right):
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = left.paragraphs[0]
        add_text(p, label, size=9.5, bold=True, color=NAVY)
        p = right.paragraphs[0]
        add_text(p, value, size=9.5)

    doc.add_paragraph()
    p = doc.add_paragraph()
    add_text(p, "确认方式", size=11, bold=True, color=NAVY)
    p.paragraph_format.space_after = Pt(5)
    for text in (
        "请客户逐项核对“当前版本修改说明”和“需确认内容”。",
        "每项可勾选“符合预期”或“需调整”，需调整时请在备注区说明目标口径。",
        "标有“重点确认”的事项涉及后续流程或签署规则，请优先确认。",
    ):
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.2)
        p.paragraph_format.space_after = Pt(2)
        add_text(p, text, size=10)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(0)
    add_text(p, "当前版本已按以下口径完成对应功能调整；本文件的主要目的，是请校方确认这些处理方式是否准确反映实际业务。", size=10.5, bold=True, color=BLUE)

    doc.add_page_break()


def add_round_intro(doc: Document, round_name: str, source_range: str, count: int) -> None:
    heading = doc.add_paragraph(style="Heading 1")
    add_text(heading, f"{round_name}优化事项", size=16, bold=True, color=NAVY)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    add_text(p, f"原反馈编号 {source_range}，共 {count} 项。以下内容逐项说明客户意见、当前版本处理方式及待确认口径。", size=10, color=GRAY)


def add_item(doc: Document, item: dict) -> None:
    table = doc.add_table(rows=5, cols=2)
    table.style = "Table Grid"
    set_table_geometry(table, [1680, 7680])
    table.allow_autofit = False
    mark_header_row(table.rows[0])

    header = table.rows[0].cells[0].merge(table.rows[0].cells[1])
    set_cell_shading(header, AMBER_LIGHT if item.get("focus") else BLUE_LIGHT)
    set_cell_margins(header, 110, 150, 110, 150)
    p = header.paragraphs[0]
    p.paragraph_format.keep_with_next = True
    add_text(p, f"第 {item['no']} 项｜{item['title']}", size=11.5, bold=True, color=AMBER if item.get("focus") else NAVY)
    if item.get("focus"):
        add_text(p, "  重点确认", size=9, bold=True, color=AMBER)

    rows = [
        ("客户原始意见", item["request"]),
        ("当前修改说明", item["change"]),
        ("需确认内容", item["confirm"]),
        ("客户确认", "□ 符合预期    □ 需调整    备注：____________________________________________"),
    ]
    for row_index, (label, value) in enumerate(rows, start=1):
        row = table.rows[row_index]
        prevent_row_split(row)
        left, right = row.cells
        set_cell_shading(left, GRAY_LIGHT)
        if row_index == 3 and item.get("focus"):
            set_cell_shading(right, AMBER_LIGHT)
        for cell in (left, right):
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, 90, 120, 90, 120)
        p = left.paragraphs[0]
        style_cell_paragraph(p)
        add_text(p, label, size=9.2, bold=True, color=NAVY)
        p = right.paragraphs[0]
        style_cell_paragraph(p, line_spacing=1.2)
        add_text(p, value, size=9.3, color=TEXT)

    # Keep each confirmation item as one visual block. Every item fits on one
    # page, so chaining all paragraphs except the final row avoids split tables.
    for row_index, row in enumerate(table.rows):
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.keep_with_next = row_index < len(table.rows) - 1

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = False


def add_summary(doc: Document) -> None:
    doc.add_page_break()
    heading = doc.add_paragraph(style="Heading 1")
    add_text(heading, "总体确认与反馈", size=16, bold=True, color=NAVY)

    p = doc.add_paragraph()
    add_text(p, "请在逐项确认的基础上选择总体意见。", size=10, color=GRAY)

    table = doc.add_table(rows=6, cols=2)
    table.style = "Table Grid"
    set_table_geometry(table, [2100, 7260])
    mark_header_row(table.rows[0])
    rows = [
        ("总体结论", "□ 符合预期，可按此口径继续\n□ 基本符合，按备注完成调整\n□ 仍需重新确认业务方案"),
        ("优先调整事项", "________________________________________________________________\n________________________________________________________________"),
        ("其他意见", "________________________________________________________________\n________________________________________________________________\n________________________________________________________________"),
        ("确认单位", "鲁东大学：______________________________________________________"),
        ("确认人", "姓名：__________________    部门：__________________"),
        ("确认日期", "______ 年 ______ 月 ______ 日"),
    ]
    for idx, (label, value) in enumerate(rows):
        left, right = table.rows[idx].cells
        set_cell_shading(left, GRAY_LIGHT)
        prevent_row_split(table.rows[idx])
        for cell in (left, right):
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, 130, 140, 130, 140)
        p = left.paragraphs[0]
        add_text(p, label, size=10, bold=True, color=NAVY)
        p = right.paragraphs[0]
        style_cell_paragraph(p, line_spacing=1.4)
        for i, line in enumerate(value.split("\n")):
            if i:
                p.add_run().add_break()
            add_text(p, line, size=10)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    add_text(p, "说明", size=10.5, bold=True, color=NAVY)
    notes = [
        "本确认稿用于核对业务规则、页面交互和文档输出口径，不等同于生产环境安全、性能、第三方接口或正式上线验收。",
        "涉及多人分别签署、驳回去向、预算计算附加费用等未最终确认事项，以客户书面确认后的规则为准。",
        "后续如学校正式制度或模板调整，应通过版本变更记录同步更新流程配置、表单和下载模板。",
    ]
    for note in notes:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.2)
        p.paragraph_format.space_after = Pt(2)
        add_text(p, note, size=9.5, color=GRAY)


def build() -> None:
    doc = Document()
    configure_document(doc)
    add_cover(doc)

    first = [item for item in ITEMS if item["round"] == "第一轮"]
    second = [item for item in ITEMS if item["round"] == "第二轮"]
    add_round_intro(doc, "第一轮", "1–16", len(first))
    for item in first:
        add_item(doc, item)

    doc.add_page_break()
    add_round_intro(doc, "第二轮", "19–26", len(second))
    for item in second:
        if item["no"] == "25":
            doc.add_page_break()
        add_item(doc, item)

    add_summary(doc)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
