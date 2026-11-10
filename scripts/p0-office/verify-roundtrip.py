from pathlib import Path
from docx import Document
from PIL import Image, ImageChops
import json
p=Path(__file__).resolve().parents[2]/'.p0/office'
a=Document(p/'fixture.docx');b=Document(p/'offline-roundtrip/fixture.docx')
def values(d):return [x.text for x in d.paragraphs]+[c.text for t in d.tables for r in t.rows for c in r.cells]
x=values(a);y=values(b)
checks={'nonempty_text_including_tables_equal':[v for v in x if v]==[v for v in y if v],'tables_equal':len(a.tables)==len(b.tables),'section_sizes_equal':[(s.page_width,s.page_height) for s in a.sections]==[(s.page_width,s.page_height) for s in b.sections],'header_text_equal':[s.header.paragraphs[0].text for s in a.sections]==[s.header.paragraphs[0].text for s in b.sections],'footer_fields_preserved':'PAGE' in b.sections[0].footer._element.xml,'merged_cell_preserved':'gridSpan' in b.tables[1]._tbl.xml,'numbering_preserved':bool(b.part.numbering_part.element.xml)}
images=[]
for i in [1,2,3]:
 before=Image.open(p/f'render-before/page-{i}.png').convert('RGB');after=Image.open(p/f'render-after/page-{i}.png').convert('RGB')
 images.append({'page':i,'same_dimensions':before.size==after.size,'pixels_identical':before.size==after.size and ImageChops.difference(before,after).getbbox() is None})
result={'engine':'bundled LibreOffice, NOT Microsoft Word or online editor','checks':checks,'empty_paragraph_count_delta':sum(not v for v in y)-sum(not v for v in x),'render_comparison':images}
(p/'offline-roundtrip-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
assert all(checks.values()) and all(i['pixels_identical'] for i in images),result
print('Offline synthetic fixture checks passed')
