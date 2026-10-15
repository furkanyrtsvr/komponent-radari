"""Stream million-row data into the styled Artifact Tool workbook, without Excel libraries."""
import sys, sqlite3, zipfile, json, re, datetime, os
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET
db_path, template, output = sys.argv[1:]
db=sqlite3.connect('file:'+db_path.replace('\\','/')+'?mode=ro',uri=True)
db.execute('BEGIN')
groups=db.execute('SELECT category,COUNT(*) FROM products WHERE active=1 GROUP BY category ORDER BY category').fetchall()
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
letters='ABCDEFGHIJKL'
now=datetime.datetime.now(datetime.timezone.utc)
total=0
tmp=output+'.tmp'
with zipfile.ZipFile(template) as src, zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as dst:
 for entry in src.infolist():
  match=re.fullmatch(r'xl/worksheets/sheet(\d+)\.xml',entry.filename)
  if not match or int(match[1])==1:
   dst.writestr(entry,src.read(entry.filename));continue
  index=int(match[1])-2
  if index>=len(groups):raise ValueError('Unexpected worksheet')
  category,count=groups[index]
  if count+1>1048576:raise ValueError('Excel row limit exceeded; split this category')
  xml=src.read(entry.filename).decode('utf-8')
  root=ET.fromstring(xml)
  header=root.find('s:sheetData/s:row',ns)
  styles={c.attrib['r'].rstrip('1234567890'):c.attrib.get('s','0') for c in root.findall('s:sheetData/s:row[@r="2"]/s:c',ns)}
  opening,ending=re.split(r'<(?:\w+:)?sheetData\b[^>]*>',xml,maxsplit=1)
  _,ending=re.split(r'</(?:\w+:)?sheetData>',ending,maxsplit=1)
  if 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' not in opening:
   opening=opening.replace('<x:worksheet','<x:worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',1)
  opening=re.sub(r'<dimension[^>]*/>',f'<dimension ref="A1:L{count+1}"/>',opening)
  if not re.search(r'<(?:\w+:)?dimension\b',opening):
   opening=re.sub(r'(<(?:\w+:)?worksheet\b[^>]*>)',r'\1'+f'<dimension ref="A1:L{count+1}"/>',opening,count=1)
  # Keep the native header exactly as authored, including shared strings/styles.
  header_xml=re.search(r'<(?:\w+:)?row\b[^>]*r="1"[^>]*>.*?</(?:\w+:)?row>',xml,re.S).group(0)
  with dst.open(entry.filename,'w',force_zip64=True) as stream:
   stream.write((opening+'<sheetData>'+header_xml).encode())
   cursor=db.execute('SELECT store_id,name,category,checked_at,payload,url,error,source_category FROM products WHERE active=1 AND category=? ORDER BY url',(category,))
   for number,row in enumerate(cursor,2):
    store,name,cat,checked,payload,url,error,source_cat=row
    p=json.loads(payload)['product'] if payload else {}
    dt=datetime.datetime.fromisoformat(checked.replace('Z','+00:00')) if checked else None
    excel_date=(dt.replace(tzinfo=None)-datetime.datetime(1899,12,30)).total_seconds()/86400 if dt else None
    stale=dt is not None and (now-dt).total_seconds()>=43200
    status=error or ('Fiyat okunmadı · URL başlığı' if not p else 'Eski kayıt' if stale else 'Doğrulanmış fiyat')
    values=[store,name,cat,p.get('price')/100 if p.get('price') else None,p.get('stockStatus',''),excel_date,p.get('packageQuantity'),p.get('orderStep'),p.get('minimumOrderQuantity'),url,status,source_cat]
    cells=[]
    for col,value in zip(letters,values):
     if value is None:continue
     attrs=f'r="{col}{number}" s="{styles.get(col,"0")}"'
     if isinstance(value,(int,float)):cells.append(f'<c {attrs}><v>{value}</v></c>')
     else:
      # Prevent illegal XML controls; inlineStr never evaluates merchant text as a formula.
      text=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',str(value))[:32767]
      cells.append(f'<c {attrs} t="inlineStr"><is><t xml:space="preserve">{escape(text)}</t></is></c>')
    stream.write((f'<row r="{number}">'+''.join(cells)+'</row>').encode('utf-8'))
   ending=re.sub(r'<autoFilter[^>]*/>','',ending)
   stream.write(('</sheetData>'+f'<autoFilter ref="A1:L{count+1}"/>'+ending).encode())
  total+=count
db.close()
# Verify ZIP integrity and all worksheet row counts without loading the workbook.
with zipfile.ZipFile(tmp) as z:
 if z.testzip():raise ValueError('Corrupt XLSX archive')
 for index,(category,count) in enumerate(groups,2):
  rows=0
  with z.open(f'xl/worksheets/sheet{index}.xml') as f:
   for event,element in ET.iterparse(f,events=('end',)):
    if element.tag.endswith('}row'):rows+=1
    element.clear()
  if rows!=count+1:raise ValueError(f'Row count differs: {category}: {rows}')
os.replace(tmp,output)
print(json.dumps({'output':output,'rows':total,'categories':len(groups),'bytes':os.path.getsize(output)},ensure_ascii=False))
