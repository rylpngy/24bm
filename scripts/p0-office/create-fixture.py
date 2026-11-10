from pathlib import Path
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.section import WD_SECTION_START,WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
out=Path(__file__).resolve().parents[2]/'.p0/office/fixture.docx'
d=Document(); sec=d.sections[0];sec.page_height=Cm(29.7);sec.page_width=Cm(21);sec.top_margin=sec.bottom_margin=Cm(2);sec.left_margin=sec.right_margin=Cm(2)
for name in ['Normal','Title','Heading 1','Heading 2']:
 s=d.styles[name];s.font.name='Arial Unicode MS';s.font.color.rgb=RGBColor(0,0,0);s.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Arial Unicode MS')
d.styles['Normal'].font.size=Pt(11)
for style in d.styles:
 if style.type==1:
  style.font.name='Arial Unicode MS';style.font.color.rgb=RGBColor(0,0,0)
  style.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Arial Unicode MS')
  for border in style.element.xpath('.//w:pBdr'):
   border.getparent().remove(border)

sec.header.paragraphs[0].text='24Bm Office 技术验证'
f=sec.footer.paragraphs[0];f.add_run('Page ');field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');f._p.append(field)
d.add_paragraph('采购文件技术验证样例',style='Title')
d.add_paragraph('This document checks editing, version storage and export. 测试样例用于验证中文、标题、表格和页码。')
d.add_heading('第一章 需求与说明',1)
d.add_paragraph('P0_BASELINE_MARKER')
for item in ['需求资料仅使用合成内容','金额 123456.78 元','交付地点 测试场地']:
 d.add_paragraph(item,style='List Number')
d.add_heading('第二章 明细表',1)
t=d.add_table(rows=1,cols=3);t.style='Table Grid'
for c,v in zip(t.rows[0].cells,['序号','内容','金额']):c.text=v
for i in range(3):
 c=t.add_row().cells;c[0].text=str(i+1);c[1].text='测试采购内容 '+str(i+1);c[2].text='1000.00'
d.add_page_break();d.add_heading('第三章 表格与附件',1)
t=d.add_table(rows=1,cols=3);t.style='Table Grid'
for c,v in zip(t.rows[0].cells,['条目','技术要求','核对']):c.text=v
rep=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(rep)
for i in range(14):
 cells=t.add_row().cells;cells[0].text=str(i+1);cells[1].text='参数验证 '+str(i+1)+' / requirement';cells[2].text='待确认'
t.add_row().cells[0].merge(t.rows[-1].cells[2]).text='合并单元格测试 MERGED_CELL_MARKER'
d.add_paragraph('附件引用 ANNEX_A：表内金额与正文分别保留，不自动调整。')
sec=d.add_section(WD_SECTION_START.NEW_PAGE);sec.orientation=WD_ORIENT.LANDSCAPE;sec.page_width=Cm(29.7);sec.page_height=Cm(21)
d.add_heading('第四章 横向附件',1)
t=d.add_table(rows=2,cols=5);t.style='Table Grid'
for i,c in enumerate(t.rows[0].cells):c.text='字段 '+str(i+1)
for c in t.rows[1].cells:c.text='LANDSCAPE_MARKER'
d.add_paragraph('END_OF_FIXTURE')
d.core_properties.author='24Bm P0';out.parent.mkdir(parents=True,exist_ok=True);d.save(out)
print(out)
