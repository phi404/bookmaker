"""Independent checks for actual PDFs saved by the app. No renderer code is imported."""
import json, sys
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream
from PIL import Image

directory=Path(sys.argv[1])
manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
pt=72/25.4
def close(values,expected):
    assert len(values)==len(expected)
    assert all(abs(float(a)-b*pt)<.01 for a,b in zip(values,expected)), (values,expected)
def images(page):
    result=[]
    def walk(resources):
        if not resources:return
        resources=resources.get_object()
        for ref in resources.get('/XObject',{}).get_object().values() if '/XObject' in resources else []:
            obj=ref.get_object()
            if obj.get('/Subtype')=='/Image':result.append(obj)
            elif obj.get('/Subtype')=='/Form':walk(obj.get('/Resources'))
    walk(page.get('/Resources'))
    return result
def forms(page):
    result=[]
    def walk(resources):
        if not resources:return
        resources=resources.get_object()
        if '/XObject' not in resources:return
        for ref in resources['/XObject'].get_object().values():
            obj=ref.get_object()
            if obj.get('/Subtype')=='/Form':
                result.append(obj);walk(obj.get('/Resources'))
    walk(page.get('/Resources'))
    return result
def lines(page,reader):
    result=[];start=None;pending=[]
    for args,op in ContentStream(page.get_contents(),reader).operations:
        if op==b'm':start=list(map(float,args))
        if op==b'l' and start:
            pending.append(start+list(map(float,args)));start=list(map(float,args))
        if op==b'S':result.extend(pending);pending=[];start=None
        if op in [b'n',b'f',b'f*']:pending=[];start=None
    return result
readers={name:PdfReader(directory/name) for name in manifest['files']}
records=[]
for name,reader in readers.items():
    assert len(reader.pages)==(1 if name=='range.pdf' else 3)
    printing=name!='screen.pdf';marked=name in ['mono-marks.pdf','color-vectors.pdf','range.pdf']
    expected_media=[0,0,125,168] if marked else [0,0,111,154] if printing else [0,0,105,148]
    expected_trim=[10,10,115,158] if marked else [3,3,108,151] if printing else [0,0,105,148]
    expected_bleed=[7,7,118,161] if marked else expected_media
    if printing:assert '/Outlines' not in reader.trailer['/Root']
    for i,page in enumerate(reader.pages):
        close(page.mediabox,expected_media);close(page.trimbox,expected_trim);close(page.bleedbox,expected_bleed)
        if printing:assert not page.get('/Annots')
        marks=lines(page,reader)
        assert len(marks)==(24 if marked else 0),(name,i,len(marks))
        for x1,y1,x2,y2 in marks:
            assert all(0<=x<=125*pt for x in [x1,x2]) and all(0<=y<=168*pt for y in [y1,y2])
            assert (x1<7*pt and x2<7*pt) or (x1>118*pt and x2>118*pt) or (y1<7*pt and y2<7*pt) or (y1>161*pt and y2>161*pt), (name,i,marks)
        if name.startswith('mono'):
            bitmap=images(page);assert len(bitmap)==1
            image=bitmap[0];assert image['/ColorSpace']=='/DeviceGray'
            assert [image['/Width'],image['/Height']]==[2622,3638]
            data=image.get_data();assert len(data)==2622*3638
            if i<2:assert data.count(b'\x00')>50,'Text must contain solid black pixels'
        elif name=='screen.pdf':
            bitmap=images(page);assert len(bitmap)==1
            assert bitmap[0]['/ColorSpace']=='/DeviceRGB'
            assert [bitmap[0]['/Width'],bitmap[0]['/Height']]==[1240,1748]
        elif name=='color-vectors.pdf' and i<2:
            bitmap=images(page);assert len(bitmap)==1
            assert bitmap[0]['/ColorSpace']=='/DeviceRGB'
            assert [bitmap[0]['/Width'],bitmap[0]['/Height']]==[1530,2122]
    records.append({'file':name,'pages':len(reader.pages),'boxes':'pass','marks':'pass','printing':printing})
for a,b in zip(readers['mono.pdf'].pages,readers['mono-marks.pdf'].pages):
    assert images(a)[0].get_data()==images(b)[0].get_data(),'Marks must not scale or move the page image'
