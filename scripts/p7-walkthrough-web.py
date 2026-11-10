#!/usr/bin/env python3
"""Loopback-only built portal and same-origin proxy; never serves workspace/config files."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import http.client,urllib.parse,os
ROOT=Path(__file__).resolve().parents[1]/'.p0/walkthrough-web'
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.startswith('/api/') or self.path.startswith('/actuator/'):return self.proxy()
  path=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
  target=(ROOT/path.lstrip('/')).resolve()
  if not target.is_relative_to(ROOT.resolve()) or any(part.startswith('.') for part in Path(path).parts):return self.send_error(404)
  if not target.is_file():self.path='/index.html'
  super().do_GET()
 def do_POST(self):self.proxy()
 def do_PUT(self):self.proxy()
 def do_PATCH(self):self.proxy()
 def do_DELETE(self):self.proxy()
 def proxy(self):
  if not self.path.startswith('/api/') and not self.path.startswith('/actuator/'):return self.send_error(404)
  length=int(self.headers.get('Content-Length','0'))
  if length>16*1024*1024:return self.send_error(413)
  body=self.rfile.read(length) if length else None
  headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection','transfer-encoding','proxy-authorization']}
  conn=http.client.HTTPConnection('127.0.0.1',18080,timeout=65)
  try:
   conn.request(self.command,self.path,body,headers);response=conn.getresponse();self.send_response(response.status)
   for k,v in response.getheaders():
    if k.lower() not in ['connection','transfer-encoding','keep-alive']:self.send_header(k,v)
   self.send_header('Connection','close');self.end_headers();self.close_connection=True
   while True:
    chunk=response.read(65536)
    if not chunk:break
    self.wfile.write(chunk)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception:
   self.close_connection=True
  finally:conn.close()
ThreadingHTTPServer(('127.0.0.1',15173),Handler).serve_forever()