image=images(readers['mono.pdf'].pages[2])[0];data=image.get_data();w=int(image['/Width']);h=int(image['/Height'])
stripe=list(data[(h-1260)*w+720:(h-1260)*w+840])
contrast=sum(abs(a-b) for a,b in zip(stripe,stripe[1:]))/119
assert contrast>100,'600dpi fine lines must survive from the original PDF, not an upscaled preview'
# Bleed must contain the original red border, and the trim interior must be blue.
def gray_at(x_mm,y_from_bottom_mm):
    x=round(x_mm*600/25.4);y=h-round(y_from_bottom_mm*600/25.4)
    return data[y*w+x]
assert 45<gray_at(1,70)<65
assert 8<gray_at(10,70)<28
for page in [readers['color-vectors.pdf'].pages[2],readers['range.pdf'].pages[0]]:
    payloads=[f.get_data() for f in forms(page)]
    assert any(b'1 0 0 rg' in d and b'0 0 1 rg' in d for d in payloads),'Original color drawing commands must remain'
    assert any(len(d)>1000 for d in payloads),'The fine-line vector source must remain a Form'
assert '/Outlines' in readers['screen.pdf'].trailer['/Root']
assert readers['screen.pdf'].pages[0].get('/Annots')
(directory/'review').mkdir(exist_ok=True)
Image.frombytes('L',(w,h),data).crop((710,h-1330,850,h-1190)).resize((560,560)).save(directory/'review/native-600dpi-detail.png')

extra_specs={
 'b6-mono':([0,0,148,202],[10,10,138,192],[7,7,141,195],16,[3165,4441],'/DeviceGray'),
 'a5-color':([0,0,162,224],[7,7,155,217],[7,7,155,217],8,[2039,2894],'/DeviceRGB')
}
for label,(media,trim,bleed,count,size,color) in extra_specs.items():
    case=json.loads((directory/(label+'.json')).read_text(encoding='utf-8'))
    assert case['sourceFingerprint']==manifest['sourceFingerprint']
    reader=PdfReader(directory/case['file']);assert len(reader.pages)==1
    page=reader.pages[0];close(page.mediabox,media);close(page.trimbox,trim);close(page.bleedbox,bleed)
    assert not page.get('/Annots')
    marks=lines(page,reader);assert len(marks)==count
    for x1,y1,x2,y2 in marks:
        assert (x1<bleed[0]*pt and x2<bleed[0]*pt) or (x1>bleed[2]*pt and x2>bleed[2]*pt) or (y1<bleed[1]*pt and y2<bleed[1]*pt) or (y1>bleed[3]*pt and y2>bleed[3]*pt)
    bitmap=images(page);assert len(bitmap)==1
    assert [bitmap[0]['/Width'],bitmap[0]['/Height']]==size
    assert bitmap[0]['/ColorSpace']==color
    records.append({'file':case['file'],'pages':1,'boxes':'pass','marks':'pass','printing':True})


for label in ['firefox','webkit']:
    case=json.loads((directory/('compat-'+label+'.json')).read_text(encoding='utf-8'))
    assert case['sourceFingerprint']==manifest['sourceFingerprint']
    reader=PdfReader(directory/case['file']);assert len(reader.pages)==1
    page=reader.pages[0];close(page.mediabox,[0,0,111,154]);close(page.trimbox,[3,3,108,151]);close(page.bleedbox,[0,0,111,154]);assert not page.get('/Annots')
    bitmap=images(page);assert len(bitmap)==1 and bitmap[0]['/ColorSpace']=='/DeviceGray'
    assert [bitmap[0]['/Width'],bitmap[0]['/Height']]==[2622,3638]
    opaque=Image.frombytes('L',(2622,3638),bitmap[0].get_data())
    for corner in [(0,0,32,32),(2590,0,2622,32),(0,3606,32,3638),(2590,3606,2622,3638)]:
        assert opaque.crop(corner).getextrema()==(255,255),(label,'White-paper corners must not contain black transparent pixels',corner)
    records.append({'file':case['file'],'pages':1,'boxes':'pass','color':'DeviceGray','dpi':600,'engine':label})

report={'sourceFingerprint':manifest['sourceFingerprint'],'status':'pass','checks':records,'adjacentPixelContrast':contrast,'independentParser':'pypdf','limits':['No PDF/X or ICC compliance claim','No printer acceptance or physical proof was performed','Source PDF embedded-font and internal-image preflight remains separate']}
(directory/'independent-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'pass','pdfFiles':len(records),'pages':sum(r['pages'] for r in records),'native600dpiContrast':contrast}))
